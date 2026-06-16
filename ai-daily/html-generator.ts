import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Article } from './types';
import { translateTitle, translateDescription } from './translator';
import { getReportFilename } from './date-utils';

function formatDateUTC(date: Date): string {
  return date.toISOString().split('T')[0] + ' ' + date.toUTCString().split(' ')[4];
}

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
    <title>AI Daily Report - ${dateStr.split(' ')[0]}</title>
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
        .stars::before {
            content: '';
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-image:
                radial-gradient(1px 1px at 50px 80px, rgba(255,255,255,0.7), transparent),
                radial-gradient(1px 1px at 150px 200px, rgba(255,255,255,0.5), transparent),
                radial-gradient(1.5px 1.5px at 300px 100px, rgba(255,255,255,0.8), transparent),
                radial-gradient(1px 1px at 450px 300px, rgba(255,255,255,0.6), transparent),
                radial-gradient(1px 1px at 600px 150px, rgba(255,255,255,0.5), transparent),
                radial-gradient(1.5px 1.5px at 750px 250px, rgba(255,255,255,0.7), transparent);
            background-size: 800px 400px;
            animation: twinkle 4s ease-in-out infinite alternate;
        }
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
            color: #94a3b8;
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
            padding: 16px;
            background: rgba(15, 23, 42, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #a78bfa;
        }

        .stat-label {
            color: #94a3b8;
            margin-top: 4px;
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
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            transition: border-color 0.3s;
        }

        .article:hover {
            border-color: rgba(139, 92, 246, 0.3);
        }

        .article-number {
            font-weight: bold;
            color: #8b5cf6;
            font-size: 0.85em;
            margin-bottom: 8px;
        }

        .article-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 6px;
            line-height: 1.4;
        }

        .article-title a {
            color: #c4b5fd;
            text-decoration: none;
            transition: color 0.3s;
        }

        .article-title a:hover {
            color: #e9d5ff;
        }

        .article-title.en {
            font-size: 1.15em;
            color: #e2e8f0;
        }

        .article-title.zh {
            font-size: 1em;
            color: #94a3b8;
            font-weight: normal;
            margin-bottom: 12px;
        }

        .article-meta {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 12px;
        }

        .meta-pill {
            font-size: 0.8em;
            padding: 4px 10px;
            background: rgba(139, 92, 246, 0.15);
            border: 1px solid rgba(139, 92, 246, 0.2);
            border-radius: 20px;
            color: #a78bfa;
        }

        .article-summary {
            margin-top: 14px;
        }

        .summary-block {
            padding: 14px;
            background: rgba(139, 92, 246, 0.06);
            border-left: 3px solid #8b5cf6;
            border-radius: 6px;
            line-height: 1.7;
            font-size: 0.92em;
            color: #cbd5e1;
            margin-bottom: 10px;
        }

        .summary-block.zh {
            border-left-color: #a78bfa;
            color: #94a3b8;
        }

        .footer {
            text-align: center;
            padding: 30px 20px;
            color: #64748b;
            font-size: 0.85em;
        }

        .back-link {
            display: inline-block;
            margin-top: 10px;
            color: #8b5cf6;
            text-decoration: none;
            transition: color 0.3s;
        }
        .back-link:hover { color: #a78bfa; }

        @media (max-width: 768px) {
            .stats { grid-template-columns: 1fr; }
            .header h1 { font-size: 1.6em; }
            body { padding: 20px 10px; }
        }
    </style>
</head>
<body>
    <div class="stars"></div>
    <div class="container">
        <div class="header">
            <h1>AI Daily Report</h1>
            <div class="subtitle">AI 日报</div>
            <div class="date">${dateStr}</div>
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
                <div class="article-number">#${index + 1}</div>
                <div class="article-title en"><a href="${article.link}" target="_blank">${titleEn}</a></div>
                <div class="article-title zh">${titleZh}</div>
                <div class="article-meta">
                    <span class="meta-pill">${article.source}</span>
                    <span class="meta-pill">${timeUTC}</span>
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
            <p>Powered by AI Daily Report Generator</p>
            <a href="./index.html" class="back-link">← 返回日报列表</a>
        </div>
    </div>
</body>
</html>`;

  return html;
}

export async function getLatestReportFile(): Promise<string | null> {
  try {
    const outputDir = join(process.cwd(), 'output');
    const files = await readdir(outputDir);
    const mdFiles = files
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse();

    if (mdFiles.length > 0) {
      return join(outputDir, mdFiles[0]);
    }
  } catch {
    return null;
  }
  return null;
}

export async function saveHtmlReport(html: string): Promise<string> {
  const outputDir = join(process.cwd(), 'output');
  await mkdir(outputDir, { recursive: true });

  const filename = getReportFilename('ai-daily') + '.html';
  const filepath = join(outputDir, filename);
  await writeFile(filepath, html, 'utf-8');

  return filepath;
}

export async function generateIndexPage(): Promise<string> {
  const outputDir = join(process.cwd(), 'output');

  try {
    const files = await readdir(outputDir);
    const reportFiles = files
      .filter((f) => f.startsWith('ai-daily-') && f.endsWith('.html') && f !== 'index.html')
      .sort()
      .reverse();

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Daily Reports</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #0a0e1a;
            min-height: 100vh;
            padding: 40px 20px;
            color: #e2e8f0;
        }
        .stars { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        .stars::before { content: ''; position: absolute; width: 100%; height: 100%;
            background-image: radial-gradient(1px 1px at 50px 40px,rgba(255,255,255,0.6),transparent),radial-gradient(1px 1px at 150px 100px,rgba(255,255,255,0.5),transparent),radial-gradient(1.5px 1.5px at 250px 200px,rgba(255,255,255,0.7),transparent),radial-gradient(1px 1px at 350px 80px,rgba(255,255,255,0.4),transparent),radial-gradient(1px 1px at 450px 300px,rgba(255,255,255,0.6),transparent);
            background-size: 500px 350px; animation: twinkle 4s ease-in-out infinite alternate; }
        @keyframes twinkle { 0% { opacity: 0.5; } 100% { opacity: 1; } }
        .container { max-width: 650px; margin: 0 auto; position: relative; z-index: 1; }
        .header { text-align: center; padding: 40px 20px 30px; }
        .header h1 { font-size: 2em; margin-bottom: 8px; color: #e2e8f0; }
        .header p { color: #94a3b8; }
        .report-list { display: flex; flex-direction: column; gap: 12px; }
        .report-item {
            padding: 16px 20px;
            background: rgba(15, 23, 42, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            text-decoration: none;
            color: inherit;
            transition: all 0.3s;
        }
        .report-item:hover {
            transform: translateY(-2px);
            border-color: rgba(139, 92, 246, 0.4);
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15);
        }
        .report-item .date { font-weight: 600; color: #c4b5fd; margin-bottom: 4px; }
        .report-item .status { font-size: 0.85em; color: #64748b; }
        .empty { text-align: center; color: #64748b; padding: 40px 20px; }
        .back-link { display: inline-block; margin-top: 24px; color: #a78bfa; text-decoration: none; transition: color 0.3s; }
        .back-link:hover { color: #c4b5fd; }
    </style>
</head>
<body>
    <div class="stars"></div>
    <div class="container">
        <div class="header">
            <h1>AI Daily Reports</h1>
            <p>AI 日报列表</p>
        </div>
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
        // 提取日期
        const match = file.match(/ai-daily-(\d{4}-\d{2}-\d{2})/);
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

    html += `            <a href="../../" class="back-link">← 返回首页</a>
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
