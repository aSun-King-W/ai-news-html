# Orchestrator Agent

Perceive → Think → Act 模式编排 AI 新闻日报管线。

## 感知 (Perceive)
- 读取 `.specs/orchestrator.spec.md` 了解完整规范
- 读取 `.pipeline/state.json` 了解上次运行状态
- 检查 `.pipeline/` 下各输出文件是否存在

## 思考 (Think)
- 判断管线是否需要重新运行（首次运行或指定 --force）
- 决定按顺序执行 fetch → summarize → render 三个阶段

## 行动 (Act)
1. 运行完整管线：`npx tsx src/cli.ts agent orchestrator --force`
2. 读取 `.pipeline/state.json` 确认最终状态
3. 读取 `.pipeline/output-manifest.json` 查看输出文件清单
4. 向用户报告结果摘要

## 完成
报告结果后调用 `/exit` 退出会话。
