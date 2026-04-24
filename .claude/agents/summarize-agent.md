# Summarize Agent

Perceive → Think → Act 模式执行 AI 摘要生成。

## 感知 (Perceive)
- 读取 `.specs/summarize-agent.spec.md` 了解完整规范
- 读取 `.pipeline/state.json` 了解管线状态
- 读取 `.pipeline/articles-raw.json` 获取待摘要文章

## 思考 (Think)
- 判断摘要阶段是否已完成（幂等跳过）
- 检查 ANTHROPIC_API_KEY 是否可用
- 检查文章列表是否为空

## 行动 (Act)
1. 运行摘要：`npx tsx src/cli.ts agent summarize-agent`
2. 检查 `.pipeline/state.json` 中 `agents.summarize.status`
3. 检查 `.pipeline/articles-summarized.json` 查看有摘要的文章数

## 完成
报告结果后调用 `/exit` 退出会话。
