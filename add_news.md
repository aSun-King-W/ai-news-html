# 新增 AI 新闻源实施计划

## 目标
扩充新闻源覆盖面，加入主流 AI 媒体：Claude (Anthropic)、Codex (OpenAI)、DeepSeek、Hugging Face、机器之心等。

## 新增源清单

| 源 | URL | 接入方式 | 说明 |
|---|---|---|---|
| **OpenAI** | `https://openai.com/news/rss.xml` | RSS（现有 rss-parser） | 覆盖 Codex 等所有 OpenAI 动态 |
| **Hugging Face** | `https://huggingface.co/blog/feed.xml` | RSS（现有 rss-parser） | AI 开源社区核心动态 |
| **Anthropic (Claude)** | `https://www.anthropic.com/news` | HTML 爬取（cheerio） | 无官方 RSS，自建桥接 |
| **DeepSeek** | `https://api-docs.deepseek.com/news/` | HTML 爬取（cheerio） | 无官方 RSS，自建桥接 |
| **机器之心** | `https://www.jiqizhixin.com/` (待确认) | RSS 或 HTML | 类型已存在但未配置 |

## 关键设计决策

1. **HTML 源与 RSS 源分离** — 新增 `HTML_SOURCES` 数组，避免把 HTML 页面 URL 传给 rss-parser
2. **爬取串行执行** — HTML 爬取间加 1s 延迟，避免触发反爬
3. **AI 源绕过关键词过滤** — OpenAI/Anthropic/Hugging Face/DeepSeek 的文章天然 AI 相关，直接放行
4. **集中式类型映射** — 抽取 `sourceTypeToDisplayName()` 消除冗长的三元表达式

## 实施步骤

### Step 1: 安装依赖
```bash
npm install cheerio
```

### Step 2: 类型定义 — `src/types/article.ts`
- `RssSource.type` 新增：`'openai' | 'huggingface' | 'anthropic' | 'deepseek'`
- `Article.source` 新增：`'OpenAI' | 'Hugging Face' | 'Anthropic' | 'DeepSeek'`
- `'jiqizhixin'` / `'JiQiZhiXin'` 已存在无需修改

### Step 3: 配置 — `src/config.ts`
- `RSS_SOURCES` 新增 OpenAI、Hugging Face
- 新增 `HTML_SOURCES: RssSource[]` 含 Anthropic、DeepSeek

### Step 4: 工具函数 — 新建 `src/fetchers/source-map.ts`
- `sourceTypeToDisplayName()` 统一管理所有源的类型→显示名映射
- 替换 `fetchers/index.ts` 第 77-83 行的三元表达式

### Step 5: HTML 爬取引擎 — 新建 `src/fetchers/html-scraper.ts`
- `fetchAndLoadHtml(url)` — node-fetch + cheerio 获取并解析页面
- `scrapeHtmlFeed(source)` — 按 source.type 分发到各站点爬取函数
  - `scrapeAnthropicNews($)` — 提取文章标题、链接、日期
  - `scrapeDeepSeekNews($)` — 同上
- `scrapeAllHtmlFeeds(sources)` — 串行执行所有 HTML 源
- 策略：多重 CSS 选择器回退 + try/catch + date-fns 多格式日期解析

### Step 6: 关键词过滤 — `src/processors/filter.ts`
- 新增 `INHERENTLY_AI_SOURCES` 集合（OpenAI/Hugging Face/Anthropic/DeepSeek）
- `filterAIArticles()` 中 AI 源文章直接放行，不参与关键词匹配
- 不影响现有的 21 个测试用例

### Step 7: 集成 Fetch Agent — `src/agents/fetch-agent.ts`
- `fetchAllFeeds(RSS_SOURCES)` 后追加 `scrapeAllHtmlFeeds(HTML_SOURCES)`
- 重试逻辑区分 RSS 源和 HTML 源

### Step 8: 图标 — `src/generators/html.ts`
- `getSourceIcon()` 中添加新源对应的 Font Awesome 图标

### Step 9: CLI — `src/cli.ts`
- `fetch` 命令中追加 HTML 源抓取

### Step 10: 测试验证
```bash
# 全管线运行测试
npx tsx src/cli.ts agent orchestrator --force
# 查看抓取结果
cat .pipeline/articles-raw.json
# 运行单元测试
vitest run
```

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 目标站 HTML 结构变更 | 多重选择器回退，失败不阻塞管线 |
| 反爬封禁 | 串行 + 1s 间隔 + User-Agent |
| 日期解析失败 | 兜底 `new Date()`，不丢文章 |
| 外网无法访问 | 失败返回空数组，管线继续运行 |
