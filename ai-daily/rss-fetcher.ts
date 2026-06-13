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

function parseDescription(desc: string | undefined): string {
  if (!desc) return '';
  // 移除HTML标签
  const text = desc.replace(/<[^>]*>/g, '');
  // 解码HTML实体
  const decoded = text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

  // 提取前100个单词/词语
  // 英文单词按空格分割，中文按字符计数
  const words = decoded.split(/\s+/);
  let result = '';
  let wordCount = 0;

  for (const word of words) {
    if (wordCount >= 100) break;

    // 计算这个word中的词语数量
    // 英文单词算1个，中文字符也算1个
    let unitCount = 0;
    let i = 0;
    while (i < word.length) {
      const char = word[i];
      // 检查是否是中文字符
      if (/[一-鿿]/.test(char)) {
        // 中文字符，算1个词
        unitCount += 1;
        i += 1;
      } else if (/[a-zA-Z]/.test(char)) {
        // 英文字母开头，提取整个单词
        let englishWord = '';
        while (i < word.length && /[a-zA-Z0-9]/.test(word[i])) {
          englishWord += word[i];
          i += 1;
        }
        unitCount += 1;
      } else {
        // 其他字符跳过
        i += 1;
      }
    }

    if (wordCount + unitCount <= 100) {
      result += (result ? ' ' : '') + word;
      wordCount += unitCount;
    } else {
      // 超过100个词，需要截断
      const remaining = 100 - wordCount;
      let partial = '';
      let count = 0;
      for (const char of word) {
        if (count >= remaining) break;
        partial += char;
        if (/[一-鿿]/.test(char)) {
          count += 1;
        } else if (/[a-zA-Z0-9]/.test(char)) {
          // 检查是否是单词的最后一个字母
          const nextChar = word[word.indexOf(char) + 1];
          if (!nextChar || !/[a-zA-Z0-9]/.test(nextChar)) {
            count += 1;
          }
        }
      }
      result += (result ? ' ' : '') + partial;
      break;
    }
  }

  // 如果内容被截断了，添加省略号
  if (wordCount >= 100 || result.length < decoded.length) {
    result += ' ……';
  }

  return result.trim();
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
