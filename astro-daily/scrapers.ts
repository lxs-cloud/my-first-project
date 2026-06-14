import { load } from 'cheerio';
import { Article, ScrapResult } from './types';

// 多个User-Agent轮流使用，避免被检测为爬虫
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

let userAgentIndex = 0;

function getRandomUserAgent(): string {
  const ua = USER_AGENTS[userAgentIndex];
  userAgentIndex = (userAgentIndex + 1) % USER_AGENTS.length;
  return ua;
}

async function fetchPage(url: string, timeout = 15000): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': new URL(url).origin,
      'DNT': '1',
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();

  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;

  const patterns = [
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };

      if (match[2]?.match(/\D/)) {
        const month = months[match[2].toLowerCase().slice(0, 3)];
        return new Date(parseInt(match[3]), month, parseInt(match[1]));
      } else if (match.length === 4) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      }
    }
  }

  return new Date();
}

// 清理标题，移除垃圾内容
function cleanTitle(title: string): string {
  if (!title) return '';

  // 移除常见的导航词和菜单项
  const cleanedTitle = title
    .replace(/^(首页|主页|导航|菜单|返回|返回首页|回到首页|TOP|主导航|副导航)/i, '')
    .replace(/(专题|分类|标签|档案|搜索|订阅|RSS|订阅本站|关注我们|联系我们|关于|使用条款|隐私|服务条款|免责声明).*$/i, '')
    .trim();

  // 只保留有意义的标题（通常包含数字或实际内容）
  if (cleanedTitle.length < 3 || /^[界面UI|菜单|按钮|链接]/.test(cleanedTitle)) {
    return '';
  }

  return cleanedTitle;
}

// 验证链接是否有效（排除锚点、javascript、菜单链接）
function isValidLink(link: string): boolean {
  if (!link) return false;

  const invalidPatterns = [
    /^#/,                    // 锚点
    /^javascript:/i,         // javascript协议
    /\/(nav|menu|search|tag|category|archive|about|contact)/i,  // 导航/菜单/搜索等
    /\/(home|index|default)\.html?$/i,  // 主页
  ];

  return !invalidPatterns.some(pattern => pattern.test(link));
}

export async function scrapeArXiv(): Promise<ScrapResult> {
  try {
    const html = await fetchPage('https://arxiv.org/list/astro-ph/new');
    const $ = load(html);
    const articles: Article[] = [];

    $('dt').each((i, elem) => {
      if (articles.length >= 20) return;
      const $elem = $(elem);
      const $next = $elem.next();
      const titleElem = $next.find('div.list-title');
      const title = titleElem.text().replace(/^Title:\s*/, '').trim();
      const linkElem = $next.find('a[title="Abstract"]');
      const link = linkElem.attr('href') ? `https://arxiv.org${linkElem.attr('href')}` : '';
      const dateStr = $elem.find('.list-dateline').text();
      const desc = $next.find('div.list-authors').text().slice(0, 200);

      if (title && link) {
        articles.push({ title, link, pubDate: parseDate(dateStr), source: 'arXiv', description: desc || title });
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `arXiv: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeESO(): Promise<ScrapResult> {
  try {
    const html = await fetchPage('https://www.eso.org/public/news/');
    const $ = load(html);
    const articles: Article[] = [];

    $('article, .news-item, div.news, .press-release').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);
      const titleLink = $elem.find('h2 a, h3 a, .news-title a').first();
      const title = titleLink.text().trim();
      const link = titleLink.attr('href');
      const dateStr = $elem.find('.release-date, .date, time').first().text().trim();
      const desc = $elem.find('p, .description').first().text().slice(0, 200);

      if (title && link) {
        articles.push({ title, link: link.startsWith('http') ? link : `https://www.eso.org${link}`, pubDate: parseDate(dateStr), source: 'ESO', description: desc || title });
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `ESO: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeNASANEA(): Promise<ScrapResult> {
  try {
    // NASA NEA 增加超时到20秒
    const html = await fetchPage('https://exoplanetarchive.ipac.caltech.edu/docs/exonews_archive.html', 20000);
    const $ = load(html);
    const articles: Article[] = [];

    // 尝试多个选择器找到新闻项
    $('tr, div.news-item, article, .news').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);
      const cells = $elem.find('td');

      // 如果是表格行，尝试提取
      if (cells.length >= 3) {
        const dateStr = $(cells[0]).text().trim();
        const titleLink = $(cells[1]).find('a');
        const title = titleLink.text().trim();
        const link = titleLink.attr('href') || '';
        const desc = $(cells[2]).text().slice(0, 200);

        if (title && link && title.length > 3) {
          articles.push({
            title,
            link: link.startsWith('http') ? link : `https://exoplanetarchive.ipac.caltech.edu${link}`,
            pubDate: parseDate(dateStr),
            source: 'NASA NEA',
            description: desc || title,
          });
        }
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `NASA NEA: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeAPOD(): Promise<ScrapResult> {
  try {
    const html = await fetchPage('https://apod.nasa.gov/apod/');
    const $ = load(html);
    const articles: Article[] = [];

    // APOD 页面结构：标题在 center > b 标签中（非 "Explanation:" 和 "Image Credit:" 开头的）
    // 导航链接 < 和 > 应被排除
    const allBolds = $('center b');
    let title = '';

    allBolds.each((i, elem) => {
      const text = $(elem).text().trim();
      // 标题是不以 "Explanation"、"Image Credit"、"Credit" 开头的 bold 文本
      // 且不是空的，也不是网站标题 "Astronomy Picture of the Day"
      if (
        text &&
        !text.startsWith('Explanation') &&
        !text.startsWith('Image Credit') &&
        !text.startsWith('Credit') &&
        !text.startsWith('Astronomy Picture of the Day') &&
        text.length > 1 &&
        text.length < 200
      ) {
        if (!title) title = text;
      }
    });

    if (!title) {
      title = 'Astronomy Picture of the Day';
    }

    // 获取 Explanation 作为描述
    const bodyText = $('body').text();
    const explanationMatch = bodyText.match(/Explanation:\s*([\s\S]*?)(?:Tomorrow's picture:|$)/);
    const description = explanationMatch
      ? explanationMatch[1].trim().replace(/\s+/g, ' ').slice(0, 300)
      : title;

    articles.push({
      title,
      link: 'https://apod.nasa.gov/apod/',
      pubDate: new Date(),
      source: 'APOD',
      description,
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `APOD: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeNADC(): Promise<ScrapResult> {
  try {
    const html = await fetchPage('https://nadc.china-vo.org/');
    const $ = load(html);
    const articles: Article[] = [];

    // NADC 的实际新闻在 "新闻动态" 板块下面
    // 排除导航菜单项 (href="#") 和纯导航文本
    const navTexts = new Set([
      '公众频道', '科学数据', '专题服务', '云资源', '申请观测',
      '数据检索', '数据汇交', '数据目录', '万维望远镜',
      '公众超新星搜寻', '日食计算器', '天文学名词', '软件工具',
      '天文文献检索', '天文会议系统', '论文数据贮藏库',
      'NADC活动', 'ESASky', '科普专题', '全民科学',
      // 分类栏目标题（非具体文章）
      'NADC动态', '科研成果', '服务案例', '合作交流', '技术动态',
      '数据发布', '会议培训', '媒体报道',
    ]);

    $('div.news-item, div.announcement, .news-list a, .news h5 a, article a, .article-list a').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);

      // 如果是 a 标签直接处理
      let titleLink = $elem.is('a') ? $elem : $elem.find('a').first();
      const title = titleLink.text().trim();
      const link = titleLink.attr('href') || '';

      // 排除无效链接：锚点链接、导航菜单文字、过短标题、分类索引页
      if (!title || title.length <= 3) return;
      if (link === '#' || link.startsWith('#')) return;
      if (navTexts.has(title)) return;
      if (!isValidLink(link)) return;
      // 排除分类索引页面（如 /article/index?catalog=...），这些是栏目标题不是文章
      if (/\/article\/index\?/.test(link)) return;

      const dateStr = $elem.find('.date, .time, time, .published').text();
      const desc = $elem.find('p').first().text().slice(0, 200);

      articles.push({
        title,
        link: link.startsWith('http') ? link : `https://nadc.china-vo.org${link}`,
        pubDate: parseDate(dateStr),
        source: 'NADC',
        description: desc || title,
      });
    });

    // 如果上面的选择器没找到内容，尝试抓取 /article 页面
    if (articles.length === 0) {
      try {
        const articleHtml = await fetchPage('https://nadc.china-vo.org/article/', 15000);
        const $article = load(articleHtml);

        $article('a[href*="/article/"]').each((i, elem) => {
          if (articles.length >= 15) return;
          const $elem = $article(elem);
          const title = $elem.text().trim();
          const link = $elem.attr('href') || '';

          if (!title || title.length <= 3) return;
          if (link === '#' || link.startsWith('#')) return;
          if (navTexts.has(title)) return;

          articles.push({
            title,
            link: link.startsWith('http') ? link : `https://nadc.china-vo.org${link}`,
            pubDate: new Date(),
            source: 'NADC',
            description: title,
          });
        });
      } catch {
        // /article 页面也可能失败，忽略
      }
    }

    return { articles };
  } catch (error) {
    return { articles: [], error: `NADC: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeESA(): Promise<ScrapResult> {
  try {
    // ESA新闻页面 - 尝试正确的URL
    const html = await fetchPage('https://www.esa.int/Science_Exploration/Space_Science/News', 15000);
    const $ = load(html);
    const articles: Article[] = [];

    // 更广泛的选择器
    $('article, .news-item, div[class*="news"], div[class*="article"], li[class*="news"]').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);

      // 尝试多个标题选择器
      const titleLink = $elem.find('h2 a, h3 a, h4 a, .title a, a[href*="/news"], a[href*="/article"]').first();
      const title = titleLink.text().trim();
      const link = titleLink.attr('href');

      // 尝试多个日期选择器
      const dateStr = $elem.find('time').attr('datetime') ||
                      $elem.find('.date, .published, [class*="date"]').first().text() ||
                      $elem.find('span').first().text();

      const desc = $elem.find('p, .description, .summary').first().text().slice(0, 200);

      if (title && link && title.length > 3) {
        articles.push({
          title,
          link: link?.startsWith('http') ? link : `https://www.esa.int${link}`,
          pubDate: parseDate(dateStr),
          source: 'ESA',
          description: desc || title,
        });
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `ESA: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeHubbleSite(): Promise<ScrapResult> {
  try {
    const html = await fetchPage('https://hubblesite.org/news_release/news');
    const $ = load(html);
    const articles: Article[] = [];

    $('div.news-item, article, .release-item, li').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);
      const titleLink = $elem.find('a.news-link, h2 a, h3 a, .title a').first();
      const title = titleLink.text().trim();
      const link = titleLink.attr('href');
      const dateStr = $elem.find('time').text() || $elem.find('.date, .published').text();
      const desc = $elem.find('p').first().text().slice(0, 200);

      if (title && link && title.length > 3) {
        articles.push({ title, link: link?.startsWith('http') ? link : `https://hubblesite.org${link}`, pubDate: parseDate(dateStr), source: 'HubbleSite', description: desc || title });
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `HubbleSite: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeAstrobites(): Promise<ScrapResult> {
  try {
    // Astrobites - 添加更好的请求头规避403
    const html = await fetchPage('https://astrobites.org/', 15000);
    const $ = load(html);
    const articles: Article[] = [];

    $('article, .post, div.article-item, .content-item, .entry-summary').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);

      // 更多的标题选择器
      const titleLink = $elem.find('h2 a, h3 a, h1 a, .title a, a.post-link, .entry-title a').first();
      const title = titleLink.text().trim();
      const link = titleLink.attr('href');

      const dateStr = $elem.find('time').attr('datetime') ||
                      $elem.find('.posted-on, .date, .published, [class*="time"]').first().text();
      const desc = $elem.find('p, .summary, .description').first().text().slice(0, 200);

      if (title && link && title.length > 3) {
        articles.push({
          title,
          link: link?.startsWith('http') ? link : `https://astrobites.org${link}`,
          pubDate: parseDate(dateStr),
          source: 'Astrobites',
          description: desc || title,
        });
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `Astrobites: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeSkyScopeTelescope(): Promise<ScrapResult> {
  try {
    // Sky & Telescope - 添加更好的请求头规避403
    const html = await fetchPage('https://skyandtelescope.org/astronomy-news/', 15000);
    const $ = load(html);
    const articles: Article[] = [];

    $('article, .article-card, div[class*="article"], .news-item, .post-item').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);

      // 更多的标题选择器
      const titleLink = $elem.find('h2 a, h3 a, h1 a, a.article-link, .title a, .headline a').first();
      const title = titleLink.text().trim();
      const link = titleLink.attr('href');

      const dateStr = $elem.find('time').attr('datetime') ||
                      $elem.find('.publish-date, .date, [class*="time"]').first().text();
      const desc = $elem.find('p, .description, .summary').first().text().slice(0, 200);

      if (title && link && title.length > 3) {
        articles.push({
          title,
          link: link?.startsWith('http') ? link : `https://skyandtelescope.org${link}`,
          pubDate: parseDate(dateStr),
          source: 'Sky & Telescope',
          description: desc || title,
        });
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `Sky & Telescope: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeChineseMeteorological(): Promise<ScrapResult> {
  try {
    const html = await fetchPage('https://www.cmse.gov.cn/');
    const $ = load(html);
    const articles: Article[] = [];

    $('article, .news-item, div[class*="news"], li[class*="news"], .article-item').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);
      const titleLink = $elem.find('a').first();
      const title = titleLink.text().trim();
      const link = titleLink.attr('href');
      const dateStr = $elem.find('.date, .time, time, [class*="time"]').text();
      const desc = $elem.find('p').first().text().slice(0, 200);

      if (title && link && title.length > 5) {
        articles.push({ title, link: link?.startsWith('http') ? link : `https://www.cmse.gov.cn${link}`, pubDate: parseDate(dateStr), source: 'CMSE', description: desc || title });
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `CMSE: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeSkywatcher(): Promise<ScrapResult> {
  try {
    // SkyWatcher - 使用正确的URL
    const html = await fetchPage('https://www.skywatcher.com/explore/news', 15000);
    const $ = load(html);
    const articles: Article[] = [];

    $('article, .post, .article, .news-item, .article-item, [class*="news"]').each((i, elem) => {
      if (articles.length >= 15) return;
      const $elem = $(elem);

      // 更多的标题选择器
      const titleLink = $elem.find('h2 a, h3 a, h1 a, .title a, a.post-link, .headline a').first();
      const title = titleLink.text().trim();
      const link = titleLink.attr('href');

      const dateStr = $elem.find('time, .date, .posted, [class*="time"]').first().text();
      const desc = $elem.find('p, .description, .summary').first().text().slice(0, 200);

      if (title && link && title.length > 5) {
        articles.push({
          title,
          link: link?.startsWith('http') ? link : `https://www.skywatcher.com${link}`,
          pubDate: parseDate(dateStr),
          source: 'SkyWatcher',
          description: desc || title,
        });
      }
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `SkyWatcher: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const MONTH_MAP: Record<string, string> = {
  'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
  'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
  'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December',
};

function formatEclipseTitle(title: string): string {
  const match = title.match(/^(.+?)\s+(\d{4})\s+(\w{3})\s+(\d{1,2})$/);
  if (!match) return title;
  const [, type, year, monthAbbr, day] = match;
  const month = MONTH_MAP[monthAbbr] || monthAbbr;
  return `${type} of ${month} ${parseInt(day)}, ${year}`;
}

export async function scrapeEclipsewise(): Promise<ScrapResult> {
  try {
    // EclipseWise 是一个日食/月食参考网站，没有新闻频道
    // 只抓取即将发生的日/月食事件（链接含 SEprime 或 LEprime 且年份 >= 当前年）
    const html = await fetchPage('https://www.eclipsewise.com/', 15000);
    const $ = load(html);
    const articles: Article[] = [];
    const currentYear = new Date().getFullYear();
    const seen = new Set<string>();

    // 只抓取日/月食事件页面链接
    $('a[href*="prime"]').each((i, elem) => {
      if (articles.length >= 5) return; // 限制数量，这些不是新闻
      const $elem = $(elem);
      const title = $elem.text().trim();
      let link = $elem.attr('href') || '';

      if (!title || title.length <= 5) return;
      // 只保留 Solar/Lunar Eclipse 事件
      if (!/eclipse/i.test(title)) return;
      // 排除过去的事件（年份低于当前年）
      const yearMatch = title.match(/(\d{4})/);
      if (yearMatch && parseInt(yearMatch[1]) < currentYear) return;
      // 去重
      if (seen.has(title)) return;
      seen.add(title);

      // 正确拼接 URL（eclipsewise 的相对链接需要加 /）
      if (!link.startsWith('http')) {
        link = link.startsWith('/') ? `https://www.eclipsewise.com${link}` : `https://www.eclipsewise.com/${link}`;
      }

      const cleanTitle = formatEclipseTitle(title.replace(/\s+/g, ' '));

      // 提取真实日期 (e.g., "2027 Feb 06" -> Date)
      const dateMatch = title.match(/(\d{4})\s+(\w{3})\s+(\d{1,2})/);
      let pubDate = new Date();
      if (dateMatch) {
        const monthMap: Record<string, number> = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11,
        };
        const [, year, month, day] = dateMatch;
        pubDate = new Date(parseInt(year), monthMap[month], parseInt(day));
      }

      articles.push({
        title: cleanTitle,
        link,
        pubDate,
        source: 'EclipseWise',
        description: `Upcoming eclipse event: ${cleanTitle}`,
      });
    });

    return { articles };
  } catch (error) {
    return { articles: [], error: `EclipseWise: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function scrapeAllSources(): Promise<{ articles: Article[]; errors: string[] }> {
  const results = await Promise.allSettled([
    scrapeArXiv(),
    scrapeESO(),
    scrapeNASANEA(),
    scrapeAPOD(),
    scrapeNADC(),
    scrapeESA(),
    scrapeHubbleSite(),
    scrapeAstrobites(),
    scrapeSkyScopeTelescope(),
    scrapeChineseMeteorological(),
    scrapeSkywatcher(),
    scrapeEclipsewise(),
  ]);

  const articles: Article[] = [];
  const errors: string[] = [];
  const seenUrls = new Set<string>();

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      // 基于URL去重
      for (const article of result.value.articles) {
        if (!seenUrls.has(article.link)) {
          seenUrls.add(article.link);
          articles.push(article);
        }
      }
      if (result.value.error) {
        errors.push(result.value.error);
      }
    } else {
      errors.push(`Scrap failed: ${result.reason}`);
    }
  });

  return { articles, errors };
}
