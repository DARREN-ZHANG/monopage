import type { SourceType } from '../types.js';

/**
 * 生成简单的哈希值（基于字符串内容）
 * 使用 FNV-1a 算法的简化版本
 */
function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  // 转换为 12 位十六进制字符串
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 12);
}

/**
 * 生成文章唯一 ID
 * 格式: {source}_{hash}
 * 示例: openai_a1b2c3d4e5f6
 *
 * @param source - 数据源类型
 * @param url - 文章 URL
 * @param title - 文章标题（备选）
 */
export function generateArticleId(source: SourceType, url: string, title?: string): string {
  const content = url || title || '';
  const hash = simpleHash(content);
  return `${source}_${hash}`;
}
