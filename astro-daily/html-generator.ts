import { mkdir, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Article } from './types';
import { formatDateUTC } from './article-utils';
import { translateTitle, translateDescription } from './translator';

export async function generateHtmlReport(articles: Article[]): Promise<string> {
  const now = new Date();
  const dateStr = formatDateUTC(now);

  const uniqueSources = new Set(articles.map((a) => a.source)).size;

  // 翻译所有标题和摘要
  const translatedTitles = await Promise.all(
    articles.map((article) => translateTitle(article.title))
  );

  const translatedDescriptions = await Promise.all(
    articles.map((article) => translateDescription(article.description))
  );

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Astronomy Daily Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }

        .header .date {
            margin-top: 15px;
            font-size: 0.95em;
            opacity: 0.8;
        }

        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            padding: 30px 40px;
            background: #f0f4ff;
            border-bottom: 1px solid #d0d8ff;
        }

        .stat-item {
            text-align: center;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .stat-label {
            color: #666;
            margin-top: 8px;
            font-size: 0.95em;
        }

        .content {
            padding: 40px;
        }

        .article {
            margin-bottom: 35px;
            padding-bottom: 30px;
            border-bottom: 1px solid #e0e0e0;
        }

        .article:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        .article-number {
            font-weight: bold;
            color: #1e3c72;
            font-size: 0.95em;
            margin-bottom: 8px;
        }

        .article-title {
            font-size: 1.3em;
            font-weight: bold;
            margin-bottom: 8px;
            line-height: 1.4;
        }

        .article-title a {
            color: #1e3c72;
            text-decoration: none;
            transition: color 0.3s;
        }

        .article-title a:hover {
            color: #2a5298;
            text-decoration: underline;
        }

        .article-title.en {
            font-size: 1.2em;
            color: #333;
        }

        .article-title.zh {
            font-size: 1.1em;
            color: #666;
            font-weight: normal;
            margin-bottom: 12px;
        }

        .article-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 15px;
            font-size: 0.9em;
            color: #666;
        }

        .article-summary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 15px;
        }

        .summary-block {
            padding: 12px;
            background: #f8f9ff;
            border-left: 3px solid #1e3c72;
            border-radius: 4px;
            line-height: 1.6;
            font-size: 0.95em;
            color: #333;
        }

        .summary-block.zh {
            border-left-color: #2a5298;
        }

        .footer {
            text-align: center;
            padding: 20px 40px;
            background: #f8f9ff;
            color: #666;
            font-size: 0.9em;
        }

        @media (max-width: 768px) {
            .stats {
                grid-template-columns: 1fr;
            }

            .article-meta,
            .article-summary {
                grid-template-columns: 1fr;
            }

            .header h1 {
                font-size: 1.8em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔭 Astronomy Daily Report</h1>
            <div class="subtitle">🌌 天文日报</div>
            <div class="date">Generated (UTC): ${dateStr}</div>
        </div>

        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${articles.length}</div>
                <div class="stat-label">Articles / 篇文章</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${uniqueSources}</div>
                <div class="stat-label">Sources / 个源</div>
            </div>
        </div>

        <div class="content">
`;

  articles.forEach((article, index) => {
    const timeUTC = formatDateUTC(article.pubDate);
    const { en: titleEn, zh: titleZh } = translatedTitles[index];
    const { en: summaryEn, zh: summaryZh } = translatedDescriptions[index];

    html += `            <div class="article">
                <div class="article-number">${index + 1}.</div>
                <div class="article-title en"><a href="${article.link}" target="_blank">${titleEn}</a></div>
                <div class="article-title zh">${titleZh}</div>
                <div class="article-meta">
                    <div><strong>Source:</strong> ${article.source} | <strong>Time (UTC):</strong> ${timeUTC}</div>
                    <div><strong>来源:</strong> ${article.source} | <strong>时间 (UTC):</strong> ${timeUTC}</div>
                </div>
                <div class="article-summary">
                    <div class="summary-block en">${summaryEn}</div>
                    <div class="summary-block zh">${summaryZh}</div>
                </div>
            </div>
`;
  });

  html += `        </div>

        <div class="footer">
            <p>🔭 Powered by Astronomy Daily Report Generator | 由天文日报生成器提供</p>
        </div>
    </div>
</body>
</html>`;

  return html;
}

export async function saveHtmlReport(html: string): Promise<string> {
  const outputDir = join(process.cwd(), 'output');
  await mkdir(outputDir, { recursive: true });

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const filename = `astro-daily-${dateStr}.html`;
  const filepath = join(outputDir, filename);
  await writeFile(filepath, html, 'utf-8');

  return filepath;
}

export async function generateIndexPage(): Promise<string> {
  const outputDir = join(process.cwd(), 'output');

  try {
    const files = await readdir(outputDir);
    const reportFiles = files
      .filter((f) => f.startsWith('astro-daily-') && f.endsWith('.html') && f !== 'index.html')
      .sort()
      .reverse();

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Astronomy Daily Reports</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2em;
            margin-bottom: 10px;
        }

        .header p {
            opacity: 0.9;
        }

        .content {
            padding: 40px;
        }

        .report-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .report-item {
            padding: 15px 20px;
            background: #f0f4ff;
            border-left: 4px solid #1e3c72;
            border-radius: 6px;
            transition: all 0.3s;
            text-decoration: none;
            color: inherit;
        }

        .report-item:hover {
            background: #e0e8ff;
            border-left-color: #2a5298;
            transform: translateX(5px);
        }

        .report-item .date {
            font-weight: bold;
            color: #1e3c72;
            margin-bottom: 5px;
        }

        .report-item .status {
            font-size: 0.9em;
            color: #999;
        }

        .empty {
            text-align: center;
            color: #999;
            padding: 40px 20px;
        }

        .back-link {
            display: inline-block;
            margin-top: 20px;
            color: #1e3c72;
            text-decoration: none;
            transition: color 0.3s;
        }

        .back-link:hover {
            color: #2a5298;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📰 Astronomy Daily Reports</h1>
            <p>🔭 天文日报列表</p>
        </div>

        <div class="content">
`;

    if (reportFiles.length === 0) {
      html += `            <div class="empty">
                <p>暂无日报，请先运行生成器。</p>
            </div>
`;
    } else {
      html += `            <div class="report-list">
`;
      reportFiles.forEach((file) => {
        const match = file.match(/astro-daily-(\d{4}-\d{2}-\d{2})/);
        const date = match ? match[1] : file;

        html += `                <a href="./${file}" class="report-item">
                    <div class="date">📅 ${date}</div>
                    <div class="status">点击查看完整日报 →</div>
                </a>
`;
      });
      html += `            </div>
`;
    }

    html += `            <a href="../" class="back-link">← 返回首页</a>
        </div>
    </div>
</body>
</html>`;

    return html;
  } catch (error) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Error</title>
</head>
<body>
    <p>Error generating index: ${error instanceof Error ? error.message : String(error)}</p>
</body>
</html>`;
  }
}
