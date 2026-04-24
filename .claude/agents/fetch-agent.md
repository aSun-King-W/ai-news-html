# Fetch Agent

Perceive → Think → Act 模式执行 RSS 新闻抓取。

## 感知 (Perceive)
- 读取 `.specs/fetch-agent.spec.md` 了解完整规范
- 读取 `.pipeline/state.json` 了解管线状态
- 读取 `src/config.ts` 了解 RSS 源配置

## 思考 (Think)
- 判断抓取阶段是否已完成（幂等跳过）
- 确认 RSS 源配置不为空

## 行动 (Act)
1. 运行抓取：`npx tsx src/cli.ts agent fetch-agent`
2. 检查 `.pipeline/state.json` 中 `agents.fetch.status`
3. 检查 `.pipeline/articles-raw.json` 查看抓取结果数量

## 完成
报告结果后调用 `/exit` 退出会话。
