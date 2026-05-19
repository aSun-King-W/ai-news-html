#!/usr/bin/env tsx
/**
 * 交互式标注工具 — 逐篇标记文章是否与 AI 相关
 *
 * 用法:
 *   npx tsx scripts/label.ts              抓取 + 标注
 *   npx tsx scripts/label.ts --resume     恢复上次未完成的标注
 *   npx tsx scripts/label.ts --fetch-only 只抓取原始文章，不进入标注
 *
 * 标注操作:
 *   y  — AI 相关 (relevant)
 *   n  — 不相关 (irrelevant)
 *   s  — 跳过
 *   q  — 保存并退出
 *   ?  — 显示帮助
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { RSS_SOURCES, HOURS_BACK } from '../src/config';
import { fetchAllFeeds } from '../src/fetchers';
import { filterRecentArticles, deduplicateArticles, filterAIArticles } from '../src/processors/filter';
import type { Article } from '../src/types/article';

// ─── Types ────────────────────────────────────────────────────

interface LabelEntry {
  article: {
    title: string;
    link: string;
    pubDate: string;
    source: string;
    description?: string;
  };
  label: 'relevant' | 'irrelevant' | null;
  filterResult: boolean;
  labeledAt?: string;
}

interface Dataset {
  meta: {
    createdAt: string;
    updatedAt: string;
    totalArticles: number;
    labeledCount: number;
    sources: string[];
  };
  articles: LabelEntry[];
}

// ─── Paths ─────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const DATASET_PATH = path.join(DATA_DIR, 'labeled-dataset.json');
const RAW_ARTICLES_PATH = path.join(DATA_DIR, 'raw-articles.json');

// ─── ANSI helpers ─────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

function colored(text: string, color: string): string {
  // 在不支持颜色的终端中去掉转义码
  if (!process.stdout.isTTY) return text;
  return `${color}${text}${C.reset}`;
}

// ─── Helpers ───────────────────────────────────────────────────

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function sourceColor(source: string): string {
  if (source.includes('TechCrunch')) return C.red;
  if (source.includes('The Verge')) return C.green;
  if (source.includes('Hacker News')) return C.magenta;
  if (source.includes('36氪')) return C.cyan;
  if (source.includes('虎嗅')) return C.yellow;
  return C.gray;
}

// ─── Dataset I/O ──────────────────────────────────────────────

async function loadDataset(): Promise<Dataset> {
  try {
    const raw = await fs.readFile(DATASET_PATH, 'utf-8');
    return JSON.parse(raw) as Dataset;
  } catch {
    return {
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalArticles: 0,
        labeledCount: 0,
        sources: [],
      },
      articles: [],
    };
  }
}

async function saveDataset(dataset: Dataset): Promise<void> {
  dataset.meta.updatedAt = new Date().toISOString();
  dataset.meta.labeledCount = dataset.articles.filter(a => a.label !== null).length;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATASET_PATH, JSON.stringify(dataset, null, 2), 'utf-8');
}

// ─── Fetch raw articles ───────────────────────────────────────

async function fetchRawArticles(): Promise<Article[]> {
  console.log(colored('\n📡 正在从 5 个 RSS 源抓取文章...', C.bold));

  const results = await fetchAllFeeds(RSS_SOURCES);

  // 统计
  let total = 0;
  for (const r of results) {
    const icon = r.error ? '❌' : '✅';
    console.log(`${icon} ${r.source}: ${r.articles.length} 篇${r.error ? ` (错误: ${r.error})` : ''}`);
    total += r.articles.length;
  }
  console.log(colored(`\n📊 共抓取: ${total} 篇文章`, C.bold));

  const allArticles = results.flatMap(r => r.articles);

  // 时间过滤 + 去重（但不做 AI 过滤）
  const recent = filterRecentArticles(allArticles, HOURS_BACK);
  console.log(`⏰ 时间过滤 (${HOURS_BACK}h): ${recent.length} 篇`);

  const unique = deduplicateArticles(recent);
  console.log(`🔗 去重后: ${unique.length} 篇`);

  // 保存原始文章供后续复用
  const serializable = unique.map(a => ({
    ...a,
    pubDate: a.pubDate instanceof Date ? a.pubDate.toISOString() : a.pubDate,
  }));
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RAW_ARTICLES_PATH, JSON.stringify(serializable, null, 2), 'utf-8');
  console.log(colored(`💾 原始文章已保存: data/raw-articles.json\n`, C.dim));

  return unique;
}

async function loadRawArticles(): Promise<Article[]> {
  const raw = await fs.readFile(RAW_ARTICLES_PATH, 'utf-8');
  const data: Array<Article & { pubDate: string }> = JSON.parse(raw);
  return data.map((a: Article & { pubDate: string }) => ({
    ...a,
    pubDate: new Date(a.pubDate),
  }));
}

// ─── Interactive labeling ─────────────────────────────────────

function showHelp(): void {
  console.log(`
  ${colored('y', C.green)}  — 标记为 AI 相关
  ${colored('n', C.red)}  — 标记为不相关
  ${colored('s', C.gray)}  — 跳过
  ${colored('q', C.yellow)}  — 保存并退出
  ${colored('?', C.cyan)}  — 显示此帮助
  `);
}

function showStats(dataset: Dataset): void {
  const labeled = dataset.articles.filter(a => a.label !== null);
  const relevant = labeled.filter(a => a.label === 'relevant');
  const irrelevant = labeled.filter(a => a.label === 'irrelevant');
  const unlabeled = dataset.articles.filter(a => a.label === null);
  const filterMatch = labeled.filter(a => a.label === 'relevant' && a.filterResult);
  const filterFalsePos = labeled.filter(a => a.label === 'irrelevant' && a.filterResult);
  const filterMissed = labeled.filter(a => a.label === 'relevant' && !a.filterResult);

  console.log(colored(`\n📊 标注进度`, C.bold));
  console.log(`   总计: ${dataset.articles.length} 篇`);
  console.log(`   已标注: ${colored(labeled.length.toString(), C.green)} 篇`);
  console.log(`     AI 相关: ${colored(relevant.length.toString(), C.green)} 篇`);
  console.log(`     不相关:   ${colored(irrelevant.length.toString(), C.red)} 篇`);
  console.log(`   待标注: ${colored(unlabeled.length.toString(), C.yellow)} 篇`);
  console.log(`   当前筛选器: 正确检出 ${filterMatch.length} 篇, ` +
    `误报 ${colored(filterFalsePos.length.toString(), C.red)} 篇, ` +
    `漏报 ${colored(filterMissed.length.toString(), C.yellow)} 篇`);

  if (labeled.length > 0) {
    const precision = filterMatch.length / (filterMatch.length + filterFalsePos.length) || 0;
    const recall = filterMatch.length / (filterMatch.length + filterMissed.length) || 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    console.log(`   当前基线: 精确率 ${colored((precision * 100).toFixed(1) + '%', C.cyan)}, ` +
      `召回率 ${colored((recall * 100).toFixed(1) + '%', C.cyan)}, ` +
      `F1 ${colored((f1 * 100).toFixed(1) + '%', C.cyan)}`);
  }
}

function showArticle(entry: LabelEntry, index: number, total: number): void {
  const a = entry.article;
  const filterIcon = entry.filterResult
    ? colored('✓ IN ', C.bgGreen)
    : colored('✗ OUT', C.bgYellow);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(colored(`  [#${index + 1}/${total}] ${filterIcon}  `, C.bold) +
    colored(`${a.source}`, sourceColor(a.source)));
  console.log(colored(`  标题: ${a.title}`, C.bold));
  if (a.description) {
    console.log(`  描述: ${truncate(a.description, 200)}`);
  }
  console.log(colored(`  链接: ${a.link}`, C.dim));
  console.log(colored(`  时间: ${new Date(a.pubDate).toLocaleString('zh-CN')}`, C.dim));
}

function promptLabel(rl: readline.Interface): Promise<string> {
  return new Promise(resolve => {
    rl.question(colored('  [y/n/s/q/?] ', C.cyan), answer => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ─── Main ──────────────────────────────────────────────────────

async function runLabeling(dataset: Dataset): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const unlabeled = dataset.articles.filter(a => a.label === null);
  const total = dataset.articles.length;
  let savedCount = 0;

  console.log(colored(`\n开始标注 — 剩余 ${unlabeled.length} 篇待标注`, C.bold));
  showHelp();
  console.log(colored('提示: 标注标准 — 文章是否与 AI、ML、LLM、自动驾驶、机器人等直接相关\n', C.dim));

  for (const entry of unlabeled) {
    const idx = dataset.articles.indexOf(entry);
    showArticle(entry, idx, total);

    let answer: string;
    do {
      answer = await promptLabel(rl);
    } while (!['y', 'n', 's', 'q', '?'].includes(answer));

    if (answer === '?') {
      showHelp();
      // 重新展示当前文章
      showArticle(entry, idx, total);
      do {
        answer = await promptLabel(rl);
      } while (!['y', 'n', 's', 'q', '?'].includes(answer));
    }

    if (answer === 'q') {
      await saveDataset(dataset);
      showStats(dataset);
      console.log(colored('✅ 已保存，退出标注。\n', C.green));
      rl.close();
      return;
    }

    if (answer === 's') {
      entry.label = null;
      console.log(colored('  已跳过', C.gray));
      continue;
    }

    entry.label = answer === 'y' ? 'relevant' : 'irrelevant';
    entry.labeledAt = new Date().toISOString();

    // 每 5 条保存一次
    savedCount++;
    if (savedCount % 5 === 0) {
      await saveDataset(dataset);
      console.log(colored(`  💾 已自动保存 (${dataset.meta.labeledCount}/${total})`, C.dim));
    }
  }

  // 全部标完
  await saveDataset(dataset);
  console.log(colored('\n🎉 所有文章已标注完成!', C.bold));
  showStats(dataset);

  rl.close();
}

// ─── Entry point ───────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isResume = args.includes('--resume');
  const isFetchOnly = args.includes('--fetch-only');

  console.log(colored('┌───────────────────────────────────────┐', C.bold));
  console.log(colored('│  AI 新闻标注工具                        │', C.bold));
  console.log(colored('│  逐篇标记文章是否与 AI 直接相关         │', C.bold));
  console.log(colored('└───────────────────────────────────────┘', C.bold));

  // ── 获取文章池 ──

  let articles: Article[];

  if (isResume) {
    // 恢复模式：尝试从原始文章文件加载
    try {
      articles = await loadRawArticles();
      console.log(colored(`\n📂 已加载已保存的原始文章: ${articles.length} 篇`, C.dim));
    } catch {
      console.log(colored('\n⚠️  未找到缓存的原始文章，重新抓取...', C.yellow));
      articles = await fetchRawArticles();
    }
  } else {
    articles = await fetchRawArticles();
  }

  if (articles.length === 0) {
    console.error(colored('❌ 没有获取到任何文章，无法标注。', C.red));
    process.exit(1);
  }

  if (isFetchOnly) {
    console.log(colored(`\n✅ 抓取完成。原始文章已保存到 data/raw-articles.json`, C.green));
    console.log(colored(`   共 ${articles.length} 篇文章，运行标注: `, C.dim) +
      colored('npx tsx scripts/label.ts --resume', C.cyan));
    return;
  }

  // ── 初始化数据集 ──

  let dataset = await loadDataset();

  // 如果是全新开始，初始化文章列表
  if (dataset.articles.length === 0) {
    const sources = [...new Set(articles.map(a => a.source))];
    dataset.meta.sources = sources;
    dataset.articles = articles.map(a => ({
      article: {
        title: a.title,
        link: a.link,
        pubDate: a.pubDate instanceof Date ? a.pubDate.toISOString() : a.pubDate,
        source: a.source,
        description: a.description,
      },
      label: null,
      filterResult: filterAIArticles([a]).length > 0,
    }));
    dataset.meta.totalArticles = dataset.articles.length;
    await saveDataset(dataset);
    console.log(colored(`\n📦 新数据集已创建: ${dataset.articles.length} 篇来自 ${sources.join(', ')}`, C.green));
  } else {
    console.log(colored(`\n📂 恢复已有数据集: ${dataset.meta.labeledCount}/${dataset.articles.length} 篇已标注`, C.dim));

    // 检查是否有新文章未包含在数据集中（基于链接去重）
    const existingLinks = new Set(dataset.articles.map(e => e.article.link.toLowerCase().trim()));
    const newArticles = articles.filter(a => !existingLinks.has(a.link.toLowerCase().trim()));
    if (newArticles.length > 0) {
      console.log(colored(`  发现 ${newArticles.length} 篇新文章，已追加到数据集`, C.yellow));
      for (const a of newArticles) {
        dataset.articles.push({
          article: {
            title: a.title,
            link: a.link,
            pubDate: a.pubDate instanceof Date ? a.pubDate.toISOString() : a.pubDate,
            source: a.source,
            description: a.description,
          },
          label: null,
          filterResult: filterAIArticles([a]).length > 0,
        });
      }
      dataset.meta.totalArticles = dataset.articles.length;
      await saveDataset(dataset);
    }
  }

  // ── 进入标注循环 ──

  await runLabeling(dataset);
}

main().catch(err => {
  console.error(colored(`\n❌ 错误: ${err.message}`, C.red));
  process.exit(1);
});
