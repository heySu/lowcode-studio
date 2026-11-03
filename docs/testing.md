# 测试体系

## 测试矩阵

`npm run test:e2e` 串联九套端到端测试（真实浏览器 puppeteer-core + 本机 Chrome headless），全部打 `http://localhost:3001`（服务需已启动）：

| 脚本 | 覆盖 |
| --- | --- |
| `e2e.mjs` | 主链路 7 项：列表/新建/拖拽/属性/保存/预览/发布访问 |
| `undo-test.mjs` | 撤销重做：变更后压栈、输入合并、栈边界 |
| `template-test.mjs` | 6 个模板创建、节点 id 重分配、内容正确性 |
| `compose-test.mjs` | 组件任意组合：容器落点、边缘带、横向插入轴、兄弟插入 |
| `interactive-test.mjs` | 交互开关：设计态禁交互/开启后可操作、捕获选中、下拉展开 |
| `align-test.mjs` | 新增元素不错位：行内对齐、均分、容器布局中立 |
| `io-test.mjs` | 导出 JSON/HTML、导入新建/覆盖、dryRun、非法输入 |
| `embed-test.mjs` | embed 外壳隐藏、响应头、prefill、五类 postMessage、指南页 |
| `docs-test.mjs` | 设计规范页与文档完整性（token 一致性、docs 文件存在） |

另有接口级验证（curl 即可）：409 冲突、422/400 校验、404、限流第 31 次 429 + Retry-After。

## 编写规范

1. **断言真实渲染结果，不 mock**：测试通过 DOM 测量与 `elementFromPoint` 拿到的是浏览器实际布局；这是历次布局缺陷（错位、命中穿透）能被抓到的原因。
2. **用 API 造数据，用 UI 走流程**：`POST /api/pages/import` 建页面、`publish` 后再进浏览器验证；结束后清理（DELETE），避免污染用户数据。
3. **每个用例独立建页**：不依赖其他测试留下的状态；脚本可单独运行。
4. **输出统一**：`ok(name, pass, detail)` 汇总，结尾打印 `PASS x/y`；任何 `[pageerror]` 视为失败。
5. **容忍异步**：拖拽后 `wait(700)` 等渲染稳定；轮询用 `waitForSelector` 而非固定 sleep（长等待除外）。

## 已知坑（写测试前必读）

- **esbuild 临时目录**：本机 TEMP 指向受限路径时，构建/测试前设置 `TMP=web/.tmp TEMP=web/.tmp`。
- **HTML5 DnD 是合成事件**：`dragover` 必须派发到 `elementFromPoint(x,y)` 的最深元素，且坐标要带 `clientX/clientY`；否则落点判定和真实拖拽不一致。
- **空页自动弹帮助抽屉**：会挡住画布，进入设计器先点掉所有 `.el-drawer__close-btn`。
- **徽标仅选中时渲染**：断言组件类型用 DOM 特征（class / data-node-id），不要数徽标。
- **hash 路由的 query 分两段**：`/?embed=1#/view/x`，`page.url()` 与服务端看到的 query 不同。
- **postMessage 与 Vue 响应式代理**：payload 必须是普通对象/数组，代理会 DataCloneError 且被 try/catch 吞掉（曾导致 lc:ready 永不发出）。

## 文档回归（docs-test.mjs）

保证「文档说的」与「代码做的」不漂移：

1. 访问 `/#/spec`：设计规范页色卡展示的值 == `getComputedStyle` 读到的 CSS 变量值；
2. `docs/` 十个文件存在且非空；
3. 关键内容抽查：`api.md` 包含全部路由路径、`deployment.md` 包含全部环境变量、`page-schema.md` 附录的组件类型与注册表一致（`npm run gen:props` 后无 diff）。
