import cron from 'node-cron';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { scrapeAllSources } from './scrapers';
import {
  filterLast24Hours,
  sortByTimeDesc,
  generateMarkdown,
  getOutputFilename,
} from './article-utils';
import { generateHtmlReport, saveHtmlReport, generateIndexPage } from './html-generator';

async function runDailyReport() {
  console.log(`[${new Date().toISOString()}] 🔭 开始抓取天文新闻...\n`);

  try {
    const { articles, errors } = await scrapeAllSources();

    if (errors.length > 0) {
      console.warn('⚠️  发生了一些错误:');
      errors.forEach((err) => console.warn(`  - ${err}`));
      console.log();
    }

    console.log(`✅ 共抓取 ${articles.length} 篇文章\n`);

    // 过滤24小时内的文章
    const recent = filterLast24Hours(articles);
    console.log(`📌 其中 ${recent.length} 篇在最近24小时内\n`);

    if (recent.length === 0) {
      console.log('ℹ️  未找到最近24小时的文章，使用全部文章生成日报');
      recent.push(...articles);
    }

    // 按时间排序
    const sorted = sortByTimeDesc(recent);

    // 生成Markdown（需要等待翻译）
    console.log('🌐 正在翻译摘要...');
    const markdown = await generateMarkdown(sorted);

    // 创建输出目录
    const outputDir = join(process.cwd(), 'output');
    await mkdir(outputDir, { recursive: true });

    // 保存Markdown文件
    const filename = getOutputFilename();
    const mdFilepath = join(outputDir, filename);
    await writeFile(mdFilepath, markdown, 'utf-8');

    // 生成HTML版本
    console.log('📄 正在生成HTML版本...');
    const html = await generateHtmlReport(sorted);
    const htmlFilepath = await saveHtmlReport(html);

    // 生成索引页面
    console.log('📑 正在生成索引页面...');
    const indexHtml = await generateIndexPage();
    const indexPath = join(outputDir, 'index.html');
    await writeFile(indexPath, indexHtml, 'utf-8');

    console.log(`✨ 日报已生成!\n`);
    console.log(`📝 Markdown: ${mdFilepath}`);
    console.log(`🌐 HTML: ${htmlFilepath}`);
    console.log(`📑 索引页: ${indexPath}\n`);
    console.log(`📄 文章数: ${sorted.length}`);
    console.log('✅ 完成！\n');
  } catch (error) {
    console.error('❌ 出错:', error instanceof Error ? error.message : String(error));
  }
}

function startScheduler() {
  // 每天早上 8:00 运行
  // Cron 格式: 分 小时 日期 月份 星期
  const task = cron.schedule('0 8 * * *', () => {
    runDailyReport();
  });

  console.log('📅 天文日报定时器已启动');
  console.log('⏰ 计划每天早上 08:00 (UTC) 运行');
  console.log('💾 输出目录: output/');
  console.log('🌐 请访问 output/index.html 查看汇总\n');

  return task;
}

// 启动定时器并保持进程运行
startScheduler();

// 防止进程退出
process.on('SIGINT', () => {
  console.log('\n⏹️ 天文日报定时器已停止');
  process.exit(0);
});

export { runDailyReport, startScheduler };
