import { AppError } from '../utils/errors.js';
import { articlesResponse, errorResponse } from '../utils/response.js';
import { StorageService } from '../services/storage.js';
import type { ArticlesQueryParams, ArticlesResponse, Env, SourceType } from '../types.js';

// 查询参数验证
const VALID_SOURCES: SourceType[] = ['openai', 'anthropic'];
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const MAX_DAYS = 7;

/**
 * 处理 GET /articles 请求
 */
export async function handleArticles(request: Request, env: Env): Promise<Response> {
  try {
    // 解析查询参数
    const url = new URL(request.url);
    const params = parseQueryParams(url.searchParams);

    // 计算日期范围
    const { fromDate, toDate } = calculateDateRange(params);

    // 查询存储
    const storage = new StorageService(env);
    const summaries = await storage.getSummariesByDateRange(
      fromDate,
      toDate,
      params.source
    );

    // 分页
    const totalCount = summaries.length;
    const totalPages = Math.ceil(totalCount / params.pageSize);
    const startIndex = (params.page - 1) * params.pageSize;
    const endIndex = startIndex + params.pageSize;
    const paginatedArticles = summaries.slice(startIndex, endIndex);

    // 确定包含的数据源
    const sourcesIncluded = params.source
      ? [params.source]
      : [...new Set(summaries.map(s => s.source))];

    // 获取最后刷新时间
    const lastRefreshedAt = await storage.getLastRefreshed();

    const response: ArticlesResponse = {
      success: true,
      data: {
        articles: paginatedArticles,
      },
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount,
        totalPages,
        sourcesIncluded,
        dateRange: { from: fromDate, to: toDate },
        lastRefreshedAt,
      },
    };

    return articlesResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined));
  }
}

function parseQueryParams(searchParams: URLSearchParams): Required<ArticlesQueryParams> {
  const params: ArticlesQueryParams = {};

  // date 参数
  const date = searchParams.get('date');
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
      throw new AppError('VALIDATION_INVALID_DATE');
    }
    params.date = date;
  }

  // source 参数
  const source = searchParams.get('source');
  if (source) {
    if (!VALID_SOURCES.includes(source as SourceType)) {
      throw new AppError('VALIDATION_INVALID_SOURCE');
    }
    params.source = source as SourceType;
  }

  // days 参数
  const days = searchParams.get('days');
  if (days) {
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > MAX_DAYS) {
      throw new AppError('VALIDATION_INVALID_DAYS');
    }
    params.days = daysNum;
  }

  // page 参数
  const page = searchParams.get('page');
  if (page) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      throw new AppError('VALIDATION_INVALID_PAGE');
    }
    params.page = pageNum;
  }

  // page_size 参数
  const pageSize = searchParams.get('page_size');
  if (pageSize) {
    const sizeNum = parseInt(pageSize, 10);
    if (isNaN(sizeNum) || sizeNum < 1 || sizeNum > MAX_PAGE_SIZE) {
      throw new AppError('VALIDATION_INVALID_PAGE_SIZE');
    }
    params.pageSize = sizeNum;
  }

  return {
    date: params.date,
    source: params.source,
    days: params.days ?? 1,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
  };
}

function calculateDateRange(params: ArticlesQueryParams): { fromDate: string; toDate: string } {
  const days = params.days || 1;

  if (params.date) {
    // 指定了具体日期，返回该日期当天
    return { fromDate: params.date, toDate: params.date };
  }

  // 计算最近 N 天的范围
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);

  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
  };
}
