import { Article } from './types';
import { translateTitle } from './translator';
import { summarizeArticle } from './summarizer';

export function filterLast24Hours(articles: Article[]): Article[] {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return articles.filter((article) => article.pubDate >= oneDayAgo);
}

export function sortByTimeDesc(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export function extractSummary(description: string | undefined): string {
  return description ? description : '(暂无摘要)';
}

export function getUniqueSourceCount(articles: Article[]): number {
  const sources = new Set(articles.map((a) => a.source));
  return sources.size;
}

export async function generateMarkdown(articles: Article[]): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const uniqueSources = getUniqueSourceCount(articles);
  const statsEn = `**${articles.length}** articles from **${uniqueSources}** source(s)`;
  const statsZh = `共收录 **${articles.length}** 篇，来自 **${uniqueSources}** 个源`;

  let markdown = `# AI Daily Report\n`;
  markdown += `# AI 日报\n\n`;
  markdown += `**Generated**: ${dateStr}\n`;
  markdown += `**生成时间**: ${dateStr}\n\n`;
  markdown += `## 📊 Statistics\n`;
  markdown += `## 📊 统计\n\n`;
  markdown += `${statsEn}\n`;
  markdown += `${statsZh}\n\n`;
  markdown += `## 📰 Articles\n`;
  markdown += `## 📰 文章列表\n\n`;

  // 并发翻译所有标题和摘要
  const translatedTitles = await Promise.all(
    articles.map((article) => translateTitle(article.title))
  );

  const translatedDescriptions = await Promise.all(
    articles.map((article) => summarizeArticle(article.title, article.description))
  );

  articles.forEach((article, index) => {
    const time = article.pubDate.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const { en: titleEn, zh: titleZh } = translatedTitles[index];
    const { en: summaryEn, zh: summaryZh } = translatedDescriptions[index];
    markdown += `### ${index + 1}. [${titleEn}](${article.link})\n`;
    markdown += `### ${index + 1}. [${titleZh}](${article.link})\n\n`;
    markdown += `**Source**: ${article.source} | **Time**: ${time}\n`;
    markdown += `**来源**: ${article.source} | **时间**: ${time}\n\n`;
    markdown += `> ${summaryEn}\n`;
    markdown += `> ${summaryZh}\n\n`;
  });

  return markdown;
}

export function getOutputFilename(): string {
  const now = new Date();
  const dateStr = now
    .toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '-');
  return `ai-daily-${dateStr}.md`;
}
