# LowCode Studio 技术文档

可视化低代码平台：前端 Vue3 + Element Plus，后端 Node/Express，schema 驱动的设计器与运行态。

## 快速上手

```bash
npm install && npm install --prefix web && npm install --prefix server
npm run dev        # 同时启动 API(3001) 与 Vite dev(5173)
npm run build      # 构建前端产物（由 3001 托管，单端口上线）
npm run test:e2e   # 九套端到端回归（puppeteer + 本机 Chrome）
npm run doctor     # 环境自检：Node 版本 / 端口占用 / Chrome 可用性
```

## 文档地图

| 文档 | 内容 | 读者 |
| --- | --- | --- |
| [architecture.md](./architecture.md) | 分层架构、数据流、关键设计决策（ADR） | 全员 |
| [api.md](./api.md) | 全部 HTTP 接口、错误码、限流与并发约定 | 后端 / 前端 / 集成方 |
| [page-schema.md](./page-schema.md) | 页面数据模型、Schema 规范、组件属性表 | 前端 / 集成方 |
| [component-development.md](./component-development.md) | 新增组件的完整步骤与一致性要求 | 前端 |
| [integration.md](./integration.md) | iframe 嵌入、prefill 传参、postMessage 协议 | 集成方 |
| [deployment.md](./deployment.md) | 部署形态、环境变量、备份与故障排查 | 运维 |
| [testing.md](./testing.md) | 测试矩阵、e2e 编写规范与已知坑 | 全员 |
| [code-style.md](./code-style.md) | 命名、注释、目录、提交规范 | 全员 |
| [design-system.md](./design-system.md) | 设计令牌与视觉规范 | 设计 / 前端 |

应用内还有两份「活文档」：`/#/spec`（设计规范，直接读取 tokens.css 渲染）与 `/#/integration`（接入指南，含 iframe 生成器）。

## 目录结构

```
lowcode-studio/
├── web/                    # 前端（Vue3 + Vite）
│   ├── src/api/            # 接口层：超时 / 错误码归一化
│   ├── src/components/     # 通用组件与渲染引擎（NodeRenderer 递归渲染 schema）
│   ├── src/components/designer/  # 设计器三栏：组件面板 / 画布 / 属性面板
│   ├── src/composables/    # usePageRuntime：数据源加载、form 模型、插值
│   ├── src/registry/       # 组件注册表：面板/属性/渲染/校验的单一来源
│   ├── src/stores/         # Pinia：schema、历史快照、选中、拖拽归一化
│   ├── src/styles/         # tokens.css 设计令牌 + global.css
│   ├── src/utils/          # 树操作 / 格式化 / 导入导出 / 嵌入协议
│   └── src/views/          # 列表 / 设计器 / 运行态 / 接入指南 / 设计规范
├── server/                 # 后端（Express，无外部数据库依赖）
│   └── src/routes/         # pages（CRUD/导入/发布）· publicApi（公开只读）· templates
├── docs/                   # 本文档目录
└── scripts/                # dev/doctor/shot + 九套 e2e 测试 + 文档生成器
```

## 核心概念一分钟

- **页面 = JSON**：`{ name, description, schema, datasources }`，schema 是一棵以 `Page` 为根的节点树，渲染、校验、导入导出、发布快照全部围绕它。
- **注册表驱动**：`web/src/registry/index.js` 一份配置同时驱动组件面板、属性面板、运行时渲染和服务端类型白名单，新增组件不允许绕过它。
- **草稿与发布**：编辑永远改草稿；「发布」把当前 schema 复制成只读快照，公开访问只读快照，未发布内容不会泄露。
- **乐观锁**：保存携带 `revision`，服务端不一致返回 409，由用户选择覆盖或刷新。

## 约定速览

1. 样式禁止写死色值/像素，一律引用 `--lc-*` 设计令牌（见 [design-system.md](./design-system.md)）。
2. 业务代码必须有「功能注释 + 业务注释」，说明为什么这样做（见 [code-style.md](./code-style.md)）。
3. 修改组件注册表后必须执行 `npm run gen:props` 更新文档附录。
4. 所有对外输入（导入文件、demo 提交）必须过服务端校验，前端校验只是体验优化。
