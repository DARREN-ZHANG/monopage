import type { SourceType } from '../types.js';

/**
 * 生成 64-bit FNV-1a 哈希值（BigInt）
 * 相比 32-bit 版本碰撞概率显著降低
 */
function simpleHash(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const fnvPrime = 0x100000001b3n;
  const mod64 = 0xffffffffffffffffn;

  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * fnvPrime) & mod64;
  }

  // 输出 12 位十六进制字符串，兼顾稳定性与长度
  return hash.toString(16).padStart(16, '0').slice(0, 12);
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
  const content = `${source}|${url || ''}|${title || ''}`;
  const hash = simpleHash(content);
  return `${source}_${hash}`;
}
