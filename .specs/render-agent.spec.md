# Render Agent

## 目标
将带摘要的文章列表渲染为 Markdown 日报和/或 HTML 页面。

## 感知 (Perceive)
- 输入：
  - `.pipeline/articles-summarized.json` — 带摘要的文章列表
  - `.pipeline/state.json` — 获取输出格式和目录配置
- 触发条件：Orchestrator 发起 render 阶段

## 思考 (Think)
- 决策1：根据配置决定输出格式（markdown / html / both）
- 决策2：选择模板（日报视图、手机优化视图等）
- 决策3：判断是否需要更新样式或目录结构

## 行动 (Act)
- 输出：写入 `.pipeline/output-manifest.json`（产出文件清单）
- 调用：
  - `generateMarkdown()` — 生成 Markdown
  - `generateHtml()` — 生成 HTML
  - `generateFilename()` / `generateHtmlFilename()` — 生成文件名
  - `fs.writeFile` — 写入输出文件

## 约束
- 不修改文章内容（摘要、标题、链接保持原样）
- 输出路径由 state.json 中的 outputDir 指定
- manifest 文件必须记录所有产出文件的路径

## 验收标准
- [ ] Markdown 和/或 HTML 文件成功生成
- [ ] output-manifest.json 包含所有产出文件路径
- [ ] 输出格式与当前版本一致
