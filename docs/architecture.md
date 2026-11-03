# 架构与设计决策

## 总体架构

```
┌────────────────────────── 浏览器 ──────────────────────────┐
│  PageList(列表)   Designer(设计器)   Viewer(运行态/嵌入)      │
│        │               │                    │              │
│        │         stores/designer            │              │
│        │      (schema/历史/选中/拖拽)         │              │
│        │               │                    │              │
│        │    registry(组件注册表)──┐            │              │
│        │         │              │            │              │
│        │  NodeRenderer(递归渲染) │   usePageRuntime          │
│        │                        │   (数据源/form/插值/动作)    │
│        └────────────┬───────────┴────────────┘              │
│                     │ fetch /api（15s 超时，错误归一化）        │
└─────────────────────┼───────────────────────────────────────┘
                      ▼
┌──────────────── Express(3001，单端口托管 dist) ─────────────┐
│  routes/pages      CRUD / 导入 / 复制 / 发布 / 撤回           │
│  routes/publicApi  /health /stats /published/:id /demo/submit│
│  routes/templates  模板列表与内容                             │
│  validate          组件类型白名单、深度/体积/数据源约束          │
│  store             JSON 文件持久化：写队列 + 原子替换 + .bak    │
│  middleware        限流 / 错误出口 / 安全头(含 embed 放行)      │
└──────────────────────────────────────────────────────────────┘
```

## 关键数据流

### 1. 设计与保存

1. 设计器所有变更先写入 Pinia store，`commit()` 把变更后快照压入历史栈（输入类操作 400ms 合并），Ctrl+Z/Y 在栈上移动，不做反向计算。
2. 保存 = `PUT /api/pages/:id`，携带当前 `revision`。服务端比对乐观锁：不一致返回 409，前端弹窗让用户选择「覆盖」或「刷新」（而不是自动合并——低代码 schema 无法安全 merge）。
3. 服务端写库走串行队列：临时文件写盘 → rename 原子替换 → 旧文件存 `.bak`。进程崩溃时最多丢最后一次写盘，不会出现半截 JSON。

### 2. 发布与访问

- `POST /pages/:id/publish` 把当前 schema 深拷贝进 `published` 字段并记录 `publishedRevision`。
- 预览（`#/view/:id?preview=1`）读草稿；公开访问读 `published` 快照。两条通道物理隔离，未发布内容不可能泄露给访问者。
- 草稿再修改后 `revision > publishedRevision`，列表页据此显示「有未发布的修改」。

### 3. 运行态渲染

- `NodeRenderer` 按 `type` 递归渲染节点树；容器按 `direction` 用 flex 布局，行内子项默认 `flex:1 1 0%; min-width:0` 实现均分，内容型组件（按钮/标签/标题）保持 `flex:0 0 auto`。
- 数据源：`static` 直接解析 JSON，`api` 用 fetch 拉取；结果挂到作用域，插值 `{{form.x}}` / `{{ds.field}}` 在渲染文本时求值。
- 按钮四种动作：`message` / `link` / `reset` / `request`（可携带整个 form）。嵌入模式下提交后额外 `postMessage('lc:submit')` 通知宿主。
- 每个节点包在 `ErrorBoundary` 里，单个组件 schema 异常只降级该组件，不白屏。

## 设计决策记录（ADR 摘要）

| 决策 | 选择 | 理由与代价 |
| --- | --- | --- |
| 持久化 | JSON 文件（非 SQLite/Mongo） | 零部署依赖、可直接进备份；代价是写并发靠队列串行，适合中小规模，量级上来后替换 `store.js` 即可，接口不变 |
| 路由模式 | hash | 静态托管无需 rewrite，降低上线沟通成本；代价是 URL 里 query 分两段（`?embed=1` 必须在 `#` 前，服务端才看得到） |
| 组件定义 | 单一注册表 | 面板/属性/渲染/校验四处共享一份配置，避免互相脱节；代价是注册表文件较大，用注释分区维护 |
| 撤销实现 | 快照栈（非命令模式） | schema 树操作复杂（拖拽/样式/属性），快照简单可靠；代价是内存换正确性，栈深限制 50 |
| 并发控制 | revision 乐观锁 | 无用户系统前提下的最简方案；冲突交给用户决策而非自动合并 |
| 校验位置 | 只在服务端权威校验 | 导入文件是外部输入，绕过前端校验的路径永远存在；前端校验只为即时反馈 |
| 样式 | CSS 变量令牌 | 规范与实现同源，`/#/spec` 直接读变量渲染活文档；不引入 Tailwind/styled-components，保持零额外依赖 |
| 嵌入 | postMessage + CSP frame-ancestors | 普通页面仍禁止被第三方 iframe 引用（防点击劫持），仅 `?embed=1` 放行且来源可用 `EMBED_ANCESTORS` 收窄 |

## 与外部系统的边界

- 本平台不内置用户/权限体系；需要时把平台整体嵌入已有登录体系（见 integration.md），或在网关层加鉴权。
- 按钮的 `request` 动作直接 fetch 目标地址，跨域由对方系统配置 CORS；平台不做代理，避免成为内网跳板。
- 公开数据只有 `GET /api/published/:id`（只读快照）与 `POST /api/demo/submit`（示例提交，限流 30 次/分），其余接口不对外。
