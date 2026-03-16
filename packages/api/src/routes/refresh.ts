import { AppError } from '../utils/errors.js';
import { refreshResponse, errorResponse } from '../utils/response.js';
import { StorageService } from '../services/storage.js';
import { ScraperService } from '../services/scraper.js';
import { SummarizerService } from '../services/summarizer.js';
import type { RefreshRequest, RefreshResponse, Env, SourceType } from '../types.js';

const VALID_SOURCES: SourceType[] = ['openai', 'anthropic'];

/**
 * 处理 POST /refresh 请求
 */
export async function handleRefresh(request: Request, env: Env): Promise<Response> {
  try {
    // 解析请求体
    const body = await parseRequestBody(request);
    const data = await runRefresh(env, body.source);

    const response: RefreshResponse = {
      success: true,
      data,
    };

    return refreshResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined));
  }
}

export async function runRefresh(
  env: Env,
  sourceFilter?: SourceType
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

  for (const source of sourcesToRefresh) {
    try {
      const scrapeResult = await scraper.scrapeSource(source, 24);

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
