# SPEC: AI News Agent Ecosystem

## 1. 核心理念：Spec-Coding

用结构化的、近乎自然语言的规范描述（Specification），来定义 AI Agent **"感知-思考-行动"** 的流程，替代传统的过程式硬编码逻辑。

每个 Agent 遵循统一的执行模型：

```
Perceive → Think → Act
   ↑                    │
   └────── Loop ────────┘
```

| 阶段 | 含义 |
|---|---|
| **Perceive（感知）** | 从环境读取输入：状态文件、参数、上下文 |
| **Think（思考）** | 根据 Spec 和目标分析信息，做出决策 |
| **Act（行动）** | 执行具体操作：调用函数、写文件、发起请求 |

## 2. 管线总览

```
┌──────────────────────────────────────────────────────────┐
│                   Orchestrator Agent                      │
│  读 orchestrator.spec.md → 编排流程 → 管理状态 → 异常处理 │
└─────┬───────────┬───────────┬───────────┬────────────────┘
      │ step 1    │ step 2    │ step 3    │
      ▼           ▼           ▼           │
 ┌─────────┐ ┌─────────┐ ┌─────────┐     │
 │  Fetch  │→│Summarize│→│ Render  │     │
 │  Agent  │ │  Agent  │ │  Agent  │     │
 │ 偏刚性   │ │ 偏柔性   │ │ 中刚性   │     │
 └─────────┘ └─────────┘ └─────────┘     │
      │           │           │           │
      ▼           ▼           ▼           ▼
      ┌──────────────────────────────────────┐
      │          Pipeline State              │
      │  .pipeline/state.json （Orchestrator │
      │  管理的共享状态，子Agent只读/写约定字段）│
      └──────────────────────────────────────┘
```

## 3. Agent 定义

### 3.1 Orchestrator Agent

| 属性 | 描述 |
|---|---|
| **Spec** | `.specs/orchestrator.spec.md` |
| **职责** | 管线调度、状态管理、错误处理、子 Agent 生命周期 |
| **感知** | CLI 参数、管线状态文件、上次运行日志 |
| **思考** | 决定执行哪些阶段、检查前置条件、判断是否需要重试 |
| **行动** | 按顺序启动子 Agent、传递上下文、汇总结果、报告状态 |
| **粒度** | 中等——调度逻辑需要稳定，但异常处理策略可灵活决策 |

### 3.2 Fetch Agent

| 属性 | 描述 |
|---|---|
| **Spec** | `.specs/fetch-agent.spec.md` |
| **职责** | RSS 抓取 + HTML 页面爬取、解析、去重、关键词过滤、时效控制 |
| **感知** | RSS 源配置列表 + HTML 源配置列表、上次抓取时间戳（来自状态文件） |
| **思考** | 决定源可用性、超时策略、去重阈值；对 HTML 源失败降级（不阻塞管线） |
| **行动** | 调用现有 `fetchers/index.ts`（RSS）+ `fetchers/html-scraper.ts`（HTML），写入结构化文章 JSON |
| **粒度** | 偏刚性——抓取逻辑需要稳定可预期 |

### 3.3 Summarize Agent

| 属性 | 描述 |
|---|---|
| **Spec** | `.specs/summarize-agent.spec.md` |
| **职责** | AI 摘要生成、prompt 管理、质量评估、兜底策略 |
| **感知** | 待摘要文章列表（来自 Fetch Agent 输出） |
| **思考** | 决定 prompt 模板、模型参数（temperature/max_tokens）、并发策略、是否重试 |
| **行动** | 调用现有 `services/summarizer.ts` 或自定义 prompt，写回摘要 |
| **粒度** | 偏柔性——prompt 工程和策略需要实验空间 |

### 3.4 Render Agent

| 属性 | 描述 |
|---|---|
| **Spec** | `.specs/render-agent.spec.md` |
| **职责** | Markdown/HTML 生成、模板选择、样式管理 |
| **感知** | 带摘要的文章列表、输出配置（格式、目录） |
| **思考** | 选择模板、决定目录结构、判断是否需要更新样式 |
| **行动** | 调用现有 `generators/markdown.ts` 和 `generators/html.ts`，写入输出文件 |
| **粒度** | 中等——渲染输出需规范，但模板选择可灵活 |

## 4. 通信协议：Pipeline State

Agent 之间通过 **Pipeline State（管线状态）** 交换数据，由 Orchestrator 统一管理。

### 状态文件结构

```
.pipeline/
├── state.json            # 管线运行状态（当前阶段、开始时间、各 Agent 状态）
├── articles-raw.json     # Fetch Agent 产出：原始文章列表
├── articles-summarized.json  # Summarize Agent 产出：带摘要的文章列表
└── output-manifest.json  # Render Agent 产出：输出文件清单
```

### 数据流

```
                ┌──────────────────┐
                │   state.json     │←─── Orchestrator 读写
                │  阶段/状态/元数据  │      子 Agent 只读
                └────────┬─────────┘
                         │
   Fetch Agent 写入       │  Summarize Agent 写入   Render Agent 写入
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ articles-raw.json│→│ articles-summarized  │→│ output-manifest.json │
│                  │  │       .json          │  │                      │
└──────────────────┘  └──────────────────────┘  └──────────────────────┘
```

### 状态流转

```
PENDING → FETCHING → FETCHED → SUMMARIZING → SUMMARIZED → RENDERING → COMPLETED
                  (失败)                           (失败)              (失败)
                    ↓                               ↓                    ↓
                 FAILED                          FAILED               FAILED
```

## 5. Spec 文件模板

每个 `.specs/*.md` 文件采用统一的结构：

```markdown
# Agent 名称

## 目标
一句话描述Agent存在的意义

## 感知 (Perceive)
- 输入：从 Pipeline State 的哪些字段读取数据
- 触发条件：什么情况下被唤醒

## 思考 (Think)
- 决策1：[决策规则/策略]
- 决策2：[决策规则/策略]

## 行动 (Act)
- 输出：写入 Pipeline State 的哪些字段
- 调用：哪些现有工具函数

## 约束
- 不可越界的行为
- 安全/错误处理规则

## 验收标准
- 如何判断本次执行成功
```

## 6. 与现有代码的关系

- **现有 TypeScript 代码保留**为工具函数库，Agent 按需调用
- Agent 负责**决策层**（用哪个 prompt、重试几次、选哪个模板），不重写确定性逻辑
- 逐步替换：从 Summarize Agent 开始验证 → 再扩展 Fetch 和 Render
- Orchestrator 最终对接 GitHub Actions，实现全自动管线

## 7. 实施路线

### Phase 1：基础设施
1. 创建 `SPEC.md`（本文件）
2. 创建 `CLAUDE.md` — Agent 注册表 + Spec 索引
3. 创建 `.specs/` 目录 + 4 个 Spec 文件
4. 创建 `.pipeline/` 目录
5. 在 `src/cli.ts` 添加 `agent` 命令入口

### Phase 2：Summarize Agent（首个验证）
1. 详细编写 `summarize-agent.spec.md`
2. 实现 Agent 入口逻辑（读 spec → 执行 perceive-think-act）
3. 对比验证：输出质量不低于当前硬编码版本

### Phase 3：Fetch Agent + Render Agent
1. 详细编写各自的 Spec 文件
2. 实现 Agent 入口
3. 测试独立运行各项

### Phase 4：Orchestrator Agent 整合 ✅
1. 创建 `orchestrator.spec.md` ✅
2. 实现管线调度 + 状态管理 + 错误处理 ✅
3. 对接 GitHub Actions ✅

## 8. Agent 运行方式

### 主方案：CLI agent 命令（推荐）

通过 `npx tsx src/cli.ts agent <name>` 直接运行 Agent，无需启动 Claude Code 对话。Orchestrator 会在一个进程内按序执行子 Agent（fetch → summarize → render）：

```bash
# 完整管线
npx tsx src/cli.ts agent orchestrator --force

# 单独调试某个环节
npx tsx src/cli.ts agent fetch-agent
npx tsx src/cli.ts agent summarize-agent
npx tsx src/cli.ts agent render-agent
```

Orchestrator 自动管理状态流转、处理重试和降级，跑完自动退出。

### 辅助方案：Claude Code `--agent` 模式

通过 `claude --agent .claude/agents/<name>.md` 启动独立的 Claude Code 会话，适合需要人工观察和干预的场景：

```bash
claude --agent .claude/agents/orchestrator.md
claude --agent .claude/agents/summarize-agent.md
```

### 对话式

日常开发中也可在当前对话直接调用 Agent 任务，三种方式互补共存。
