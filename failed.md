# CI 故障记录：undici/File API 兼容错误

## 错误信息

```
ReferenceError: File is not defined
    at Object.<anonymous> (.../node_modules/undici/lib/web/webidl/index.js:537:48)

Node.js v18.20.8
```

## 时间线

| 时间 | 事件 |
|---|---|
| 2026-04-29 | 提交 `2715426`，新增 HTML 爬取引擎，引入 `cheerio@1.2.0` 依赖 |
| 2026-04-30 | CI 定时任务首次报错 |
| 2026-04-30 | 尝试修复1：CI Node 18 → 20（未触及根本原因） |
| 2026-04-30 | 尝试修复2：移除 `node-fetch`（undici 实际来自 cheerio，非 node-fetch） |
| 2026-04-30 | **最终修复**：使用 `cheerio/slim` 入口 + CI Node 22 |

## 根因

`cheerio@1.2.0` 的主入口 `index.ts` 在顶层静态导入 `undici`：

```ts
import * as undici from 'undici';
```

undici 仅用于 cheerio 的 `fromURL()` 函数，但顶级 import 导致加载 cheerio 时 undici 一定会被初始化。

`undici@7.25.0` 使用了全局 `File` API，该 API **只在 Node.js 20+ 中可用**。CI 运行在 Node.js 18 上，因此报错 `ReferenceError: File is not defined`。

完整依赖链：

```
cheerio@1.2.0 → undici@^7.19.0 → 需要全局 File API (Node 20+)
```

## 修复方案

### 核心修复：切换到 cheerio/slim

`cheerio` 提供了 `/slim` 入口，不包含 undici 依赖，支持所有标准 DOM 操作（`load()`、`$()`、`.text()`、`.find()`、`.each()` 等）。

```diff
- import * as cheerio from 'cheerio';
+ import * as cheerio from 'cheerio/slim';
```

项目只使用了 `cheerio.load(html)` 来解析 HTML，不依赖 `fromURL()`，因此 `/slim` 完全够用。

验证：运行时 undici 模块缓存为 0（未被加载）。

### 配套改动

| 文件 | 改动 | 原因 |
|---|---|---|
| [package.json](package.json) | 添加 `engines.node >=20` | 防止未来在低版本 Node 上安装 |
| [tsconfig.json](tsconfig.json) | `moduleResolution: "node"` → `"bundler"` | `cheerio/slim` 使用 `exports` 字段，需要 bundler 模式 |
| [.github/workflows/daily-news.yml](.github/workflows/daily-news.yml) | Node 18 → 22 + 输出 `node -v` | CI 环境升级 + 方便后续排查 |

### 排查教训

1. **不要假设依赖链**：第一次以为是 `node-fetch` 带来的 undici，实际是 `cheerio`。应该用 `npm ls undici` 确认来源。
2. **不要只看表面错误**：`File is not defined` 表面看是 Node 版本问题，深层原因是 cheerio 加载了不需要的 undici。即使升级 Node 版本能绕过，改用 `/slim` 是更干净的方案。
3. **验证修复要确认 CI 确实跑到了新代码**：第二次用户看到的错误仍是旧 workflow run，需要触发新 run 而非重试旧 run。
