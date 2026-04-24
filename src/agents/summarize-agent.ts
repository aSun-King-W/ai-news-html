import * as fs from 'fs/promises';
import * as path from 'path';
import { Article } from '../types/article';
import { AISummarizer } from '../services/summarizer';
import { ANTHROPIC_API_KEY } from '../config';

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
  articles: Article[];
  apiKey: string | undefined;
}> {
  const state = await readJson<PipelineState>(path.join(PIPELINE_DIR, 'state.json'));
  if (!state) {
    throw new Error('.pipeline/state.json not found. Run the Fetch agent first.');
  }

  const articles = await readJson<Article[]>(path.join(PIPELINE_DIR, 'articles-raw.json'));

  return { state: state! as PipelineState, articles: articles || [], apiKey: ANTHROPIC_API_KEY };
}

// ─── Think ────────────────────────────────────────────────────

function think(state: PipelineState, articles: Article[], apiKey: string | undefined): {
  shouldRun: boolean;
  skipReason: string | null;
} {
  // 已摘要完成，跳过（幂等）
  if (state.agents.summarize.status === 'success') {
    return { shouldRun: false, skipReason: 'summarize already completed, skipping' };
  }

  // 无文章
  if (articles.length === 0) {
    return { shouldRun: false, skipReason: 'no articles to summarize' };
  }

  // 无 API key
  if (!apiKey) {
    return { shouldRun: false, skipReason: 'ANTHROPIC_API_KEY not set, skipping AI summary' };
  }

  // 前置状态检查：必须是 FETCHED 或 PENDING（也可以强行跑）
  return { shouldRun: true, skipReason: null };
}

// ─── Act ──────────────────────────────────────────────────────

async function act(
  state: PipelineState,
  articles: Article[],
  apiKey: string,
): Promise<{ summarized: Article[]; failed: boolean }> {
  // 1. 标记 running
  state.status = 'SUMMARIZING';
  state.currentStage = 'summarizing';
  state.agents.summarize.status = 'running';
  await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);

  console.log('🤖 开始 AI 摘要处理...');

  // 2. 调用现有的 summarizer
  let summarized: Article[];
  let failed = false;
  try {
    const summarizer = new AISummarizer(apiKey);
    summarized = await summarizer.summarizeArticles(articles);
  } catch (error) {
    console.error('\n❌ AI 摘要失败:', error instanceof Error ? error.message : error);
    // 降级：保留原始文章
    summarized = articles;
    failed = true;
  }

  // 3. 质量评估兜底：aiSummary 太短则清除
  for (const a of summarized) {
    if (a.aiSummary && a.aiSummary.trim().length < 20) {
      console.warn(`   ⚠️ 摘要质量过低，降级: "${a.title}"`);
      delete a.aiSummary;
    }
  }

  const successCount = summarized.filter(a => a.aiSummary).length;
  console.log(`\n📊 摘要完成: ${successCount}/${summarized.length} 篇有效`);

  // 4. 写入 articles-summarized.json
  await writeJson(path.join(PIPELINE_DIR, 'articles-summarized.json'), summarized);

  // 5. 更新 state
  if (failed) {
    state.agents.summarize.status = 'failed';
    state.agents.summarize.error = 'AI summarization failed, fell back to raw description';
    state.status = 'FAILED';
  } else {
    state.agents.summarize.status = 'success';
    state.status = 'SUMMARIZED';
    state.agents.summarize.error = null;
  }
  state.currentStage = '';
  await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);

  return { summarized, failed };
}

// ─── Run ──────────────────────────────────────────────────────

export async function runSummarizeAgent(): Promise<void> {
  console.log('┌─────────────────────────────────────────┐');
  console.log('│  Summarize Agent: Perceive → Think → Act │');
  console.log('└─────────────────────────────────────────┘\n');

  // Perceive
  console.log('🔍 [Perceive] 读取管线状态和文章列表...');
  const { state, articles, apiKey } = await perceive();
  console.log(`   状态: ${state.status}, 文章数: ${articles.length}`);

  // Think
  console.log('💡 [Think] 分析决策...');
  const { shouldRun, skipReason } = think(state, articles, apiKey);
  if (!shouldRun) {
    console.log(`   ${skipReason}`);
    if (articles.length > 0 && !apiKey) {
      // 无 API key 时直接透传原始文章
      await writeJson(path.join(PIPELINE_DIR, 'articles-summarized.json'), articles);
      console.log('   已将原始文章列表透传到 articles-summarized.json');
    }
    return;
  }
  console.log('   决策: 开始执行摘要');

  // Act
  console.log('⚡ [Act] 执行摘要...\n');
  const { failed } = await act(state, articles, apiKey!);

  // 结果
  console.log(`\n✅ Summarize Agent 完成 (${failed ? '有降级' : '全部成功'})`);
  console.log(`   输出: .pipeline/articles-summarized.json`);
  console.log(`   状态: ${failed ? 'FAILED (降级)' : 'SUMMARIZED'}`);
}
