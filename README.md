# AI新闻聚合CLI工具

一个用TypeScript编写的命令行工具，用于从多个RSS源抓取AI相关新闻，生成中文Markdown日报。

## 功能特性

- 📡 从多个主流RSS源抓取AI相关新闻：
  - TechCrunch AI
  - The Verge AI  
  - Hacker News AI（前30条）
  - 36氪 (36Kr)
  - 虎嗅 (Huxiu)
- ⏰ 自动过滤最近24小时（可配置）的文章
- 🔍 文章去重，基于链接避免重复
- 🧠 **AI智能摘要** - 使用DeepSeek API为文章生成一句话中文摘要（需配置API密钥）
- 📊 按发布时间倒序排序
- 📝 生成带目录的中文Markdown日报
- 🌐 生成美观的HTML页面，支持手机访问和公众号集成
📁 自动保存到output目录
- 🛠️ 支持自定义输出目录和时间范围

## 安装使用

### 安装依赖
```bash
npm install
```

### 环境变量配置（AI摘要功能）
如需使用AI摘要功能，需要配置DeepSeek API密钥：

1. 复制 `.env.example` 为 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，设置你的DeepSeek API密钥：
   ```
   ANTHROPIC_API_KEY=sk-your-deepseek-api-key-here
   AI_SUMMARY_ENABLED=true
   AI_MODEL=deepseek-chat
   AI_MAX_TOKENS=100
   AI_TEMPERATURE=0.7
   ```

**注意**：本项目使用DeepSeek API（兼容OpenAI格式），需要注册DeepSeek账户获取API密钥。

### 运行工具
```bash
# 使用tsx直接运行
npm run dev

# 或直接使用npx
npx tsx src/cli.ts fetch
```

### 命令行选项
```bash
# 基本使用（默认抓取最近24小时）
npx tsx src/cli.ts fetch

# 启用AI摘要功能（需要配置API密钥）
npx tsx src/cli.ts fetch --ai-summary

# 生成HTML格式日报（美观的手机页面）
npx tsx src/cli.ts fetch --html-output

# 生成公众号文章格式（适合复制到公众号编辑器）
npx tsx src/cli.ts fetch --wechat-article

# 生成公众号文章HTML版本（网页查看）
npx tsx src/cli.ts fetch --wechat-html

# 指定输出目录
npx tsx src/cli.ts fetch --output-dir ./reports

# 自定义时间范围（例如最近12小时）
npx tsx src/cli.ts fetch --hours 12

# 组合使用：启用AI摘要并生成HTML日报
npx tsx src/cli.ts fetch --hours 48 --ai-summary --html-output

# 生成带AI摘要的公众号文章
npx tsx src/cli.ts fetch --ai-summary --wechat-article

# 生成所有格式：HTML、公众号文章、Markdown
npx tsx src/cli.ts fetch --ai-summary --html-output --wechat-article

# 查看帮助
npx tsx src/cli.ts --help
npx tsx src/cli.ts fetch --help
```

### 使用npm脚本运行
```bash
# 启用AI摘要功能
npm run dev fetch -- --ai-summary

# 自定义时间范围和AI摘要
npm run dev fetch -- --hours 48 --ai-summary
```

## 项目结构
```
ai_news_digest/
├── src/
│   ├── config.ts           # RSS源配置
│   ├── cli.ts             # 命令行入口
│   ├── fetchers/          # RSS抓取模块
│   ├── processors/        # 数据处理模块
│   ├── generators/        # Markdown生成模块
│   └── types/            # TypeScript类型定义
├── output/               # 生成的日报文件
├── package.json
├── tsconfig.json
└── README.md
```

## 输出示例

生成的Markdown日报包含：
- 生成时间和日期
- 文章统计摘要
- 可点击的目录
- 按来源分组的文章列表
- 每篇文章的标题、链接、发布时间
- **AI摘要**（如启用）或原始内容摘要

## 技术栈
- **TypeScript** - 类型安全的JavaScript超集
- **tsx** - 直接运行TypeScript
- **commander** - 命令行界面框架
- **rss-parser** - RSS/Atom解析库
- **node-fetch** - HTTP请求库
- **date-fns** - 日期处理库
- **openai** - OpenAI SDK（兼容DeepSeek API）

## 手机访问（公众号集成）

通过生成HTML日报并部署到GitHub Pages，您可以将每日AI新闻集成到微信公众号菜单中。

### 生成HTML日报
```bash
# 生成HTML格式日报（美观的手机页面）
npx tsx src/cli.ts fetch --html-output

# 同时启用AI摘要功能
npx tsx src/cli.ts fetch --html-output --ai-summary

# 指定输出目录
npx tsx src/cli.ts fetch --html-output --output-dir ./dist
```

### 部署到GitHub Pages
1. **创建GitHub仓库**（如 `ai-news-html`）
2. **启用GitHub Pages**：
   - 进入仓库 Settings → Pages
   - Source 选择 `GitHub Actions`
3. **配置环境变量**（可选）：
   - 在仓库 Settings → Secrets and variables → Actions
   - 添加 `ANTHROPIC_API_KEY`（如使用AI摘要）
4. **每日自动更新**：
   - 本项目已配置GitHub Actions工作流（`.github/workflows/daily-news.yml`）
   - 每天北京时间8:30自动更新新闻并部署
   - 可手动触发：仓库 Actions → Daily AI News Update → Run workflow

### 公众号配置
1. 登录[微信公众平台](https://mp.weixin.qq.com/)
2. 进入「自定义菜单」设置
3. 添加菜单项：
   - **菜单名称**：AI技术日报
   - **菜单类型**：跳转网页
   - **网页地址**：`https://你的用户名.github.io/ai-news-html/`（GitHub Pages地址）
4. 提交审核（约1-3个工作日）

### 替代方案：公众号文章发布（解决"链接内容不属于当前公众号"问题）
如果菜单跳转遇到审核问题，可使用公众号文章格式手动发布：

1. **生成公众号文章**：
   ```bash
   npx tsx src/cli.ts fetch --ai-summary --wechat-article
   ```

2. **复制到公众号编辑器**：
   - 登录公众号后台 → 新建图文消息
   - 粘贴生成的文章内容
   - 添加封面图（建议使用AI相关图片）
   - 设置摘要和作者

3. **发布文章**：
   - 保存为草稿或直接发布
   - 用户通过公众号历史消息查看

4. **优点**：
   - ✅ 完全符合微信规定
   - ✅ 无需外部链接跳转
   - ✅ 支持富文本格式
   - ✅ 可插入图片和样式

5. **缺点**：
   - ⚠️ 需要每天手动发布（5分钟）
   - ⚠️ 个人订阅号每天只能群发一次

### 访问方式
- **公众号菜单跳转**：进入公众号 → 点击菜单 → 查看HTML日报（需审核）
- **公众号文章**：进入公众号 → 历史消息 → 查看文章（手动发布）
- **电脑浏览器**：直接访问GitHub Pages链接
- **自动更新**：每日上午8:30自动生成最新内容

### 页面特点
- 🎨 **美观自由风设计**：渐变背景、卡片式布局、平滑动画
- 📱 **完全响应式**：完美适配手机、平板、电脑
- ⚡ **快速加载**：静态HTML，无后端依赖
- 🔍 **交互功能**：按来源筛选、平滑滚动、原生链接
- 🕐 **自动更新**：GitHub Actions定时任务每日更新

---

## 扩展开发

### 添加新的RSS源
1. 在 `src/config.ts` 的 `RSS_SOURCES` 数组中添加新的源配置
2. 源类型会自动映射到对应的文章源名称

### 修改输出格式
编辑 `src/generators/markdown.ts` 中的 `generateMarkdown` 函数

### 调整过滤规则
修改 `src/processors/filter.ts` 中的过滤逻辑

## 许可证
MIT