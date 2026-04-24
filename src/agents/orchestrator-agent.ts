import * as fs from 'fs/promises';
import * as path from 'path';
import { HOURS_BACK } from '../config';

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

function generatePipelineId(): string {
  const now = new Date();
  return `pipeline-${now.toISOString().replace(/[:.]/g, '-')}`;
}

async function cleanupPipelineData(): Promise<void> {
  const files = ['articles-raw.json', 'articles-summarized.json', 'output-manifest.json'];
  for (const file of files) {
    try {
      await fs.unlink(path.join(PIPELINE_DIR, file));
    } catch {
      // file may not exist, ignore
    }
  }
}

// ─── Perceive ────────────────────────────────────────────────

async function perceive(force: boolean): Promise<{ state: PipelineState }> {
  let state = await readJson<PipelineState>(path.join(PIPELINE_DIR, 'state.json'));

  if (!state || force) {
    if (force) {
      await cleanupPipelineData();
    }
    state = {
      version: '1.0',
      pipelineId: generatePipelineId(),
      status: 'PENDING',
      currentStage: '',
      startedAt: new Date().toISOString(),
      completedAt: null,
      config: {
        outputDir: './output',
        hoursBack: HOURS_BACK,
        formats: ['markdown', 'html'],
      },
      agents: {
        fetch: { status: 'pending', retries: 0, error: null },
        summarize: { status: 'pending', retries: 0, error: null },
        render: { status: 'pending', retries: 0, error: null },
      },
    };
    await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);
    console.log('   状态已重置为 PENDING');
  }

  return { state };
}

// ─── Think ────────────────────────────────────────────────────

function think(state: PipelineState): {
  shouldRun: boolean;
  summary: string;
} {
  switch (state.status) {
    case 'COMPLETED':
      return { shouldRun: false, summary: `管线已完成 (ID: ${state.pipelineId})` };
    case 'FAILED': {
      const failedAgents = Object.entries(state.agents)
        .filter(([, v]) => v.status === 'failed')
        .map(([k]) => k);
      return {
        shouldRun: true,
        summary: `管线处于 FAILED 状态，失败 Agent: ${failedAgents.join(', ') || 'unknown'}，将尝试重试`,
      };
    }
    case 'PENDING':
      return { shouldRun: true, summary: '新管线，将依次执行 fetch → summarize → render' };
    case 'FETCHED':
      return { shouldRun: true, summary: '抓取完成，继续执行 summarize → render' };
    case 'SUMMARIZED':
      return { shouldRun: true, summary: '摘要完成，继续执行 render' };
    default:
      return { shouldRun: true, summary: `当前状态: ${state.status}，执行剩余步骤` };
  }
}

// ─── Act ──────────────────────────────────────────────────────

async function runAgentWithRetry(
  name: 'fetch' | 'summarize' | 'render',
  runFn: () => Promise<void>,
  state: PipelineState,
  maxRetries = 2,
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`\n🔄 第 ${attempt} 次重试 ${name} agent...`);
      // Reset agent status before retry so the sub-agent will run again
      const agent = state.agents[name];
      agent.status = 'pending';
      agent.error = null;
      await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);
    }

    await runFn();

    // Reload state after agent run
    const updatedState = await readJson<PipelineState>(path.join(PIPELINE_DIR, 'state.json'));
    if (!updatedState) {
      console.error(`❌ 无法读取更新后的状态`);
      return false;
    }
    Object.assign(state, updatedState);

    const agentStatus = state.agents[name].status;
    if (agentStatus === 'success') {
      return true;
    }
    if (agentStatus === 'failed') {
      console.log(`   ${name} 失败 (第 ${attempt + 1} 次): ${state.agents[name].error}`);
    }
  }

  return false;
}

async function act(state: PipelineState): Promise<boolean> {
  const { runFetchAgent } = await import('./fetch-agent');
  const { runSummarizeAgent } = await import('./summarize-agent');
  const { runRenderAgent } = await import('./render-agent');

  // --- Step 1: Fetch ---
  console.log('\n═══════════════════════════════════════');
  console.log('  Step 1/3: Fetch Agent');
  console.log('═══════════════════════════════════════\n');

  const fetchOk = await runAgentWithRetry('fetch', runFetchAgent, state);
  if (!fetchOk) {
    console.log('\n❌ Fetch Agent 失败，管线终止');
    state.status = 'FAILED';
    state.currentStage = '';
    await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);
    return false;
  }

  // --- Step 2: Summarize ---
  console.log('\n═══════════════════════════════════════');
  console.log('  Step 2/3: Summarize Agent');
  console.log('═══════════════════════════════════════\n');

  const summarizeOk = await runAgentWithRetry('summarize', runSummarizeAgent, state);
  if (!summarizeOk) {
    console.log('\n⚠️  Summarize Agent 全部重试失败，将使用原始文章继续渲染');
    // Degrade gracefully: mark failed but continue to render
    state.agents.summarize.status = 'failed';
    state.agents.summarize.error = 'summarize failed after retries, falling back to raw';
    await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);
  }

  // --- Step 3: Render ---
  console.log('\n═══════════════════════════════════════');
  console.log('  Step 3/3: Render Agent');
  console.log('═══════════════════════════════════════\n');

  const renderOk = await runAgentWithRetry('render', runRenderAgent, state);
  if (!renderOk) {
    console.log('\n❌ Render Agent 失败，管线终止');
    state.status = 'FAILED';
    state.currentStage = '';
    await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);
    return false;
  }

  return true;
}

// ─── Run ──────────────────────────────────────────────────────

export async function runOrchestrator(options?: {
  outputDir?: string;
  hoursBack?: number;
  force?: boolean;
}): Promise<void> {
  console.log('┌───────────────────────────────────────────────┐');
  console.log('│  Orchestrator Agent: Perceive → Think → Act  │');
  console.log('└───────────────────────────────────────────────┘\n');

  const force = options?.force || false;

  // Perceive
  console.log('🔍 [Perceive] 读取管线状态...');
  const { state } = await perceive(force);
  console.log(`   状态: ${state.status}, Pipeline ID: ${state.pipelineId}`);

  // Think
  console.log('💡 [Think] 分析决策...');
  const { shouldRun, summary } = think(state);
  console.log(`   决策: ${summary}`);
  if (!shouldRun) {
    console.log('\n✅ 管线无需执行');
    return;
  }

  // Act
  console.log('⚡ [Act] 执行管线调度...\n');
  const success = await act(state);

  // 结果汇总
  console.log('\n═══════════════════════════════════════');
  console.log('  📊 管线执行汇总');
  console.log('═══════════════════════════════════════\n');
  console.log(`  Pipeline ID: ${state.pipelineId}`);
  console.log(`  最终状态: ${state.status}`);
  for (const [agentName, agent] of Object.entries(state.agents)) {
    const icon = agent.status === 'success' ? '✅' : agent.status === 'failed' ? '❌' : '⏳';
    console.log(`  ${agentName}: ${icon} ${agent.status}${agent.error ? ` (${agent.error})` : ''}`);
  }
  if (state.completedAt) {
    console.log(`  完成时间: ${state.completedAt}`);
  }
  console.log(`  成功: ${success ? '是' : '否'}`);
  console.log('');
}
