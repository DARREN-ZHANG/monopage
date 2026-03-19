import { AppError } from '../utils/errors.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { StorageService } from '../services/storage.js';
import { ScraperService } from '../services/scraper.js';
import { SummarizerService } from '../services/summarizer.js';
import type {
  Env,
  SourceType,
  RefreshRequest,
  RefreshResponse,
  RefreshMessage,
  RefreshTaskState,
  RefreshTriggerResponse,
  RefreshStatusResponse,
  RefreshTaskProgress,
} from '../types.js';

const VALID_SOURCES: SourceType[] = ['openai', 'anthropic', 'codex', 'opencode'];

// ===== 进度更新回调类型 =====
type ProgressCallback = (progress: RefreshTaskProgress) => Promise<void>;

// ===== POST /refresh - 触发异步刷新 =====

/**
 * 处理刷新触发请求
 * 将刷新任务放入队列并返回任务 ID
 */
export async function handleRefreshTrigger(request: Request, env: Env): Promise<Response> {
  try {
    // 检查队列是否配置
    if (!env.REFRESH_QUEUE) {
      // 如果没有队列，回退到同步刷新（用于本地开发）
      console.warn('REFRESH_QUEUE not configured, falling back to sync refresh');
      return await handleSyncRefresh(request, env);
    }

    // 解析请求体
    const body = await parseRequestBody(request);

    // 生成任务 ID
    const taskId = generateTaskId();

    // 检查是否有正在运行的任务
    const storage = new StorageService(env);
    const currentTaskId = await storage.getCurrentRefreshTask();

    if (currentTaskId) {
      const currentState = await storage.getRefreshTaskState(currentTaskId);

      // 如果任务仍在运行且未超时
      if (currentState &&
          currentState.status === 'running' &&
          !storage.isRefreshTimedOut(currentState.startedAt)) {
        // 返回现有任务的状态
        const response: RefreshTriggerResponse = {
          success: true,
          data: {
            taskId: currentTaskId,
            status: 'pending',
          },
        };
        return successResponse(response.data);
      }
    }

    // 创建初始任务状态
    const taskState: RefreshTaskState = {
      taskId,
      status: 'pending',
      startedAt: new Date().toISOString(),
      progress: {
        current: 0,
        total: VALID_SOURCES.length,
        currentSource: VALID_SOURCES[0],
      },
    };

    // 保存任务状态
    await storage.saveRefreshTaskState(taskState);
    await storage.setCurrentRefreshTask(taskId);

    // 发送队列消息
    const message: RefreshMessage = {
      taskId,
      timestamp: new Date().toISOString(),
    };

    await env.REFRESH_QUEUE.send(message);

    // 返回响应
    const response: RefreshTriggerResponse = {
      success: true,
      data: {
        taskId,
        status: 'pending',
      },
    };

    return successResponse(response.data);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined));
  }
}

// ===== GET /refresh/status - 查询刷新状态 =====

/**
 * 处理刷新状态查询请求
 */
export async function handleRefreshStatus(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('task_id');

    const storage = new StorageService(env);

    // 如果提供了 task_id，查询特定任务
    if (taskId) {
      const state = await storage.getRefreshTaskState(taskId);

      if (!state) {
        // 任务不存在，返回 404
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'TASK_NOT_FOUND',
              code_num: 4041,
              message: 'Refresh task not found',
              retryable: false,
            },
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            },
          }
        );
      }

      const response: RefreshStatusResponse = {
        success: true,
        data: state,
      };

      return successResponse(response.data);
    }

    // 否则查询当前任务
    const currentTaskId = await storage.getCurrentRefreshTask();

    if (!currentTaskId) {
      // 没有正在运行的任务
      const response: RefreshStatusResponse = {
        success: true,
        data: {
          taskId: '',
          status: 'completed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      };

      return successResponse(response.data);
    }

    const currentState = await storage.getRefreshTaskState(currentTaskId);

    if (!currentState) {
      // 任务状态丢失，返回默认完成状态
      const response: RefreshStatusResponse = {
        success: true,
        data: {
          taskId: currentTaskId,
          status: 'completed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      };

      return successResponse(response.data);
    }

    // 检查超时
    if (currentState.status === 'running' && storage.isRefreshTimedOut(currentState.startedAt)) {
      // 标记为失败
      const timeoutState: RefreshTaskState = {
        ...currentState,
        status: 'failed',
        error: 'Refresh task timed out',
        completedAt: new Date().toISOString(),
      };

      await storage.saveRefreshTaskState(timeoutState);
      await storage.clearCurrentRefreshTask();

      const response: RefreshStatusResponse = {
        success: true,
        data: timeoutState,
      };

      return successResponse(response.data);
    }

    const response: RefreshStatusResponse = {
      success: true,
      data: currentState,
    };

    return successResponse(response.data);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined));
  }
}

// ===== Queue Handler - 处理刷新消息 =====

/**
 * 处理队列消息，执行实际的刷新操作
 */
export async function processRefreshMessage(message: RefreshMessage, env: Env): Promise<void> {
  const storage = new StorageService(env);
  const { taskId } = message;
  let taskState: RefreshTaskState | null = null;

  try {
    // 获取任务状态
    taskState = await storage.getRefreshTaskState(taskId);

    if (!taskState) {
      console.error(`Task state not found for taskId: ${taskId}`);
      return;
    }

    // 更新状态为 running
    taskState = {
      ...taskState,
      status: 'running',
    };
    await storage.saveRefreshTaskState(taskState);

    // 执行带进度更新的刷新
    const result = await runRefreshWithProgress(
      env,
      undefined,
      async (progress: RefreshTaskProgress) => {
        // 更新进度
        const currentState = await storage.getRefreshTaskState(taskId);
        if (currentState) {
          await storage.saveRefreshTaskState({
            ...currentState,
            progress,
          });
        }
      }
    );

    // 更新状态为 completed
    taskState = {
      ...taskState,
      status: 'completed',
      completedAt: new Date().toISOString(),
      result,
    };
    await storage.saveRefreshTaskState(taskState);
    await storage.clearCurrentRefreshTask();

  } catch (error) {
    console.error(`Refresh task ${taskId} failed:`, error);

    // 更新状态为 failed
    const failedState: RefreshTaskState = {
      taskId,
      status: 'failed',
      startedAt: taskState?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };

    await storage.saveRefreshTaskState(failedState);
    await storage.clearCurrentRefreshTask();
  }
}

// ===== 带进度更新的刷新执行 =====

/**
 * 执行刷新并定期更新进度
 */
export async function runRefreshWithProgress(
  env: Env,
  sourceFilter?: SourceType,
  onProgress?: ProgressCallback
): Promise<RefreshResponse['data']> {
  const sourcesToRefresh = sourceFilter ? [sourceFilter] : VALID_SOURCES;
  const storage = new StorageService(env);
  const scraper = new ScraperService(env);
  const summarizer = new SummarizerService(env);

  const refreshedSources: SourceType[] = [];
  let totalFound = 0;
  let totalSummarized = 0;
  let totalSkippedDuplicate = 0;
  let totalSkippedIncomplete = 0;
  const allErrors: string[] = [];

  for (let i = 0; i < sourcesToRefresh.length; i++) {
    const source = sourcesToRefresh[i];

    // 报告进度
    if (onProgress) {
      await onProgress({
        current: i,
        total: sourcesToRefresh.length,
        currentSource: source,
      });
    }

    try {
      const scrapeResult = await scraper.scrapeSource(source, 24 * 7); // 最近 7 天

      if (scrapeResult.errors.length > 0) {
        allErrors.push(...scrapeResult.errors.map(e => `[${source}] ${e.code}: ${e.message}`));
      }

      if (scrapeResult.articles.length === 0) {
        continue;
      }

      totalFound += scrapeResult.articles.length;
      refreshedSources.push(source);

      // 用最近历史索引做去重，避免发布时间漂移导致跨天重复
      const existingIds = await storage.getExistingIdsBySource(source);
      const { results, stats } = await summarizer.summarizeBatch(scrapeResult.articles, existingIds);

      for (const summary of results) {
        const date = summary.publishedAt.slice(0, 10);
        await storage.saveSummary(summary);
        await storage.addToIndex(date, source, summary.id);
      }

      totalSummarized += stats.summarized;
      totalSkippedDuplicate += stats.skippedDuplicate;
      totalSkippedIncomplete += stats.skippedIncomplete;
      allErrors.push(...stats.errors);
    } catch (error) {
      const errorMsg = error instanceof AppError ? `${error.code}: ${error.message}` : String(error);
      allErrors.push(`[${source}] ${errorMsg}`);
    }
  }

  // 报告完成进度
  if (onProgress) {
    await onProgress({
      current: sourcesToRefresh.length,
      total: sourcesToRefresh.length,
      currentSource: sourcesToRefresh[sourcesToRefresh.length - 1],
    });
  }

  await storage.setLastRefreshed(new Date().toISOString());

  try {
    const cleanupResult = await storage.cleanupOldData();
    if (cleanupResult.errors.length > 0) {
      console.warn('Cleanup errors:', cleanupResult.errors);
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }

  return {
    refreshed_sources: refreshedSources,
    articles_found: totalFound,
    articles_summarized: totalSummarized,
    articles_skipped: {
      duplicate: totalSkippedDuplicate,
      incomplete_metadata: totalSkippedIncomplete,
    },
    errors: allErrors,
  };
}

// ===== 同步刷新（保留供 cron 使用） =====

/**
 * 同步刷新 - 供 scheduled handler 使用
 * 这是原有的 runRefresh 函数，保持向后兼容
 */
export async function runRefresh(
  env: Env,
  sourceFilter?: SourceType
): Promise<RefreshResponse['data']> {
  // 直接调用带进度的版本，但不传进度回调
  return runRefreshWithProgress(env, sourceFilter);
}

// ===== 同步刷新处理器（回退方案） =====

/**
 * 同步刷新处理器 - 用于没有队列配置的情况
 */
async function handleSyncRefresh(request: Request, env: Env): Promise<Response> {
  try {
    const body = await parseRequestBody(request);
    const data = await runRefresh(env, body.source);

    const response: RefreshResponse = {
      success: true,
      data,
    };

    return successResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined));
  }
}

// ===== 保留原有的 handleRefresh 用于向后兼容 =====

/**
 * 处理 POST /refresh 请求（向后兼容）
 * @deprecated 使用 handleRefreshTrigger 替代
 */
export async function handleRefresh(request: Request, env: Env): Promise<Response> {
  // 如果配置了队列，使用异步处理
  if (env.REFRESH_QUEUE) {
    return handleRefreshTrigger(request, env);
  }

  // 否则使用同步处理
  return handleSyncRefresh(request, env);
}

// ===== 工具函数 =====

/**
 * 生成唯一的任务 ID
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `refresh_${timestamp}_${random}`;
}

/**
 * 解析请求体
 */
async function parseRequestBody(request: Request): Promise<RefreshRequest> {
  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return {};
  }

  let body: RefreshRequest;
  try {
    body = JSON.parse(rawBody) as RefreshRequest;
  } catch (error) {
    throw new AppError('VALIDATION_INVALID_JSON', error instanceof Error ? error : undefined);
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('VALIDATION_INVALID_JSON');
  }

  if (body.source && !VALID_SOURCES.includes(body.source)) {
    throw new AppError('VALIDATION_INVALID_SOURCE');
  }

  return body;
}
