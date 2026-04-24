# Summarize Agent

## 目标
对抓取的文章列表生成 AI 摘要，提升日报可读性，确保输出质量不低于硬编码版本的 `AISummarizer`。

## 感知 (Perceive)
- 输入：
  - `.pipeline/articles-raw.json` — 待摘要的文章列表（从 Fetch Agent 产出）
  - `.pipeline/state.json` — 获取模型配置参数（model, max_tokens, temperature）
  - 环境变量：`ANTHROPIC_API_KEY`（实际使用 DeepSeek API）
- 触发条件：
  - 独立运行：`claude --agent summarize-agent` 或 `tsx src/cli.ts agent summarize-agent`
  - 管线运行：Orchestrator 检测到状态为 FETCHED 时发起

## 思考 (Think)
- 决策1：**前置检查** — 确认 articles-raw.json 存在且不为空，确认 API key 已配置，否则跳过并报告
- 决策2：**进度策略** — 文章数 > 20 时每 10 篇输出一次进度，否则每 5 篇
- 决策3：**重试策略** — API 调用失败时最多重试 1 次（非 2 次，避免过度消耗 token），失败后保留原始 description 兜底
- 决策4：**质量门槛** — AI summary 长度 < 20 字符视为无效，降级到原始 description
- 决策5：**状态管理** — 开始前检查是否已经 SUMMARIZED（跳过已完成的工作），防止重复运行

## 行动 (Act)
- 输出：写入 `.pipeline/articles-summarized.json`
  - 格式：与 articles-raw.json 结构一致，每篇文章增加 `aiSummary` 字段
- 调用：
  - `AISummarizer.summarizeArticles()` — 批量生成摘要（内部含串行调用 + 速率限制）
  - 质量评估：检查每篇 aiSummary 长度和内容有效性
  - 兜底：AI 失败时保留原始 description，不阻塞流程
- 状态更新：
  - 开始：设置 state.agents.summarize.status = "running", state.currentStage = "summarizing"
  - 成功：设置 state.agents.summarize.status = "success", state.status = "SUMMARIZED"
  - 失败：设置 state.agents.summarize.status = "failed", state.status = "FAILED"

## 约束
- 不修改抓取和渲染逻辑
- API 密钥从环境变量读取，不硬编码
- 控制 token 消耗：避免重复处理已摘要的文章
- rateLimitDelay 保持在 1000ms，避免 DeepSeek API 限流
- 不并行调用 API（当前实现使用串行 + 延迟，保持稳定）

## 验收标准
- [ ] 每篇文章的 aiSummary 字段非空（或保留原始 description）
- [ ] API 失败时自动降级到原始描述
- [ ] 支持从 articles-raw.json 读取并写入 articles-summarized.json
- [ ] 状态文件正确标记 summarize agent 的结果
- [ ] 输出质量不低于当前 `src/services/summarizer.ts` 的硬编码版本
- [ ] 可独立运行：`tsx src/cli.ts agent summarize-agent`
- [ ] 幂等：重复运行不再重复消耗 API（已摘要的文章直接透传）
