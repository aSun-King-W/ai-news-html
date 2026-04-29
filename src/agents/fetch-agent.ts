import * as fs from 'fs/promises';
import * as path from 'path';
import { RSS_SOURCES, HTML_SOURCES, HOURS_BACK } from '../config';
import { fetchAllFeeds, scrapeAllHtmlFeeds } from '../fetchers';
import { filterRecentArticles, deduplicateArticles, filterAIArticles } from '../processors/filter';
import { sortArticlesByDate } from '../processors/sorter';
import { Article } from '../types/article';

interface PipelineState {
  version: string;
  pipelineId: string;
  status: string;
  currentStage: string;
  startedAt: string | null;
  completedAt: string | null;
  config: {
    outputDir: string;
    hoursBack: number;
    formats: string[];
  };
  agents: {
    fetch: { status: string; retries: number; error: string | null };
    summarize: { status: string; retries: number; error: string | null };
    render: { status: string; retries: number; error: string | null };
  };
}

const PIPELINE_DIR = path.resolve(__dirname, '..', '..', '.pipeline');

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Perceive ────────────────────────────────────────────────

async function perceive(): Promise<{
  state: PipelineState;
  hoursBack: number;
}> {
  let state = await readJson<PipelineState>(path.join(PIPELINE_DIR, 'state.json'));

  if (!state) {
    // 首次运行，创建默认 state
    state = {
      version: '1.0',
      pipelineId: '',
      status: 'PENDING',
      currentStage: '',
      startedAt: new Date().toISOString(),
      completedAt: null,
      config: {
        outputDir: './output',
        hoursBack: HOURS_BACK,
        formats: ['markdown'],
      },
      agents: {
        fetch: { status: 'pending', retries: 0, error: null },
        summarize: { status: 'pending', retries: 0, error: null },
        render: { status: 'pending', retries: 0, error: null },
      },
    };
    await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);
  }

  return { state, hoursBack: state.config.hoursBack || HOURS_BACK };
}

// ─── Think ────────────────────────────────────────────────────

function think(state: PipelineState): {
  shouldRun: boolean;
  skipReason: string | null;
} {
  // 已抓取完成，跳过（幂等）
  if (state.agents.fetch.status === 'success') {
    return { shouldRun: false, skipReason: 'fetch already completed, skipping' };
  }

  // 无 RSS 源且无 HTML 源
  if (RSS_SOURCES.length === 0 && HTML_SOURCES.length === 0) {
    return { shouldRun: false, skipReason: 'no sources configured' };
  }

  return { shouldRun: true, skipReason: null };
}

// ─── Act ──────────────────────────────────────────────────────

async function act(state: PipelineState, hoursBack: number): Promise<{
  articles: Article[];
  failed: boolean;
}> {
  // 1. 标记 running
  state.status = 'FETCHING';
  state.currentStage = 'fetching';
  state.agents.fetch.status = 'running';
  await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);

  console.log('📡 开始抓取 RSS 源...');

  // 2. 抓取所有 RSS 源（含重试逻辑）
  let results = await fetchAllFeeds(RSS_SOURCES);

  // 对失败的源重试一次
  const failedSources = results.filter(r => r.error);
  if (failedSources.length > 0) {
    console.log(`\n🔄 重试 ${failedSources.length} 个失败源...`);
    for (const failed of failedSources) {
      const source = RSS_SOURCES.find(s => s.name === failed.source);
      if (source) {
        const { fetchRssFeed } = await import('../fetchers');
        const retry = await fetchRssFeed(source);
        if (!retry.error) {
          const idx = results.indexOf(failed);
          results[idx] = retry;
          console.log(`   ✅ ${failed.source} 重试成功`);
        } else {
          console.log(`   ❌ ${failed.source} 重试仍然失败: ${retry.error}`);
        }
      }
    }
  }

  // 3. 统计 RSS 结果
  let totalArticles = 0;
  for (const result of results) {
    const status = result.error ? '❌' : '✅';
    console.log(`${status} ${result.source}: ${result.articles.length} 篇文章`);
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
    totalArticles += result.articles.length;
  }
  console.log(`\n📊 RSS 总共抓取: ${totalArticles} 篇文章`);

  // 4. 抓取所有 HTML 源（含重试逻辑）
  if (HTML_SOURCES.length > 0) {
    console.log('\n🌐 开始爬取 HTML 源...');
    let htmlResults = await scrapeAllHtmlFeeds(HTML_SOURCES);

    // 对失败的 HTML 源重试一次
    const failedHtmlSources = htmlResults.filter(r => r.error);
    if (failedHtmlSources.length > 0) {
      console.log(`\n🔄 重试 ${failedHtmlSources.length} 个失败 HTML 源...`);
      for (const failed of failedHtmlSources) {
        const source = HTML_SOURCES.find(s => s.name === failed.source);
        if (source) {
          const { scrapeHtmlFeed } = await import('../fetchers/html-scraper');
          const retry = await scrapeHtmlFeed(source);
          if (!retry.error) {
            const idx = htmlResults.indexOf(failed);
            htmlResults[idx] = retry;
            console.log(`   ✅ ${failed.source} 重试成功`);
          } else {
            console.log(`   ❌ ${failed.source} 重试仍然失败: ${retry.error}`);
          }
        }
      }
    }

    // 统计 HTML 结果
    for (const result of htmlResults) {
      const status = result.error ? '❌' : '✅';
      console.log(`${status} ${result.source}: ${result.articles.length} 篇文章`);
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }
      totalArticles += result.articles.length;
    }
    console.log(`\n📊 总共抓取: ${totalArticles} 篇文章`);

    // 合并 RSS 和 HTML 结果
    results = [...results, ...htmlResults];
  }

  // 5. 合并
  const allArticles: Article[] = results.flatMap(r => r.articles);

  if (allArticles.length === 0) {
    console.log('❌ 没有抓取到任何文章');
    state.agents.fetch.status = 'failed';
    state.agents.fetch.error = 'no articles fetched from any source';
    state.status = 'FAILED';
    state.currentStage = '';
    await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);
    return { articles: [], failed: true };
  }

  // 6. 数据处理
  console.log('\n🔄 正在处理数据...');

  const recentArticles = filterRecentArticles(allArticles, hoursBack);
  console.log(`   过滤后: ${recentArticles.length} 篇最近 ${hoursBack} 小时内的文章`);

  const uniqueArticles = deduplicateArticles(recentArticles);
  console.log(`   去重后: ${uniqueArticles.length} 篇唯一文章`);

  const aiArticles = filterAIArticles(uniqueArticles);
  console.log(`   AI 过滤后: ${aiArticles.length} 篇 AI 相关文章`);

  const sortedArticles = sortArticlesByDate(aiArticles);
  console.log(`   排序完成: 按时间倒序排列`);

  if (sortedArticles.length === 0) {
    console.log('ℹ️ 没有 AI 相关文章');
    state.agents.fetch.status = 'failed';
    state.agents.fetch.error = 'no AI-related articles found';
    state.status = 'FAILED';
    state.currentStage = '';
    await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);
    return { articles: [], failed: true };
  }

  // 7. 写入 articles-raw.json
  await writeJson(path.join(PIPELINE_DIR, 'articles-raw.json'), sortedArticles);

  // 8. 更新 state
  state.agents.fetch.status = 'success';
  state.agents.fetch.error = null;
  state.agents.fetch.retries = failedSources.length;
  state.status = 'FETCHED';
  state.currentStage = '';
  await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);

  return { articles: sortedArticles, failed: false };
}

// ─── Run ──────────────────────────────────────────────────────

export async function runFetchAgent(): Promise<void> {
  console.log('┌───────────────────────────────────────┐');
  console.log('│  Fetch Agent: Perceive → Think → Act  │');
  console.log('└───────────────────────────────────────┘\n');

  // Perceive
  console.log('🔍 [Perceive] 读取管线状态和 RSS 配置...');
  const { state, hoursBack } = await perceive();
  console.log(`   状态: ${state.status}, 抓取窗口: ${hoursBack} 小时, RSS 源: ${RSS_SOURCES.length} 个, HTML 源: ${HTML_SOURCES.length} 个`);

  // Think
  console.log('💡 [Think] 分析决策...');
  const { shouldRun, skipReason } = think(state);
  if (!shouldRun) {
    console.log(`   ${skipReason}`);
    return;
  }
  console.log('   决策: 开始执行抓取');

  // Act
  console.log('⚡ [Act] 执行抓取...\n');
  const { articles, failed } = await act(state, hoursBack);

  // 结果
  console.log(`\n✅ Fetch Agent 完成 (${failed ? '失败' : '成功'})`);
  console.log(`   输出: .pipeline/articles-raw.json (${articles.length} 篇)`);
  console.log(`   状态: ${failed ? 'FAILED' : 'FETCHED'}`);
}
