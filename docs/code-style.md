# 代码规范

> 原则：这份代码库会被多人/多轮迭代长期维护，规范的目标是**可读、可查、不会改一处坏三处**。规范与 `/#/spec` 的落地约定一致。

## 注释（本项目最硬性的要求）

每个文件头、每个导出函数、每个「看起来奇怪」的实现都必须有注释，分两层：

1. **功能注释**：这段代码做什么（接手的人 30 秒能定位）；
2. **业务注释**：为什么这样写、防止什么事故。历史踩过的坑必须写进注释（如「容器默认带内边距导致新增元素错位」），否则同样的坑一定会再踩一遍。

```js
/**
 * 拖拽落点归一化
 * ------------------------------------------------------------
 * 功能：把「inside / before / after」三种原始落点修正为合法插入动作。
 * 业务：
 *   1. inside 落在叶子组件上时，插入到它后面而不是给它强建 children——
 *      叶子被强建 children 后渲染会消失（历史 bug）；
 *   2. …
 */
```

反面模式：`// 遍历子节点`（复述代码）、只写「功能」不写「为什么」。

## 命名

- 文件：组件 PascalCase（`NodeRenderer.vue`）；工具/脚本 camelCase（`pageCode.js`、`gen-props-doc.mjs`）。
- CSS 类：BEM，模块前缀区分区域（`lc-*` 渲染引擎、`prop-*` 属性面板、`spec__*` 规范页）；语义令牌 `--lc-<语义>`、色阶 `--lc-<系列>-<号>`。
- 事件 emit 用 `open-templates` 式 kebab-case；store action 用动词（`updateProp` / `commit`）。
- id：页面 `page_*`、数据源 `ds_*`、节点 `type_随机`，由统一函数生成，不手拼字符串。

## 样式

- **禁止**在业务样式里写 `#hex`、随手 px 值：颜色 `var(--lc-*)`，间距 `var(--lc-space-*)`，圆角/阴影/动效同理。唯一允许出现色值的地方是 `styles/tokens.css`。
- 全局样式（global.css）只放跨页面骨架；组件私有样式写在组件 `<style scoped>`。
- 新增令牌流程：tokens.css 加基础值 + 语义映射 + 用途注释 → `/#/spec` 对应数组加一项 → docs-test 回归。

## Vue 组件

- 统一 `<script setup>`；props 用 `defineProps({ x: { type, default } })` 带类型与默认值。
- 顶栏注释说明组件职责与业务背景（参考 `Viewer.vue` / `ImportDialog.vue`）。
- 复杂 computed / watch 必须注释触发条件与副作用； watch 路由参数这类「隐式行为」必须写明为什么存在。
- 不在模板里写复杂表达式，逻辑提炼为 computed 并命名。

## 服务端

- 路由只做「校验 → 业务 → 出参」编排，规则放 `validate.js`，持久化放 `store.js`。
- 所有异步 handler 包 `asyncHandler`；抛 `invalid/notFound/conflict` 带用户可读的中文 message，5xx 由统一出口脱敏。
- 对外部输入（导入、demo 提交）一律走完整校验，不允许「前端已经校验过」的假设。
- 写库必须经 `updateDB` 队列，不允许直接读写 JSON 文件。

## 文档同步（改了什么就更新什么）

| 改动 | 必须同步 |
| --- | --- |
| 注册表新增/修改组件 | `npm run gen:props`；必要时 component-development.md |
| 新增/修改接口 | docs/api.md |
| 新增环境变量 | docs/deployment.md + server/src/config.js 注释 |
| 修改嵌入协议 | docs/integration.md + /#/integration 页 |
| 新增令牌 | tokens.css 注释 + /#/spec + design-system.md |
| 新增测试 | docs/testing.md 矩阵表 |

## 提交

- 提交信息格式：`<区域>: <做了什么>（为什么）`，例：`designer: 修复容器落点恒为 inside 导致的组合缺陷`。
- 一次提交一个主题；样式令牌迁移、功能修复、文档更新不混在同一提交。
- 提交前：`npm run test:e2e` 全绿；动过样式的肉眼过一遍三张截图（`npm run shot`）。
