#!/usr/bin/env node

import { program } from 'commander';
import { RSS_SOURCES, HOURS_BACK, ANTHROPIC_API_KEY } from './config';
import { fetchAllFeeds } from './fetchers';
import { filterRecentArticles, deduplicateArticles, filterAIArticles } from './processors/filter';
import { sortArticlesByDate } from './processors/sorter';
import { generateMarkdown, generateFilename } from './generators/markdown';
import { generateHtml, generateHtmlFilename } from './generators/html';
//import { generateWechatArticle, generateWechatHtml, generateWechatFilename, generateWechatHtmlFilename } from './generators/wechat';
import { Article } from './types/article';
import { AISummarizer } from './services/summarizer';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  program
    .name('ai-news-digest')
    .description('AI新闻聚合工具 - 从多个RSS源抓取AI相关新闻')
    .version('1.0.0');

  program
    .command('fetch')
    .description('抓取AI新闻并生成日报')
    .option('-o, --output-dir <dir>', '输出目录', './output')
    .option('-h, --hours <hours>', '抓取多少小时内的文章', HOURS_BACK.toString())
    .option('--ai-summary', '启用AI摘要功能（需要ANTHROPIC_API_KEY环境变量）', false)
    .option('--html-output', '生成HTML格式日报（美观的手机页面）', false)
    //.option('--wechat-article', '生成公众号文章格式（适合复制到公众号编辑器）', false)
    //.option('--wechat-html', '生成公众号文章HTML版本（网页查看）', false)
    .action(async (options) => {
      try {
        console.log('🚀 开始抓取AI新闻...\n');

        // 1. 抓取所有RSS源
        console.log('📡 正在抓取RSS源...');
        const results = await fetchAllFeeds(RSS_SOURCES);

        // 2. 统计抓取结果
        let totalArticles = 0;
        for (const result of results) {
          const status = result.error ? '❌' : '✅';
          console.log(`${status} ${result.source}: ${result.articles.length}篇文章`);
          if (result.error) {
            console.log(`   错误: ${result.error}`);
          }
          totalArticles += result.articles.length;
        }

        console.log(`\n📊 总共抓取: ${totalArticles}篇文章`);

        // 3. 合并所有文章
        const allArticles: Article[] = results.flatMap(result => result.articles);

        if (allArticles.length === 0) {
          console.log('❌ 没有抓取到任何文章，请检查网络连接或RSS源');
          return;
        }

        // 4. 数据处理
        console.log('\n🔄 正在处理数据...');

        // 过滤最近N小时的文章
        const recentArticles = filterRecentArticles(allArticles, parseInt(options.hours));
        console.log(`   过滤后: ${recentArticles.length}篇最近${options.hours}小时内的文章`);

        // 去重
        const uniqueArticles = deduplicateArticles(recentArticles);
        console.log(`   去重后: ${uniqueArticles.length}篇唯一文章`);

        // AI内容过滤（针对国内源）
        const aiArticles = filterAIArticles(uniqueArticles);
        console.log(`   AI过滤后: ${aiArticles.length}篇AI相关文章`);

        // 排序
        const sortedArticles = sortArticlesByDate(aiArticles);
        console.log(`   排序完成: 按时间倒序排列`);

        if (sortedArticles.length === 0) {
          console.log('ℹ️ 最近24小时内没有新的AI相关文章');
          return;
        }

        // 5. AI摘要处理
        let articlesForOutput = sortedArticles;
        if (options.aiSummary) {
          if (!ANTHROPIC_API_KEY) {
            console.log('\n⚠️  警告: ANTHROPIC_API_KEY环境变量未设置，跳过AI摘要功能');
            console.log('   请设置ANTHROPIC_API_KEY或使用 --no-ai-summary 禁用此功能');
          } else {
            try {
              const summarizer = new AISummarizer(ANTHROPIC_API_KEY);
              articlesForOutput = await summarizer.summarizeArticles(sortedArticles);
            } catch (error) {
              console.error('\n❌ AI摘要处理失败:', error instanceof Error ? error.message : error);
              console.log('   继续使用原始描述生成日报');
              articlesForOutput = sortedArticles;
            }
          }
        }

        // 6. 生成Markdown
        console.log('\n📝 正在生成Markdown日报...');
        const markdown = generateMarkdown(articlesForOutput);
        const filename = generateFilename();
        const outputPath = path.join(options.outputDir, filename);

        // 6. 确保输出目录存在
        await fs.mkdir(options.outputDir, { recursive: true });

        // 7. 写入文件
        await fs.writeFile(outputPath, markdown, 'utf-8');
        console.log(`✅ 日报已生成: ${outputPath}`);
        console.log(`📈 统计: ${articlesForOutput.length}篇文章已保存`);

        // 8. 生成HTML（如果启用）
        if (options.htmlOutput) {
          console.log('\n🎨 正在生成HTML日报...');
          const html = generateHtml(articlesForOutput);
          const htmlFilename = generateHtmlFilename();
          const htmlOutputPath = path.join(options.outputDir, htmlFilename);

          await fs.writeFile(htmlOutputPath, html, 'utf-8');
          console.log(`✅ HTML日报已生成: ${htmlOutputPath}`);
          console.log(`📱 手机访问: 将此文件部署到GitHub Pages或云存储`);
        }

        // 9. 生成公众号文章（如果启用）
        // if (options.wechatArticle) {
        //   console.log('\n📱 正在生成公众号文章格式...');
        //   const wechatArticle = generateWechatArticle(articlesForOutput);
        //   const wechatFilename = generateWechatFilename();
        //   const wechatOutputPath = path.join(options.outputDir, wechatFilename);

        //   await fs.writeFile(wechatOutputPath, wechatArticle, 'utf-8');
        //   console.log(`✅ 公众号文章已生成: ${wechatOutputPath}`);
        //   console.log(`📋 使用方法: 复制内容到公众号编辑器发布`);
        // }

        // 10. 生成公众号文章HTML版本（如果启用）
        // if (options.wechatHtml) {
        //   console.log('\n🌐 正在生成公众号文章HTML版本...');
        //   const wechatHtml = generateWechatHtml(articlesForOutput);
        //   const wechatHtmlFilename = generateWechatHtmlFilename();
        //   const wechatHtmlOutputPath = path.join(options.outputDir, wechatHtmlFilename);

        //   await fs.writeFile(wechatHtmlOutputPath, wechatHtml, 'utf-8');
        //   console.log(`✅ 公众号HTML版本已生成: ${wechatHtmlOutputPath}`);
        //   console.log(`📱 适合网页查看或嵌入其他平台`);
        // }

      } catch (error) {
        console.error('❌ 发生错误:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program.parse();
}

main().catch(console.error);
