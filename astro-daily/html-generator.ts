import { mkdir, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Article } from './types';
import { formatDateUTC } from './article-utils';
import { translateTitle, translateDescription } from './translator';
import { getReportFilename } from './date-utils';

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
    <title>Astronomy Daily Report - ${dateStr.split(' ')[0]}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #0a0e1a;
            min-height: 100vh;
            padding: 40px 20px;
            color: #e2e8f0;
        }

        .stars {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;
        }
        .stars::before, .stars::after {
            content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-image:
                radial-gradient(1px 1px at 50px 80px, rgba(255,255,255,0.7), transparent),
                radial-gradient(1px 1px at 150px 40px, rgba(255,255,255,0.5), transparent),
                radial-gradient(1.5px 1.5px at 250px 200px, rgba(255,255,255,0.8), transparent),
                radial-gradient(1px 1px at 350px 120px, rgba(255,255,255,0.6), transparent),
                radial-gradient(1px 1px at 450px 300px, rgba(255,255,255,0.5), transparent),
                radial-gradient(1.5px 1.5px at 550px 60px, rgba(255,255,255,0.7), transparent),
                radial-gradient(1px 1px at 650px 250px, rgba(255,255,255,0.6), transparent);
            background-size: 700px 400px;
            animation: twinkle 4s ease-in-out infinite alternate;
        }
        .stars::after { background-size: 500px 300px; animation-delay: 2s; opacity: 0.5; }
        @keyframes twinkle { 0% { opacity: 0.4; } 100% { opacity: 1; } }

        .container {
            max-width: 900px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        .header {
            text-align: center;
            padding: 40px 20px 30px;
        }

        .header h1 {
            font-size: 2.2em;
            color: #e2e8f0;
            margin-bottom: 8px;
        }

        .header .subtitle {
            font-size: 1.1em;
            color: #7dd3fc;
            opacity: 0.9;
        }

        .header .date {
            margin-top: 12px;
            font-size: 0.9em;
            color: #64748b;
        }

        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            padding: 20px;
            margin-bottom: 24px;
        }

        .stat-item {
            text-align: center;
            background: rgba(15, 23, 42, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 20px;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #38bdf8;
        }

        .stat-label {
            color: #94a3b8;
            margin-top: 6px;
            font-size: 0.85em;
        }

        .content {
            padding: 0 20px;
        }

        .article {
            margin-bottom: 20px;
            padding: 24px;
            background: rgba(15, 23, 42, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            transition: border-color 0.3s;
        }

        .article:hover {
            border-color: rgba(56, 189, 248, 0.3);
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

  const filename = getReportFilename('astro-daily') + '.html';
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #0a0e1a;
            min-height: 100vh;
            padding: 40px 20px;
        }
        .stars {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;
            background-image:
                radial-gradient(1px 1px at 50px 80px, rgba(255,255,255,0.6), transparent),
                radial-gradient(1px 1px at 150px 200px, rgba(255,255,255,0.5), transparent),
                radial-gradient(1.5px 1.5px at 300px 100px, rgba(255,255,255,0.7), transparent),
                radial-gradient(1px 1px at 400px 300px, rgba(255,255,255,0.4), transparent),
                radial-gradient(1px 1px at 500px 150px, rgba(255,255,255,0.6), transparent);
            background-size: 600px 400px;
            animation: twinkle 4s ease-in-out infinite alternate;
        }
        @keyframes twinkle { 0% { opacity: 0.5; } 100% { opacity: 1; } }
        .container {
            max-width: 650px; margin: 0 auto; position: relative; z-index: 1;
        }
        .header {
            text-align: center; padding: 40px 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .header h1 { font-size: 2rem; color: #e2e8f0; margin-bottom: 8px; }
        .header p { color: #38bdf8; font-size: 0.95rem; }
        .content { padding: 30px 0; }
        .report-list { display: flex; flex-direction: column; gap: 12px; }
        .report-item {
            padding: 16px 20px;
            background: rgba(15, 23, 42, 0.7);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 10px;
            text-decoration: none;
            color: inherit;
            transition: all 0.3s ease;
        }
        .report-item:hover {
            border-color: rgba(56, 189, 248, 0.4);
            box-shadow: 0 4px 20px rgba(56, 189, 248, 0.1);
            transform: translateX(4px);
        }
        .report-item .date { font-weight: 600; color: #38bdf8; margin-bottom: 4px; }
        .report-item .status { font-size: 0.85rem; color: #64748b; }
        .empty { text-align: center; color: #64748b; padding: 40px 20px; }
        .back-link {
            display: inline-block; margin-top: 24px; color: #38bdf8;
            text-decoration: none; font-size: 0.9rem; transition: color 0.3s;
        }
        .back-link:hover { color: #7dd3fc; }
        .footer { text-align: center; padding: 20px; color: #475569; font-size: 0.8rem; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
    </style>
</head>
<body>
    <div class="stars"></div>
    <div class="container">
        <div class="header">
            <h1>Astronomy Daily Reports</h1>
            <p>天文日报列表</p>
        </div>
        <div class="content">
`;

    if (reportFiles.length === 0) {
      html += `            <div class="empty"><p>暂无日报，请先运行生成器。</p></div>
`;
    } else {
      html += `            <div class="report-list">
`;
      reportFiles.forEach((file) => {
        const match = file.match(/astro-daily-(\d{4}-\d{2}-\d{2})/);
        const date = match ? match[1] : file;

        html += `                <a href="./${file}" class="report-item">
                    <div class="date">${date}</div>
                    <div class="status">点击查看完整日报 →</div>
                </a>
`;
      });
      html += `            </div>
`;
    }

    html += `            <a href="../../" class="back-link">← 返回首页</a>
        </div>
        <div class="footer">Powered by Astronomy Daily Report Generator</div>
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
