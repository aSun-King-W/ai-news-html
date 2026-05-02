# AI News Agent Ecosystem

## Agent Registry

| Agent | Spec | Command | Responsibility |
|---|---|---|---|
| Orchestrator | [orchestrator.spec.md](.specs/orchestrator.spec.md) | `claude --agent orchestrator` | Pipeline scheduling, state management, error handling |
| Fetch | [fetch-agent.spec.md](.specs/fetch-agent.spec.md) | `claude --agent fetch-agent` | RSS fetching + HTML scraping, parsing, dedup, keyword filtering |
| Summarize | [summarize-agent.spec.md](.specs/summarize-agent.spec.md) | `claude --agent summarize-agent` | AI summary generation, prompt management |
| Render | [render-agent.spec.md](.specs/render-agent.spec.md) | `claude --agent render-agent` | Markdown/HTML generation, template selection |

## Spec Index

- [SPEC.md](SPEC.md) — 总体规范，定义 Agent 感知-思考-行动模型、管线架构、状态流转
- `.specs/orchestrator.spec.md` — Orchestrator Agent 规范
- `.specs/fetch-agent.spec.md` — Fetch Agent 规范
- `.specs/summarize-agent.spec.md` — Summarize Agent 规范
- `.specs/render-agent.spec.md` — Render Agent 规范

## Pipeline State

状态文件位于 `.pipeline/` 目录，由 Orchestrator 统一管理：

| File | Writer | Reader(s) |
|---|---|---|
| `state.json` | Orchestrator | All agents (read-only) |
| `articles-raw.json` | Fetch Agent | Summarize Agent |
| `articles-summarized.json` | Summarize Agent | Render Agent |
| `output-manifest.json` | Render Agent | Orchestrator |

## Status Flow

```
PENDING → FETCHING → FETCHED → SUMMARIZING → SUMMARIZED → RENDERING → COMPLETED
                  ↘             ↘               ↘
                  FAILED        FAILED           FAILED
```

## Conventions

- Agent 代码放在 `src/agents/` 目录下
- 共享类型在 `src/types/` 中定义
- Agent 通过 Pipeline State 文件通信，不直接调用彼此
- 确定性逻辑保留在现有函数库中，Agent 只做决策层
