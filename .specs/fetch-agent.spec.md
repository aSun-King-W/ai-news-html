# Fetch Agent

## 目标
从配置的 RSS 源抓取 AI 相关文章，去重、过滤，输出结构化文章列表。

## 感知 (Perceive)
- 输入：
  - `.pipeline/state.json` — 获取运行参数（hours_back）
  - `src/config.ts` — RSS_SOURCES 列表
  - `.pipeline/articles-raw.json`（可选）— 上次抓取结果用于去重
- 触发条件：Orchestrator 发起 fetch 阶段

## 思考 (Think)
- 决策1：根据上次抓取时间戳决定抓取窗口
- 决策2：对超时或失败的源，决定跳过还是重试（重试最多 1 次）
- 决策3：去重阈值（标题相似度 > 90% 视为重复）

## 行动 (Act)
- 输出：写入 `.pipeline/articles-raw.json`
- 调用：
  - `fetchAllFeeds()` — 抓取所有 RSS 源
  - `filterRecentArticles()` — 按时间过滤
  - `deduplicateArticles()` — 去重
  - `filterAIArticles()` — AI 关键词过滤
  - `sortArticlesByDate()` — 按日期排序

## 约束
- 不修改抓取逻辑（现有 fetchers/ 代码保持不动）
- 不生成摘要或渲染输出
- 必须保留原始文章的完整字段

## 验收标准
- [ ] 成功抓取所有可用 RSS 源（部分失败也可接受）
- [ ] 输出 articles-raw.json 格式正确、无重复
- [ ] 处理超时和网络错误的兜底逻辑
