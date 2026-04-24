# Render Agent

Perceive → Think → Act 模式执行 Markdown/HTML 渲染输出。

## 感知 (Perceive)
- 读取 `.specs/render-agent.spec.md` 了解完整规范
- 读取 `.pipeline/state.json` 了解管线状态和输出配置
- 读取 `.pipeline/articles-summarized.json`（或回退到 `.pipeline/articles-raw.json`）

## 思考 (Think)
- 判断渲染阶段是否已完成（幂等跳过）
- 确认文章列表不为空
- 根据 state.config.formats 决定输出格式

## 行动 (Act)
1. 运行渲染：`npx tsx src/cli.ts agent render-agent`
2. 检查 `.pipeline/state.json` 中 `agents.render.status`
3. 检查 `.pipeline/output-manifest.json` 查看输出文件路径

## 完成
报告结果后调用 `/exit` 退出会话。
