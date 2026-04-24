import * as fs from 'fs/promises';
import * as path from 'path';
import { Article } from '../types/article';
import { generateMarkdown, generateFilename } from '../generators/markdown';
import { generateHtml, generateHtmlFilename } from '../generators/html';

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

interface OutputManifest {
  pipelineId: string;
  generatedAt: string;
  articleCount: number;
  outputs: { format: string; path: string }[];
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
}> {
  const state = await readJson<PipelineState>(path.join(PIPELINE_DIR, 'state.json'));
  if (!state) {
    throw new Error('.pipeline/state.json not found. Run the Fetch agent first.');
  }

  // 优先读取带摘要的文章，其次读原始文章
  let articles = await readJson<Article[]>(path.join(PIPELINE_DIR, 'articles-summarized.json'));
  if (!articles) {
    articles = await readJson<Article[]>(path.join(PIPELINE_DIR, 'articles-raw.json'));
  }

  return { state: state! as PipelineState, articles: articles || [] };
}

// ─── Think ────────────────────────────────────────────────────

function think(state: PipelineState, articles: Article[]): {
  shouldRun: boolean;
  skipReason: string | null;
  formats: string[];
} {
  // 已渲染完成，跳过（幂等）
  if (state.agents.render.status === 'success') {
    return { shouldRun: false, skipReason: 'render already completed, skipping', formats: [] };
  }

  // 无文章
  if (articles.length === 0) {
    return { shouldRun: false, skipReason: 'no articles to render', formats: [] };
  }

  // 确定输出格式
  let formats = state.config.formats;
  if (!formats || formats.length === 0) {
    formats = ['markdown'];
  }

  return { shouldRun: true, skipReason: null, formats };
}

// ─── Act ──────────────────────────────────────────────────────

async function act(
  state: PipelineState,
  articles: Article[],
  formats: string[],
): Promise<{
  outputs: { format: string; path: string }[];
  failed: boolean;
}> {
  // 1. 标记 running
  state.status = 'RENDERING';
  state.currentStage = 'rendering';
  state.agents.render.status = 'running';
  await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);

  console.log('📝 开始渲染输出...');
  console.log(`   输出格式: ${formats.join(', ')}`);
  console.log(`   输出目录: ${state.config.outputDir}`);

  const outputDir = path.resolve(state.config.outputDir);
  await fs.mkdir(outputDir, { recursive: true });

  const outputs: { format: string; path: string }[] = [];
  let failed = false;

  for (const format of formats) {
    try {
      switch (format) {
        case 'markdown': {
          console.log('\n📄 生成 Markdown...');
          const markdown = generateMarkdown(articles);
          const filename = generateFilename();
          const outputPath = path.join(outputDir, filename);
          await fs.writeFile(outputPath, markdown, 'utf-8');
          outputs.push({ format: 'markdown', path: outputPath });
          console.log(`   ✅ Markdown 已生成: ${outputPath}`);
          break;
        }
        case 'html': {
          console.log('\n🎨 生成 HTML...');
          const html = generateHtml(articles);
          const filename = generateHtmlFilename();
          const outputPath = path.join(outputDir, filename);
          await fs.writeFile(outputPath, html, 'utf-8');
          outputs.push({ format: 'html', path: outputPath });
          console.log(`   ✅ HTML 已生成: ${outputPath}`);
          break;
        }
        default:
          console.log(`   ⚠️ 不支持的格式: ${format}`);
      }
    } catch (error) {
      console.error(`   ❌ 生成 ${format} 失败:`, error instanceof Error ? error.message : error);
      failed = true;
    }
  }

  // 2. 写入 output-manifest.json
  const manifest: OutputManifest = {
    pipelineId: state.pipelineId,
    generatedAt: new Date().toISOString(),
    articleCount: articles.length,
    outputs,
  };
  await writeJson(path.join(PIPELINE_DIR, 'output-manifest.json'), manifest);
  console.log(`\n📋 manifest 已生成: .pipeline/output-manifest.json`);

  // 3. 更新 state
  if (failed) {
    state.agents.render.status = 'failed';
    state.agents.render.error = 'some output formats failed to generate';
    state.status = 'FAILED';
  } else {
    state.agents.render.status = 'success';
    state.agents.render.error = null;
    state.status = 'COMPLETED';
    state.completedAt = new Date().toISOString();
  }
  state.currentStage = '';
  await writeJson(path.join(PIPELINE_DIR, 'state.json'), state);

  return { outputs, failed };
}

// ─── Run ──────────────────────────────────────────────────────

export async function runRenderAgent(): Promise<void> {
  console.log('┌───────────────────────────────────────────┐');
  console.log('│  Render Agent: Perceive → Think → Act     │');
  console.log('└───────────────────────────────────────────┘\n');

  // Perceive
  console.log('🔍 [Perceive] 读取管线状态和文章...');
  const { state, articles } = await perceive();
  console.log(`   状态: ${state.status}, 文章数: ${articles.length}`);

  // Think
  console.log('💡 [Think] 分析决策...');
  const { shouldRun, skipReason, formats } = think(state, articles);
  if (!shouldRun) {
    console.log(`   ${skipReason}`);
    return;
  }
  console.log(`   决策: 按 ${formats.join(', ')} 格式渲染 ${articles.length} 篇文章`);

  // Act
  console.log('⚡ [Act] 执行渲染...\n');
  const { outputs, failed } = await act(state, articles, formats);

  // 结果
  console.log(`\n✅ Render Agent 完成 (${failed ? '有失败' : '全部成功'})`);
  for (const out of outputs) {
    console.log(`   ${out.format}: ${out.path}`);
  }
  console.log(`   状态: ${failed ? 'FAILED' : 'COMPLETED'}`);
}
