#!/usr/bin/env tsx
/**
 * 评估脚本 — 在标注数据集上运行当前筛选规则，输出基线指标
 *
 * 用法:
 *   npx tsx scripts/evaluate.ts             输出完整报告
 *   npx tsx scripts/evaluate.ts --brief     只输出数字摘要
 *   npx tsx scripts/evaluate.ts --baseline  与基线对比（当基线存在时）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { filterAIArticles } from '../src/processors/filter';
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
  label: 'relevant' | 'irrelevant';
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

interface Metrics {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
}

interface KeywordStat {
  keyword: string;
  matches: number;
  truePositives: number;
  falsePositives: number;
  precision: number;
}

// ─── Config ───────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATASET_PATH = path.join(PROJECT_ROOT, 'data', 'labeled-dataset.json');

// ─── ANSI ─────────────────────────────────────────────────────

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function c(text: string, color: string): string {
  if (!process.stdout.isTTY) return text;
  return `${color}${text}${RESET}`;
}

// ─── Metrics ──────────────────────────────────────────────────

function calcMetrics(tp: number, fp: number, tn: number, fn: number): Metrics {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  const accuracy = tp + tn + fp + fn > 0 ? (tp + tn) / (tp + tn + fp + fn) : 0;
  return { tp, fp, tn, fn, precision, recall, f1, accuracy };
}

function fmtPct(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

function colorPct(value: number): string {
  const s = fmtPct(value);
  if (value >= 0.9) return c(s, GREEN);
  if (value >= 0.7) return c(s, YELLOW);
  return c(s, RED);
}

// ─── Per-keyword analysis ─────────────────────────────────────

function getMatchingKeywords(entry: LabelEntry): string[] {
  // Simulate keyword matching without running the full filter
  // (we know what filterAIArticles does internally)
  const aiKeywords = [
    // 中文
    'AI', '人工智能', 'AIGC', '大模型', '机器学习', '深度学习', '神经网络',
    'ChatGPT', 'GPT', 'Claude', '文心一言', '通义千问', '智谱', '字节跳动',
    '腾讯混元', '百度文心', '科大讯飞', '自动驾驶', '机器人', '智能驾驶',
    '生成式AI', '内容生成', '图像生成', '视频生成', '语音识别', '自然语言处理',
    '计算机视觉', '算法', '数据科学', '数据分析', '智能推荐', '个性化推荐',
    // 英文
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'generative ai', 'llm', 'large language model', 'computer vision',
    'natural language processing', 'nlp', 'autonomous', 'self-driving',
    'robotics', 'chatbot', 'virtual assistant', 'smart assistant',
  ];

  const title = entry.article.title.toLowerCase();
  const description = (entry.article.description || '').toLowerCase();

  return aiKeywords.filter(kw =>
    title.includes(kw.toLowerCase()) || description.includes(kw.toLowerCase())
  );
}

// ─── Report builders ──────────────────────────────────────────

function buildReport(dataset: Dataset, metrics: Metrics, keywordStats: KeywordStat[]): string {
  const lines: string[] = [];

  // ── Header ──
  lines.push('');
  lines.push('╔══════════════════════════════════════════╗');
  lines.push('║      AI 新闻筛选 — 基线评估报告            ║');
  lines.push('╚══════════════════════════════════════════╝');
  lines.push('');
  lines.push(`  数据集: ${dataset.meta.totalArticles} 篇 (${dataset.meta.sources.join(', ')})`);
  lines.push(`  标注日期: ${new Date(dataset.meta.updatedAt).toLocaleString('zh-CN')}`);
  lines.push('');

  // ── Confusion Matrix ──
  lines.push('── 混淆矩阵 ────────────────────────────────');
  lines.push('');
  lines.push(`                 实际相关    实际不相关`);
  lines.push(`  筛选通过        ${c(String(metrics.tp).padStart(5), GREEN)}       ${c(String(metrics.fp).padStart(5), RED)}`);
  lines.push(`  筛除            ${c(String(metrics.fn).padStart(5), YELLOW)}       ${c(String(metrics.tn).padStart(5), DIM)}`);
  lines.push('');

  // ── Overall Metrics ──
  lines.push('── 总体指标 ────────────────────────────────');
  lines.push('');
  lines.push(`  精确率 (Precision)   ${colorPct(metrics.precision)}    (TP / (TP + FP) = ${metrics.tp} / ${metrics.tp + metrics.fp})`);
  lines.push(`  召回率 (Recall)      ${colorPct(metrics.recall)}    (TP / (TP + FN) = ${metrics.tp} / ${metrics.tp + metrics.fn})`);
  lines.push(`  F1 Score            ${colorPct(metrics.f1)}`);
  lines.push(`  准确率 (Accuracy)    ${colorPct(metrics.accuracy)}    (TP + TN) / Total = ${metrics.tp + metrics.tn} / ${metrics.tp + metrics.tn + metrics.fp + metrics.fn}`);
  lines.push('');

  // ── Per-source breakdown ──
  lines.push('── 按来源分布 ──────────────────────────────');
  lines.push('');
  const bySource = sourceBreakdown(dataset);
  for (const s of bySource) {
    const p = s.total > 0 ? (s.tp / (s.tp + s.fp) * 100).toFixed(1) : '-';
    const r = s.total > 0 ? (s.tp / (s.tp + s.fn) * 100).toFixed(1) : '-';
    lines.push(`  ${c(s.source.padEnd(15), CYAN)} ${String(s.total).padStart(3)} 篇  ` +
      `相关 ${s.realRelevant}  精确率 ${p}%  召回率 ${r}%`);
  }
  lines.push('');

  // ── Keyword Analysis ──
  lines.push('── 关键词分析 ──────────────────────────────');
  lines.push('');
  lines.push('  命中数 Top 关键词（按总命中数排序）:');
  lines.push('');

  const sortedKw = [...keywordStats].sort((a, b) => b.matches - a.matches);
  for (const kw of sortedKw) {
    if (kw.matches === 0) continue;
    const precisionStr = kw.matches > 0 ? (kw.precision * 100).toFixed(0) + '%' : '-';
    const fpMarker = kw.falsePositives > 0 ? c(` (${kw.falsePositives} FP)`, RED) : '';
    lines.push(`  ${kw.keyword.padEnd(22)} ${c(String(kw.matches).padStart(3), BOLD)} 命中  ` +
      `TP ${kw.truePositives}  FP ${kw.falsePositives}  精确率 ${colorPct(kw.precision)}${fpMarker}`);
  }
  lines.push('');

  // ── Failure Analysis ──
  lines.push('── 失败案例分析 ────────────────────────────');
  lines.push('');

  // False Positives
  const fpEntries = dataset.articles.filter(a => a.label === 'irrelevant' && a.filterResult === true);
  if (fpEntries.length > 0) {
    lines.push(c(`  [误报] ${fpEntries.length} 篇 — 被错误筛选为 AI 相关`, RED));
    lines.push('');
    for (const entry of fpEntries) {
      const kws = getMatchingKeywords(entry);
      lines.push(`  ${c('✗', RED)} ${c(entry.article.title, BOLD)}`);
      lines.push(`     来源: ${entry.article.source}  |  匹配关键词: ${c(kws.join(', '), YELLOW)}`);
      if (entry.article.description) {
        lines.push(`     描述: ${truncate(entry.article.description, 120)}`);
      }
      lines.push('');
    }
  }

  // False Negatives
  const fnEntries = dataset.articles.filter(a => a.label === 'relevant' && a.filterResult === false);
  if (fnEntries.length > 0) {
    lines.push(c(`  [漏报] ${fnEntries.length} 篇 — 被错误筛除`, YELLOW));
    lines.push('');
    for (const entry of fnEntries) {
      lines.push(`  ${c('△', YELLOW)} ${c(entry.article.title, BOLD)}`);
      lines.push(`     来源: ${entry.article.source}`);
      if (entry.article.description) {
        lines.push(`     描述: ${truncate(entry.article.description, 120)}`);
      }
      // Suggest keywords that could catch this article
      const title = entry.article.title.toLowerCase();
      const desc = (entry.article.description || '').toLowerCase();
      const suggestions: string[] = [];
      if (title.includes('agent') || desc.includes('agent')) suggestions.push('agent');
      if (title.includes('skill') || desc.includes('skill')) suggestions.push('skill');
      if (title.includes('token') || desc.includes('token')) suggestions.push('token');
      if (title.includes('具身') || desc.includes('具身')) suggestions.push('具身智能');
      if (title.includes('hermes') || desc.includes('harness')) suggestions.push('Harness/Agent框架');
      if (suggestions.length > 0) {
        lines.push(`     建议添加关键词: ${c(suggestions.join(', '), CYAN)}`);
      }
      lines.push('');
    }
  }

  lines.push('── 总结 ────────────────────────────────────');
  lines.push('');
  lines.push(`  当前 ${c(fmtPct(metrics.precision), BOLD)} 精确率意味着: 每筛选出 100 篇 AI 文章，`);
  lines.push(`  约有 ${c((metrics.fp / (metrics.tp + metrics.fp) * 100).toFixed(0), RED)} 篇是误报`);
  lines.push(`  当前 ${c(fmtPct(metrics.recall), BOLD)} 召回率意味着: 每 100 篇 AI 文章中，`);
  lines.push(`  约有 ${c((metrics.fn / (metrics.tp + metrics.fn) * 100).toFixed(0), YELLOW)} 篇会被漏掉`);
  lines.push('');

  return lines.join('\n');
}

function sourceBreakdown(dataset: Dataset): Array<{
  source: string;
  total: number;
  realRelevant: number;
  tp: number;
  fp: number;
  fn: number;
}> {
  const map = new Map<string, { total: number; realRelevant: number; tp: number; fp: number; fn: number }>();

  for (const entry of dataset.articles) {
    const src = entry.article.source;
    if (!map.has(src)) map.set(src, { total: 0, realRelevant: 0, tp: 0, fp: 0, fn: 0 });
    const s = map.get(src)!;
    s.total++;
    if (entry.label === 'relevant') s.realRelevant++;
    if (entry.label === 'relevant' && entry.filterResult) s.tp++;
    if (entry.label === 'irrelevant' && entry.filterResult) s.fp++;
    if (entry.label === 'relevant' && !entry.filterResult) s.fn++;
  }

  return Array.from(map.entries()).map(([source, stats]) => ({ source, ...stats }));
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

// ─── Main ─────────────────────────────────────────────────────

function main(): void {
  const isBrief = process.argv.includes('--brief');

  // 1. Load dataset
  let dataset: Dataset;
  try {
    dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8')) as Dataset;
  } catch {
    console.error('❌ 无法加载数据集，请先运行标注: npx tsx scripts/label.ts');
    process.exit(1);
  }

  // 只取已标注的条目
  const labeledEntries = dataset.articles.filter(a => a.label !== null) as LabelEntry[];
  if (labeledEntries.length === 0) {
    console.error('❌ 数据集中没有已标注的条目');
    process.exit(1);
  }

  // 2. Re-evaluate filterResult with the ACTUAL current filter, not cache
  // This ensures consistency if filter rules have been updated since labeling
  for (const entry of labeledEntries) {
    const mockArticle: Article = {
      title: entry.article.title,
      link: entry.article.link,
      pubDate: new Date(entry.article.pubDate),
      source: entry.article.source as Article['source'],
      description: entry.article.description,
    };
    entry.filterResult = filterAIArticles([mockArticle]).length > 0;
  }

  // 3. Calculate metrics
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const entry of labeledEntries) {
    if (entry.label === 'relevant' && entry.filterResult) tp++;
    else if (entry.label === 'irrelevant' && entry.filterResult) fp++;
    else if (entry.label === 'irrelevant' && !entry.filterResult) tn++;
    else if (entry.label === 'relevant' && !entry.filterResult) fn++;
  }

  const metrics = calcMetrics(tp, fp, tn, fn);

  // 4. Per-keyword stats
  const kwMap = new Map<string, { tp: number; fp: number }>();

  // Get all keywords from filter function
  const aiKeywords = [
    'AI', '人工智能', 'AIGC', '大模型', '机器学习', '深度学习', '神经网络',
    'ChatGPT', 'GPT', 'Claude', '文心一言', '通义千问', '智谱', '字节跳动',
    '腾讯混元', '百度文心', '科大讯飞', '自动驾驶', '机器人', '智能驾驶',
    '生成式AI', '内容生成', '图像生成', '视频生成', '语音识别', '自然语言处理',
    '计算机视觉', '算法', '数据科学', '数据分析', '智能推荐', '个性化推荐',
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'generative ai', 'llm', 'large language model', 'computer vision',
    'natural language processing', 'nlp', 'autonomous', 'self-driving',
    'robotics', 'chatbot', 'virtual assistant', 'smart assistant',
  ];
  for (const kw of aiKeywords) kwMap.set(kw, { tp: 0, fp: 0 });

  for (const entry of labeledEntries) {
    if (!entry.filterResult) continue; // only analyze matched entries
    const matched = getMatchingKeywords(entry);
    for (const kw of matched) {
      const stat = kwMap.get(kw);
      if (stat) {
        if (entry.label === 'relevant') stat.tp++;
        else stat.fp++;
      }
    }
  }

  const keywordStats: KeywordStat[] = Array.from(kwMap.entries()).map(([keyword, { tp: ktp, fp: kfp }]) => ({
    keyword,
    matches: ktp + kfp,
    truePositives: ktp,
    falsePositives: kfp,
    precision: ktp + kfp > 0 ? ktp / (ktp + kfp) : 0,
  })).filter(k => k.matches > 0);

  // 5. Output
  if (isBrief) {
    console.log(`${fmtPct(metrics.precision)}\t${fmtPct(metrics.recall)}\t${fmtPct(metrics.f1)}\t${metrics.tp}\t${metrics.fp}\t${metrics.fn}`);
    return;
  }

  console.log(buildReport(dataset, metrics, keywordStats));
}

main();
