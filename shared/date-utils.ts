/**
 * 统一的日期格式工具
 * 确保所有日报使用 UTC ISO 格式 (YYYY-MM-DD)
 */

export function getUTCDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function getReportFilename(prefix: string, date: Date = new Date()): string {
  const dateStr = getUTCDateString(date);
  return `${prefix}-${dateStr}`;
}
