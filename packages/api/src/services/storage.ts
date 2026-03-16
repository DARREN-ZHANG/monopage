import { AppError } from '../utils/errors.js';
import type { ArticleSummary, SourceType, IndexEntry } from '../types.js';
import type { Env } from '../types.js';

const INDEX_PREFIX = 'index';
const SUMMARY_PREFIX = 'summary';

/**
 * KV 存储服务 - 封装所有 KV 操作
 */
export class StorageService {
  private kv: KVNamespace;
  private historyDays: number;

  constructor(env: Env) {
    this.kv = env.KV;
    this.historyDays = parseInt(env.HISTORY_DAYS, 10) || 7;
  }

  // ===== 摘要存储 =====

  /**
   * 生成摘要的 KV Key
   * 格式: summary:{source}:{date}:{id}
   */
  private getSummaryKey(source: SourceType, date: string, id: string): string {
    return `${SUMMARY_PREFIX}:${source}:${date}:${id}`;
  }

  /**
   * 保存文章摘要
   */
  async saveSummary(summary: ArticleSummary): Promise<void> {
    const date = summary.publishedAt.slice(0, 10); // YYYY-MM-DD
    const key = this.getSummaryKey(summary.source, date, summary.id);

    try {
      await this.kv.put(key, JSON.stringify(summary));
    } catch (error) {
      throw new AppError('KV_WRITE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 检查摘要是否已存在
   */
  async hasSummary(source: SourceType, date: string, id: string): Promise<boolean> {
    const key = this.getSummaryKey(source, date, id);

    try {
      const value = await this.kv.get(key);
      return value !== null;
    } catch (error) {
      throw new AppError('KV_READ_FAILED', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取单条摘要
   */
  async getSummary(source: SourceType, date: string, id: string): Promise<ArticleSummary | null> {
    const key = this.getSummaryKey(source, date, id);

    try {
      const value = await this.kv.get(key);
      return value ? JSON.parse(value) as ArticleSummary : null;
    } catch (error) {
      throw new AppError('KV_READ_FAILED', error instanceof Error ? error : undefined);
    }
  }

  // ===== 索引管理 =====

  /**
   * 生成索引的 KV Key
   * 格式: index:{date}
   */
  private getIndexKey(date: string): string {
    return `${INDEX_PREFIX}:${date}`;
  }

  /**
   * 更新索引 - 将文章 ID 添加到对应日期的索引中
   */
  async addToIndex(date: string, source: SourceType, articleId: string): Promise<void> {
    const key = this.getIndexKey(date);

    try {
      const stored = await this.kv.get(key);
      const index: IndexEntry = stored ? JSON.parse(stored) as IndexEntry : {};

      if (!index[source]) {
        index[source] = [];
      }

      // 避免重复添加
      if (!index[source].includes(articleId)) {
        index[source].push(articleId);
      }

      await this.kv.put(key, JSON.stringify(index));
    } catch (error) {
      throw new AppError('KV_WRITE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取指定日期的索引
   */
  async getIndex(date: string): Promise<IndexEntry> {
    const key = this.getIndexKey(date);

    try {
      const stored = await this.kv.get(key);
      return stored ? JSON.parse(stored) as IndexEntry : {};
    } catch (error) {
      throw new AppError('KV_READ_FAILED', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取指定日期范围的所有索引
   */
  async getIndexRange(fromDate: string, toDate: string): Promise<Map<string, IndexEntry>> {
    const results = new Map<string, IndexEntry>();

    const from = new Date(fromDate);
    const to = new Date(toDate);

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const index = await this.getIndex(dateStr);
      results.set(dateStr, index);
    }

    return results;
  }

  // ===== 批量查询 =====

  /**
   * 获取指定日期范围的所有文章摘要
   */
  async getSummariesByDateRange(
    fromDate: string,
    toDate: string,
    sourceFilter?: SourceType
  ): Promise<ArticleSummary[]> {
    const indexes = await this.getIndexRange(fromDate, toDate);
    const summaries: ArticleSummary[] = [];

    for (const [date, index] of indexes) {
      const sources = sourceFilter ? [sourceFilter] : Object.keys(index) as SourceType[];

      for (const source of sources) {
        const ids = index[source] || [];

        for (const id of ids) {
          const summary = await this.getSummary(source, date, id);
          if (summary) {
            summaries.push(summary);
          }
        }
      }
    }

    // 按发布时间倒序排序
    return summaries.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  // ===== 数据清理 =====

  /**
   * 清理过期数据
   */
  async cleanupOldData(): Promise<{ deletedKeys: number; errors: string[] }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.historyDays);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const errors: string[] = [];
    let deletedKeys = 0;

    // 获取所有 KV Key（限制：在生产环境中可能需要分页处理）
    try {
      const list = await this.kv.list({ prefix: `${SUMMARY_PREFIX}:` });

      for (const key of list.keys) {
        // 从 key 中提取日期: summary:{source}:{date}:{id}
        const parts = key.name.split(':');
        if (parts.length >= 3) {
          const date = parts[2];
          if (date < cutoffStr) {
            try {
              await this.kv.delete(key.name);
              deletedKeys++;
            } catch (error) {
              errors.push(`Failed to delete ${key.name}: ${error}`);
            }
          }
        }
      }

      // 清理过期索引
      const indexList = await this.kv.list({ prefix: `${INDEX_PREFIX}:` });
      for (const key of indexList.keys) {
        const parts = key.name.split(':');
        if (parts.length >= 2) {
          const date = parts[1];
          if (date < cutoffStr) {
            try {
              await this.kv.delete(key.name);
              deletedKeys++;
            } catch (error) {
              errors.push(`Failed to delete ${key.name}: ${error}`);
            }
          }
        }
      }
    } catch (error) {
      errors.push(`List operation failed: ${error}`);
    }

    return { deletedKeys, errors };
  }

  // ===== 最后刷新时间 =====

  private readonly LAST_REFRESH_KEY = 'meta:last_refreshed_at';

  async setLastRefreshed(timestamp: string): Promise<void> {
    try {
      await this.kv.put(this.LAST_REFRESH_KEY, timestamp);
    } catch (error) {
      console.error('Failed to set last refreshed timestamp:', error);
    }
  }

  async getLastRefreshed(): Promise<string | null> {
    try {
      return await this.kv.get(this.LAST_REFRESH_KEY);
    } catch {
      return null;
    }
  }
}
