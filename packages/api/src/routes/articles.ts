import { AppError } from '../utils/errors.js';
import { articlesResponse, errorResponse } from '../utils/response.js';
import { StorageService } from '../services/storage.js';
import type { ApiArticleSummary, ArticlesQueryParams, ArticlesResponse, Env, SourceType } from '../types.js';

// 查询参数验证
const VALID_SOURCES: SourceType[] = ['openai', 'anthropic', 'codex', 'opencode'];
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const MAX_DAYS = 7;

interface ParsedArticlesQuery extends ArticlesQueryParams {
  days: number;
  page: number;
  pageSize: number;
}

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
      params.sources || params.source  // 支持多选或单选
    );

    // 分页
    const totalCount = summaries.length;
    const totalPages = Math.ceil(totalCount / params.pageSize);
    const startIndex = (params.page - 1) * params.pageSize;
    const endIndex = startIndex + params.pageSize;
    const paginatedArticles = summaries.slice(startIndex, endIndex);
    const apiArticles: ApiArticleSummary[] = paginatedArticles.map(summary => ({
      id: summary.id,
      source: summary.source,
      title: summary.title,
      summary_md: summary.summaryMd,
      source_url: summary.url,
      published_at: summary.publishedAt,
    }));

    // 确定包含的数据源
    const sourcesIncluded = params.sources
      ? params.sources
      : params.source
        ? [params.source]
        : [...new Set(summaries.map(s => s.source))];

    // 获取最后刷新时间
    const lastRefreshedAt = await storage.getLastRefreshed();

    const response: ArticlesResponse = {
      success: true,
      data: {
        articles: apiArticles,
      },
      meta: {
        page: params.page,
        page_size: params.pageSize,
        total_count: totalCount,
        total_pages: totalPages,
        sources_included: sourcesIncluded,
        date_range: { from: fromDate, to: toDate },
        last_refreshed_at: lastRefreshedAt,
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

function parseQueryParams(searchParams: URLSearchParams): ParsedArticlesQuery {
  const params: ArticlesQueryParams = {};

  // date 参数
  const date = searchParams.get('date');
  if (date) {
    if (!isValidDateString(date)) {
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

  // sources 参数（多选）
  const sourcesParam = searchParams.get('sources');
  if (sourcesParam) {
    const sources = sourcesParam.split(',').filter(s =>
      VALID_SOURCES.includes(s as SourceType)
    ) as SourceType[];
    params.sources = sources.length > 0 ? sources : undefined;
  }

  // days 参数
  const days = searchParams.get('days');
  if (days) {
    const daysNum = parseStrictPositiveInt(days);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > MAX_DAYS) {
      throw new AppError('VALIDATION_INVALID_DAYS');
    }
    params.days = daysNum;
  }

  // page 参数
  const page = searchParams.get('page');
  if (page) {
    const pageNum = parseStrictPositiveInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      throw new AppError('VALIDATION_INVALID_PAGE');
    }
    params.page = pageNum;
  }

  // page_size 参数
  const pageSize = searchParams.get('page_size');
  if (pageSize) {
    const sizeNum = parseStrictPositiveInt(pageSize);
    if (isNaN(sizeNum) || sizeNum < 1 || sizeNum > MAX_PAGE_SIZE) {
      throw new AppError('VALIDATION_INVALID_PAGE_SIZE');
    }
    params.pageSize = sizeNum;
  }

  return {
    date: params.date,
    source: params.source,
    sources: params.sources,
    days: params.days ?? 1,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
  };
}

function calculateDateRange(params: ArticlesQueryParams): { fromDate: string; toDate: string } {
  const days = params.days || 7;

  if (params.date) {
    // 指定了具体日期，返回该日期往前 N 天的范围
    const toDate = new Date(params.date);
    const fromDate = new Date(params.date);
    fromDate.setDate(fromDate.getDate() - days + 1);

    return {
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
    };
  }

  // 计算最近 N 天的范围（从今天开始）
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);

  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
  };
}

function parseStrictPositiveInt(value: string): number {
  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }
  return parseInt(value, 10);
}

function isValidDateString(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return false;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}
