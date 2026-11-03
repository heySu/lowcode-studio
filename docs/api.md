# HTTP 接口参考

- 基础地址：`http://<host>:3001/api`（前端静态资源与接口同端口托管）
- 请求/响应均为 JSON；响应统一信封：

```json
{ "success": true, "data": { } }
{ "success": false, "code": "VALIDATION", "message": "不支持的组件类型：Hack", "requestId": "…" }
```

- 所有 5xx 已脱敏（不泄露堆栈/路径），并带 `requestId`，可拿它与后端日志对账。
- 超时与重试：前端默认 15s 超时（导入 30s）；客户端遇到 `NETWORK`/`TIMEOUT` 可安全重试幂等的 GET，写操作不要自动重试。

## 错误码

| code | HTTP | 含义 |
| --- | --- | --- |
| VALIDATION | 400 | 参数/Schema 校验不通过（含未知模板、非法组件类型、超限） |
| NOT_FOUND | 404 | 页面不存在或已删除；未发布页面访问公开快照也返回 404 |
| CONFLICT | 409 | 乐观锁冲突（revision 不一致） |
| RATE_LIMITED | 429 | 触发限流，响应含 `Retry-After` |
| TIMEOUT / NETWORK | — | 前端归一化错误码（分别表示超时 / 连接失败） |

## 页面管理

### GET /pages

页面列表，按 `updatedAt` 倒序。`?keyword=` 按名称/描述模糊过滤。

```json
data: [{ "id": "page_demo_form", "name": "员工信息登记", "description": "…", "status": "published",
        "revision": 12, "createdAt": "…", "updatedAt": "…", "publishedAt": "…", "nodeCount": 13 }]
```

### POST /pages

新建页面。`{ name, description?, templateId? }`；不传 `templateId` 为空白页。未知模板返回 400。
响应 201，返回页面摘要。

### GET /pages/:id

页面详情（含草稿 `schema`、`datasources`、`published` 快照与 `revision`）。

### PUT /pages/:id

保存草稿。请求体（均为可选，传了才更新）：

```json
{ "name": "…", "description": "…", "schema": { "id": "root", "type": "Page", "children": [] },
  "datasources": [ { "id": "ds_1", "name": "employees", "type": "static", "method": "GET", "url": "", "json": "[]" } ],
  "revision": 12 }
```

- `revision` 显式传入时做乐观锁校验，不一致返回 409（message 中含客户端/服务端版本号）。
- 成功返回更新后的摘要与新 `revision`。

### DELETE /pages/:id

删除页面（含其发布快照）。响应 `{ data: { id } }`。

### POST /pages/:id/duplicate

复制页面为草稿，名称追加「副本」。响应 201。

### POST /pages/:id/publish · POST /pages/:id/unpublish

发布 / 撤回发布。发布把草稿 schema 深拷贝进 `published`；撤回将 `published` 置空（公开访问立即 404）。

## 导入导出

### POST /pages/import

导入页面代码。请求体（`dryRun: true` 时只校验不落库）：

```json
{ "dryRun": false, "page": { "name": "…", "description": "…" },
  "schema": { "…": "Page 节点树" }, "datasources": [] }
```

兼容三种格式（服务端自动归一化）：标准导出包 `{format:'lowcode-page', version, page, schema, datasources}`、旧版 `{name, schema, datasources}`、裸 schema `{type:'Page', children}`。
dryRun 响应：`{ name, description, nodes, datasourceCount, format, version }`。
正式导入响应 201（新草稿页摘要）。导入只创建新页面，不会覆盖已有页面。

校验规则（导入与保存共用）：组件类型白名单（见 page-schema.md）、树深 ≤ 8、节点数 ≤ 800、schema ≤ 1MB、数据源 ≤ 20 个且命名合法。

## 公开接口

### GET /health

存活探测。`{ status: 'ok', uptime, pages }`。

### GET /stats

统计：页面总数、已发布数、组件实例数。

### GET /published/:id

只读发布快照：`{ id, name, schema, datasources, publishedAt }`。未发布返回 404。给外部系统拉取页面内容用。

### POST /demo/submit

示例表单提交端点（配合模板演示按钮 request 动作）。限流 30 次/分，超限 429 + `Retry-After`。

## 模板

### GET /templates

模板轻列表：`{ id, name, description, thumbnail }`。

### GET /templates/:id

完整模板（schema + datasources + scenes/highlights/guide）。未知 id 返回 404。

## 限流

所有 `/api` 写接口受全局限流保护（默认窗口内超限返回 429，`Retry-After` 秒后重试）；`/demo/submit` 独立更严格限流。部署在反向代理后时，请确保透传 `X-Forwarded-For`，否则所有请求会被当作同一来源。
