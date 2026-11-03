# 设计系统（Design Tokens 与视觉规范）

> 应用内活文档：`/#/spec`（直接读取 CSS 变量渲染，与实现永远同源）。
> 本文是令牌的静态参考与使用规则；**数值的唯一来源是 `web/src/styles/tokens.css`**，两处不一致时以代码为准并立即修文档。

## 令牌分层

```
基础色阶（--lc-brand-500 / --lc-gray-200）      ← 表达"是什么颜色"
        ↓
语义令牌（--lc-text-2 / --lc-border / --lc-primary-soft） ← 表达"用在哪"
        ↓
组件样式（global.css / 组件 <style scoped>）    ← 只允许引用语义层
```

## 色彩

### 品牌色

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--lc-brand-25` | `#f5f8ff` | 最浅强调底（列表悬停描边、演示底色） |
| `--lc-brand-50` | `#f0f4ff` | Element Plus primary-light-9（alert info 底） |
| `--lc-brand-100` | `#eef3ff` | 选中底、图标底（`--lc-primary-soft`） |
| `--lc-brand-200` | `#e1e9ff` | EP light-8 |
| `--lc-brand-300` | `#d0deff` | 浅描边（提示条边框） |
| `--lc-brand-400` | `#a8bffc` | EP light-5 |
| `--lc-brand-500` | `#3b6ef6` | **主色**：可点击/选中/进行中 |
| `--lc-primary-light` | `#7d9dfa` | 主色浅一档（hover、EP light-3） |
| `--lc-brand-600` | `#2f59d0` | 主色按下/hover（`--lc-primary-hover`） |
| `--lc-brand-700` | `#2647a8` | 深强调，少量使用 |
| `--lc-brand-gradient` | `135deg #3b6ef6→#7b5bf0` | 仅品牌 Logo |

### 中性色

0 `#ffffff` / 25 `#fbfcfe` / 50 `#f6f7f9` / 100 `#eef0f4` / 200 `#e5e7eb` / 300 `#d3d7de` / 400 `#b0b7c3` / 500 `#98a2b3` / 600 `#667085` / 700 `#475467` / 800 `#344054` / 900 `#101828`。

常用语义映射：文字主 `--lc-text`(900)、次要 `--lc-text-2`(600)、辅助 `--lc-text-3`(500)、占位 `--lc-text-4`(400)；边框 `--lc-border`(200)、深描边 `--lc-border-strong`(300)、浅分隔 `--lc-border-subtle`(100)；页面底 `--lc-bg`(50)、画布底 `--lc-bg-canvas`(100)、卡片 `--lc-surface`(0)。

### 语义状态

| 状态 | 主色 | 浅底 | 描边 | 深文字 |
| --- | --- | --- | --- | --- |
| 成功 | `--lc-success` #12b76a | `--lc-success-bg` #ecfdf3 | `--lc-success-border` #a6f4c5 | `--lc-success-text` #067647 |
| 警告 | `--lc-warning` #f79009 | `--lc-warning-bg` #fffaeb | `--lc-warning-border` #fedf89 | `--lc-warning-text` #b54708 |
| 危险 | `--lc-danger` #f04438 | `--lc-danger-bg` #fef3f2 | `--lc-danger-border` #fecdca | `--lc-danger-text` #b42318 |
| 信息 | `--lc-info` = 主色 | `--lc-info-bg` = brand-100 | `--lc-info-border` = brand-300 | — |

规则：浅底上的状态文字一律用 `-text` 深色变体（对比度 ≥ 4.5:1），不用原色直接做文字。

## 字阶

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--lc-fs-h1/h2/h3` | 32 / 24 / 20 | 页面标题 / 章节标题 / 大数字标题 |
| `--lc-fs-title` | 16 | 小节标题、卡片标题 |
| `--lc-fs-body` | 14 | 正文、控件 |
| `--lc-fs-sm` | 13 | 次要说明、表单标签 |
| `--lc-fs-caption` | 12 | 辅助信息、徽标、时间戳 |

行高：标题 `--lc-lh-tight` 1.25；正文 1.5；说明文字 `--lc-lh-relaxed` 1.7。字重 400/500/600/700（`--lc-fw-*`）。字体：`--lc-font-sans` 系统栈、`--lc-font-mono` 等宽栈。

## 间距 / 圆角 / 阴影 / 动效

- 间距 4px 基数：`--lc-space-1..12` = 4/8/12/16/20/24/32/40/48。
- 圆角：`--lc-radius-xs/sm/md/lg/xl/full` = 4/6/8/10/12/999；卡片默认 `--lc-radius`(10)。
- 阴影：`--lc-shadow-xs/sm/md` 表达悬浮层级；`--lc-shadow-brand` 仅用于品牌色元素的悬停反馈。
- 动效：交互反馈 150ms（`--lc-duration-fast`），布局变化 200ms，统一缓动 `--lc-ease`。
- 层级：`--lc-z-badge(5) / header(10) / sticky(20) / overlay(1000)`，新增层级先看能否复用。

## 布局常量

`--lc-header-h` 56px 顶栏 · `--lc-left-w` 252px 组件面板 · `--lc-right-w` 306px 属性面板 · `--lc-list-max` 1240px 列表内容区 · `--lc-viewer-max` 1080px 运行态内容区。embed 模式下 `--lc-bg/--lc-surface` 被重置为透明（`html.lc-embed`）。

## 使用规则（硬性）

1. 业务样式禁止 `#hex` 与随手 px；令牌文件（tokens.css）是唯一允许定义色值的地方。
2. 业务样式优先引用语义令牌；确实需要色阶时用基础令牌并注释原因。
3. 新增令牌：基础值 + 语义映射 + 注释三件套，同时更新 `/#/spec` 与本文。
4. `docs-test.mjs` 会校验规范页展示值与 CSS 变量一致——改了令牌不更新规范页会挂测试。
5. 组件库主题（Element Plus）通过 `--el-*` 映射对齐令牌，不要在组件上覆盖 `--el-color-primary`。
