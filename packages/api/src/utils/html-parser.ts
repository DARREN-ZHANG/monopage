/**
 * 通用 HTML 解析工具
 * 用于从 HTML 内容中提取文本和日期信息
 */

/**
 * 清理 HTML 标签，保留纯文本
 */
export function cleanHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 解析 HTML 实体
 */
export function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 灵活解析多种日期格式
 * 支持: ISO (2024-03-15), RFC 2822 (March 15, 2024), 中文日期 (2024年3月15日)
 */
export function parseDateFlexible(dateStr: string): Date | null {
  const trimmed = dateStr.trim();

  // 尝试 ISO 格式: 2024-03-15 或 2024-03-15T10:30:00
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 尝试中文日期格式: 2024年3月15日
  const chineseMatch = trimmed.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (chineseMatch) {
    const year = parseInt(chineseMatch[1], 10);
    const month = parseInt(chineseMatch[2], 10) - 1;
    const day = parseInt(chineseMatch[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 尝试英文月份格式: March 15, 2024 或 March 15 2024
  const englishMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (englishMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 尝试反向英文格式: 15 March 2024
  const reverseMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (reverseMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 最后尝试直接解析
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
}

/**
 * 从 HTML 片段提取属性值
 */
export function extractAttribute(html: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

/**
 * 从 HTML 片段提取 datetime 属性
 */
export function extractDatetime(html: string): Date | null {
  const datetimeAttr = extractAttribute(html, 'datetime');
  if (datetimeAttr) {
    return parseDateFlexible(datetimeAttr);
  }
  return null;
}
