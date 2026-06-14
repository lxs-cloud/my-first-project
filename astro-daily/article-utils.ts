import { Article } from './types';
import { translateDescription, translateTitle } from './translator';
import { getReportFilename } from './date-utils';

export function filterLast24Hours(articles: Article[]): Article[] {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return articles.filter((article) => article.pubDate >= oneDayAgo);
}

export function sortByTimeDesc(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export function getUniqueSourceCount(articles: Article[]): number {
  const sources = new Set(articles.map((a) => a.source));
  return sources.size;
}

export function formatDateUTC(date: Date): string {
  return date.toISOString().split('T')[0] + ' ' + date.toUTCString().split(' ')[4];
}

export async function generateMarkdown(articles: Article[]): Promise<string> {
  const now = new Date();
  const dateStr = formatDateUTC(now);

  const uniqueSources = getUniqueSourceCount(articles);
  const statsEn = `**${articles.length}** articles from **${uniqueSources}** source(s)`;
  const statsZh = `共收录 **${articles.length}** 篇，来自 **${uniqueSources}** 个源`;

  let markdown = `# Astronomy Daily Report\n`;
  markdown += `# 天文日报\n\n`;
  markdown += `**Generated (UTC)**: ${dateStr}\n`;
  markdown += `**生成时间 (UTC)**: ${dateStr}\n\n`;
  markdown += `## 📊 Statistics\n`;
  markdown += `## 📊 统计\n\n`;
  markdown += `${statsEn}\n`;
  markdown += `${statsZh}\n\n`;
  markdown += `## 📰 Articles\n`;
  markdown += `## 📰 文章列表\n\n`;

  // 翻译所有标题和摘要
  const translatedTitles = await Promise.all(
    articles.map((article) => translateTitle(article.title))
  );

  const translatedDescriptions = await Promise.all(
    articles.map((article) => translateDescription(article.description))
  );

  articles.forEach((article, index) => {
    const timeUTC = formatDateUTC(article.pubDate);
    const { en: titleEn, zh: titleZh } = translatedTitles[index];
    const { en: summaryEn, zh: summaryZh } = translatedDescriptions[index];

    markdown += `### ${index + 1}. [${titleEn}](${article.link})\n`;
    markdown += `### ${index + 1}. [${titleZh}](${article.link})\n\n`;
    markdown += `**Source**: ${article.source} | **Time (UTC)**: ${timeUTC}\n`;
    markdown += `**来源**: ${article.source} | **时间 (UTC)**: ${timeUTC}\n\n`;
    markdown += `> ${summaryEn}\n`;
    markdown += `> ${summaryZh}\n\n`;
  });

  return markdown;
}

export function getOutputFilename(): string {
  return getReportFilename('astro-daily') + '.md';
}
