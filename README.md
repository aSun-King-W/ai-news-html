# AI News Agent Ecosystem

基于 **Spec-Coding** 模式和 **Perceive → Think → Act** 模型构建的 AI 新闻自动化管线。

由 4 个 Agent 协作完成：**Fetch Agent**（抓取）→ **Summarize Agent**（摘要）→ **Render Agent**（渲染），**Orchestrator Agent** 统一编排调度，每日 0 人工干预自动输出结构化日报。

## 功能特性

- 🤖 **Agent 协作生态** — Orchestrator 编排 Fetch → Summarize → Render 三步管线
- 📡 **RSS 新闻抓取** — 从 TechCrunch AI、The Verge AI、Hacker News、36氪、虎嗅、OpenAI、Hugging Face 等源抓取
- 🌐 **HTML 页面爬取** — 对无 RSS 的源（Anthropic、DeepSeek）通过 cheerio 解析 HTML 提取文章
- ⏰ **自动过滤** — 仅保留最近 N 小时的文章（默认 24 小时）
- 🔍 **去重 + AI 关键词过滤** — 基于链接去重，AI 源（OpenAI/Anthropic 等）直接放行，其他源关键词匹配
- 🧠 **AI 智能摘要** — 调用 LLM 为每篇文章生成一句话中文摘要
- 📊 **按时间排序** — 按发布时间倒序排列
- 📝 **Markdown 日报** — 带目录的中文 Markdown
- 🌐 **HTML 日报** — 美观手机端适配页面，支持 GitHub Pages 部署，含来源筛选交互
- ⚙️ **GitHub Actions 自动化** — 每日 8:30 自动运行全流程并部署

## 架构概览

```
┌──────────────────────────────────────────────────────┐
│                 Orchestrator Agent                    │
│  编排调度 · 状态管理 · 异常处理 · 重试机制             │
└─────┬───────────┬───────────┬────────────────────────┘
      │ step 1    │ step 2    │ step 3
      ▼           ▼           ▼
 ┌─────────┐ ┌─────────┐ ┌─────────┐
 │  Fetch  │→│Summarize│→│ Render  │
 │  Agent  │ │  Agent  │ │  Agent  │
 │  抓取新闻 │ │ AI 摘要  │ │ 生成输出 │
 └─────────┘ └─────────┘ └─────────┘
      │           │           │
      ▼           ▼           ▼
 ┌──────────────────────────────────────────────────────┐
 │                  Pipeline State                       │
 │  .pipeline/state.json（Orchestrator 统一管理）         │
 └──────────────────────────────────────────────────────┘
```

每个 Agent 遵循 **Perceive（感知）→ Think（思考）→ Act（行动）** 模型，通过 `.pipeline/` 目录下的状态文件通信，互不直接调用。

### Spec-Coding 模式

每个 Agent 的行为由对应的 Spec 文件定义：

| Agent | Spec 文件 |
|---|---|
| Orchestrator | [.specs/orchestrator.spec.md](.specs/orchestrator.spec.md) |
| Fetch Agent | [.specs/fetch-agent.spec.md](.specs/fetch-agent.spec.md) |
| Summarize Agent | [.specs/summarize-agent.spec.md](.specs/summarize-agent.spec.md) |
| Render Agent | [.specs/render-agent.spec.md](.specs/render-agent.spec.md) |

## 安装使用

### 安装依赖
```bash
npm install
```

### 环境变量配置（AI摘要功能）
如需使用AI摘要功能，需要配置 API 密钥：

1. 复制 `.env.example` 为 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，设置你的 API 密钥：
   ```
   ANTHROPIC_API_KEY=sk-your-api-key-here
   AI_SUMMARY_ENABLED=true
   AI_MODEL=deepseek-chat
   AI_MAX_TOKENS=100
   AI_TEMPERATURE=0.7
   ```

### 运行管线

推荐方式 — 通过 Orchestrator Agent 一站式跑完：

```bash
# 完整管线（fetch → summarize → render）
npx tsx src/cli.ts agent orchestrator --force

# 有状态运行（跳过已完成的阶段）
npx tsx src/cli.ts agent orchestrator
```

也可以单独运行某个 Agent 调试：

```bash
npx tsx src/cli.ts agent fetch-agent      # 只跑抓取
npx tsx src/cli.ts agent summarize-agent   # 只跑摘要
npx tsx src/cli.ts agent render-agent      # 只跑渲染
```

### 直接使用原版 fetch 命令

也保留原有单步命令：

```bash
# 基本使用（默认抓取最近24小时）
npx tsx src/cli.ts fetch

# 启用AI摘要功能
npx tsx src/cli.ts fetch --ai-summary

# 生成HTML格式日报
npx tsx src/cli.ts fetch --html-output

# 指定输出目录
npx tsx src/cli.ts fetch --output-dir ./reports

# 自定义时间范围（例如最近12小时）
npx tsx src/cli.ts fetch --hours 12

# 组合使用
npx tsx src/cli.ts fetch --hours 48 --ai-summary --html-output

# 查看帮助
npx tsx src/cli.ts --help
npx tsx src/cli.ts fetch --help
```

## 项目结构
```
ai-news-html/
├── src/
│   ├── agents/              # Agent 入口（Perceive → Think → Act）
│   │   ├── orchestrator-agent.ts
│   │   ├── fetch-agent.ts
│   │   ├── summarize-agent.ts
│   │   └── render-agent.ts
│   ├── config.ts            # RSS 源 + HTML 源配置
│   ├── cli.ts              # 命令行入口（支持 RSS + HTML 抓取）
│   ├── fetchers/           # RSS 抓取 + HTML 爬取模块
│   │   ├── index.ts        # RSS 抓取引擎
│   │   ├── html-scraper.ts # HTML 页面爬取引擎（cheerio）
│   │   └── source-map.ts   # 源类型→显示名映射
│   ├── processors/         # 数据处理模块（过滤/去重/排序）
│   ├── generators/         # Markdown/HTML 生成模块
│   ├── services/           # AI 摘要服务
│   └── types/             # TypeScript 类型定义
├── .specs/                 # Agent Spec 定义文件
│   ├── orchestrator.spec.md
│   ├── fetch-agent.spec.md
│   ├── summarize-agent.spec.md
│   └── render-agent.spec.md
├── .pipeline/              # 管线状态（Agent 间通信）
│   ├── state.json
│   ├── articles-raw.json
│   ├── articles-summarized.json
│   └── output-manifest.json
├── .claude/
│   └── agents/             # Agent 指令（claude --agent 入口）
│       ├── orchestrator.md
│       ├── fetch-agent.md
│       ├── summarize-agent.md
│       └── render-agent.md
├── output/                 # 生成的日报文件
├── .github/workflows/      # GitHub Actions 自动化配置
├── SPEC.md                 # Agent 生态总体规范
├── CLAUDE.md               # Agent 注册表 + Spec 索引
├── package.json
├── tsconfig.json
└── README.md
```

## 输出示例

生成的日报包含：
- 生成时间和日期
- 文章统计摘要
- 可点击的目录
- 按来源分组的文章列表
- 每篇文章的标题、链接、发布时间
- 每篇文章的 AI 摘要（如启用 API 密钥）

## 技术栈
- **TypeScript** — 类型安全的 JavaScript 超集
- **tsx** — 直接运行 TypeScript
- **commander** — CLI 框架
- **rss-parser** — RSS/Atom 解析
- **cheerio** — HTML 爬取与 DOM 解析
- **node-fetch** — HTTP 请求
- **date-fns** — 日期处理
- **openai** — OpenAI SDK（兼容 DeepSeek API）
- **Claude Code `--agent`** — Agent 指令入口（`.claude/agents/`）

## 手机访问（公众号集成）

通过生成HTML日报并部署到GitHub Pages，您可以将每日AI新闻集成到微信公众号菜单中。

### GitHub Actions 自动化

项目已配置 GitHub Actions 工作流（`.github/workflows/daily-news.yml`），每天 **北京时间 8:30** 自动执行完整管线（由 Orchestrator Agent 编排），并部署到 GitHub Pages。

**自动化流程：**
1. 定时触发 → 2. 安装依赖 → 3. Orchestrator Agent 执行管线（fetch → summarize → render） → 4. 部署到 GitHub Pages

**手动触发：** 仓库 Actions → Daily AI News Update → Run workflow

### 公众号配置
1. 登录[微信公众平台](https://mp.weixin.qq.com/)
2. 进入「自定义菜单」设置
3. 添加菜单项：
   - **菜单名称**：AI技术日报
   - **菜单类型**：跳转网页
   - **网页地址**：`https://你的用户名.github.io/ai-news-html/`（GitHub Pages地址）
4. 提交审核（约1-3个工作日）

### 访问方式
- **公众号菜单跳转**：进入公众号 → 点击菜单 → 查看HTML日报
- **电脑浏览器**：直接访问GitHub Pages链接
- **自动更新**：每日上午8:30自动生成最新内容

### 页面特点
- 🎨 **美观自由风设计**：渐变背景、卡片式布局、平滑动画
- 📱 **完全响应式**：完美适配手机、平板、电脑
- ⚡ **快速加载**：静态HTML，无后端依赖
- 🔍 **交互功能**：按来源筛选、平滑滚动、原生链接
- 🕐 **自动更新**：GitHub Actions Orchestrator Agent 每日执行

---

## 扩展开发

### Agent 化开发模式

新增功能时，遵循以下原则：
1. **Spec 先行**：在 `.specs/` 中定义 Agent 的感知-思考-行动规则
2. **决策在 Agent**：Agent 只做决策层（判断做什么），执行层调用现有函数库
3. **状态通信**：Agent 之间通过 `.pipeline/` 状态文件交换数据，不直接调用

### 添加新的新闻源

**RSS 源**：在 `src/config.ts` 的 `RSS_SOURCES` 数组中添加新源配置，参考已有条目。

**HTML 爬取源**（无 RSS 的网站）：
1. 在 `src/config.ts` 的 `HTML_SOURCES` 数组中添加源配置
2. 在 `src/fetchers/html-scraper.ts` 中新增对应的爬取函数
3. 在 `src/fetchers/source-map.ts` 中添加类型→显示名映射
4. 在 `src/generators/html.ts` 的 `getSourceIcon()` 中添加图标

### 修改输出格式
编辑 `src/generators/markdown.ts` 或 `src/generators/html.ts`。

### 调整过滤规则
修改 `src/processors/filter.ts` 中的过滤逻辑。

### 新增一个 Agent
1. 在 `.specs/` 创建 Spec 文件
2. 在 `src/agents/` 实现 Perceive → Think → Act 入口函数
3. 在 `src/cli.ts` 注册 `agent` 命令
4. 在 `CLAUDE.md` 注册到 Agent 注册表
5. 在 `.claude/agents/` 创建对应的 AGENT.md

## 许可证
MIT