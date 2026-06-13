import { XMLParser } from 'fast-xml-parser';
import { Article, FetchResult } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: true,
});

async function fetchXML(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.text();
}

function truncateAtSentence(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const sentenceEnd = truncated.match(/.*[.!?。！？]/s);
  if (sentenceEnd && sentenceEnd[0].length > maxLen * 0.4) {
    return sentenceEnd[0].trimEnd() + '……';
  }
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.4) {
    return truncated.slice(0, lastSpace).trimEnd() + '……';
  }
  return truncated.trimEnd() + '……';
}

function parseDescription(desc: string | undefined): string {
  if (!desc) return '';
  const text = desc.replace(/<[^>]*>/g, '');
  const decoded = text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

  return truncateAtSentence(decoded.replace(/\s+/g, ' ').trim(), 300);
}

function parseDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  return new Date(dateStr);
}

async function fetchTechCrunch(): Promise<FetchResult> {
  try {
    const xml = await fetchXML('https://techcrunch.com/category/artificial-intelligence/feed/');
    const parsed = parser.parse(xml);
    const items = parsed.rss?.channel?.item || [];
    const articles: Article[] = (Array.isArray(items) ? items : [items])
      .map((item: any) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: parseDate(item.pubDate),
        source: 'TechCrunch' as const,
        description: parseDescription(item.description),
      }));
    return { articles };
  } catch (error) {
    return {
      articles: [],
      error: `TechCrunch error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function fetchTheVerge(): Promise<FetchResult> {
  try {
    const xml = await fetchXML('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml');
    const parsed = parser.parse(xml);
    const items = parsed.rss?.channel?.item || [];
    const articles: Article[] = (Array.isArray(items) ? items : [items])
      .map((item: any) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: parseDate(item.pubDate),
        source: 'The Verge' as const,
        description: parseDescription(item.description),
      }));
    return { articles };
  } catch (error) {
    return {
      articles: [],
      error: `The Verge error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function fetchHackerNews(): Promise<FetchResult> {
  try {
    const xml = await fetchXML('https://hnrss.org/newest?q=AI&count=30');
    const parsed = parser.parse(xml);
    const items = parsed.rss?.channel?.item || [];
    const articles: Article[] = (Array.isArray(items) ? items : [items])
      .map((item: any) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: parseDate(item.pubDate),
        source: 'Hacker News' as const,
        description: parseDescription(item.description),
      }));
    return { articles };
  } catch (error) {
    return {
      articles: [],
      error: `Hacker News error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function fetchAllSources(): Promise<{ articles: Article[]; errors: string[] }> {
  const results = await Promise.allSettled([
    fetchTechCrunch(),
    fetchTheVerge(),
    fetchHackerNews(),
  ]);

  const articles: Article[] = [];
  const errors: string[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      articles.push(...result.value.articles);
      if (result.value.error) {
        errors.push(result.value.error);
      }
    } else {
      errors.push(`Fetch failed: ${result.reason}`);
    }
  });

  return { articles, errors };
}
