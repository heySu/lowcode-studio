# 接入其它系统（开发者视角）

> 面向使用者的图形化指南（含 iframe 生成器）在应用内 `/#/integration`；本文是协议与实现细节的权威参考。

## 三种接入方式

| 方式 | 适用 | 说明 |
| --- | --- | --- |
| iframe 嵌入 | 宿主系统内嵌表单/页面 | `?embed=1` 去外壳、自动高度、可传参、可回传 |
| 链接跳转 | 菜单/按钮打开独立页 | 直接用 `#/view/:id` 地址 |
| 导出单文件 | 交付客户 / 独立部署 | 设计器「⋯ → 导出 HTML 代码」，仅依赖 CDN 上的 Vue3 + Element Plus |

## 嵌入地址

```
https://<host>:3001/?embed=1&prefill=<base64url(JSON)>#/view/<页面ID>
```

- `embed=1` 与 `prefill` 必须放在 `#` **之前**（hash 后的 query 服务端不可见，拿不到放行依据）。
- 服务端对带 `?embed=1` 的文档请求不发 `X-Frame-Options`，改发 `CSP: frame-ancestors <EMBED_ANCESTORS>`（默认 `*`，生产必须收窄，见 deployment.md）。

## postMessage 协议

信封统一为 `{ source: 'lowcode-studio', type: '...', ...payload }`，宿主按 `source` 过滤。

| type | 方向 | 时机 | payload |
| --- | --- | --- | --- |
| `lc:hello` | 宿主 → 平台 | 宿主就绪后（可选） | — |
| `lc:ready` | 平台 → 宿主 | 页面加载完成 | `{ pageId, name, prefill: [{ name, applied }] }` |
| `lc:resize` | 平台 → 宿主 | 内容高度变化（ResizeObserver） | `{ height }`（自动高度脚本 `+1px` 防抖动） |
| `lc:submit` | 平台 → 宿主 | 按钮提交动作完成后 | `{ pageId, name, success, form? }` |
| `lc:error` | 平台 → 宿主 | 加载失败（如页面未发布） | `{ message }` |

宿主示例（自动高度 + 提交回传）：

```html
<iframe id="lc-frame" src="https://host/?embed=1#/view/PAGE_ID" style="width:100%;border:0"></iframe>
<script>
  var frame = document.getElementById('lc-frame')
  window.addEventListener('message', function (event) {
    var data = event.data
    if (!data || data.source !== 'lowcode-studio') return
    if (data.type === 'lc:resize' && event.source === frame.contentWindow) {
      frame.style.height = data.height + 1 + 'px'
    }
    if (data.type === 'lc:submit') {
      console.log('提交完成：', data.success, data.form)
      // 这里调用宿主自己的接口做业务流转
    }
  })
</script>
```

## prefill 预填

- 编码：`base64url(JSON.stringify({ name: '李四', dept: 'rd' }))`（URL 安全 base64，无 padding）。
- 只覆盖页面里真实存在的表单字段（按 `props.name` 匹配），多余字段忽略并在 iframe 控制台列出，方便接入方排查拼写。
- `lc:ready` 的 `prefill` 数组回执每个字段的匹配结果，宿主可据此提示。

## 表单写回宿主系统

两种路径：

1. **按钮 request 动作直连**：按钮配置 `request` 动作指向宿主接口，`includeForm: true` 时 POST 整个表单模型。要求宿主接口允许 CORS（或同域部署）。
2. **lc:submit 转交**：按钮动作随便配（如 message），宿主监听 `lc:submit` 拿 `form` 自行处理。适合宿主不方便开 CORS 的场景（iframe 同源加载页面内容，postMessage 由宿主自己接收）。

## 拉取页面内容

`GET /api/published/:id` 返回发布快照（schema + datasources），外部系统可自行渲染或归档。未发布返回 404。

## 安全边界

- 平台不内置鉴权：嵌入场景的身份由宿主体系负责；如需限制，在反向代理层对 `/api` 写接口加鉴权。
- `lc:*` 消息只含非敏感运行态信息；不要把业务敏感数据放进 prefill（URL 会被记录）。
- 页面内 `request` 动作是设计者配置的任意 fetch，部署时把平台视为「能出网的内网应用」评估，不要给它能直连核心内网的网络位置。
