# 部署与运维

## 构建与启动

```bash
npm run build                 # 产出 web/dist
npm start                     # 或 node server/src/index.js，默认 0.0.0.0:3001
```

3001 同时服务 `/api` 与前端静态资源（`web/dist`），单端口即可上线。`npm run dev` 是开发模式（3001 API + 5173 Vite 热更）。

启动前会做端口预检：3001 被占用时给出明确报错退出（不会带着旧服务一起僵死）。启动自检：`curl :3001/api/health`。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | 3001 | 监听端口 |
| `HOST` | 0.0.0.0 | 监听地址，本机调试可设 127.0.0.1 |
| `LC_DATA_DIR` | `server/data` | 数据目录（pages.json 及备份），生产建议挂独立磁盘 |
| `LC_MAX_NODES` | 800 | 单页节点数上限 |
| `CORS_ORIGINS` | 空（不限） | 逗号分隔的允许来源；生产应设置 |
| `EMBED_ANCESTORS` | `*` | 允许 iframe 嵌入的父页来源（CSP frame-ancestors）。**生产必须收窄**，如 `https://portal.example.com` |
| `LC_LOG_LEVEL` | info | debug / info / warn / error |
| `NODE_ENV` | — | `production` 时启用生产分支行为 |

## 数据持久化

- 单文件 JSON（`$LC_DATA_DIR/pages.json`），写入流程：串行队列 → 写临时文件 → rename 原子替换 → 旧文件留存 `.bak`。
- 崩溃恢复：启动时若主文件损坏，自动尝试从 `.bak` 回退。
- 备份：对 `pages.json` 做常规文件备份即可（cp/rsync）；也可以定时调 `GET /api/pages` + `GET /api/pages/:id` 导出 JSON 做异地备份。
- 扩展：需要多实例/高并发时替换 `server/src/store.js` 为数据库实现，路由层接口不变。

## 反向代理（Nginx 示例）

```nginx
location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # 限流按真实来源计数
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

不要缓冲 SSE/长连接（本项目暂无）；如启用 HTTPS，CORS_ORIGINS / EMBED_ANCESTORS 填 https 地址。

## 安全清单（上线前逐项确认）

- [ ] `EMBED_ANCESTORS` 已收窄为自家域名（默认 `*` 会被任意网站嵌入）
- [ ] `CORS_ORIGINS` 已设置（默认不限来源）
- [ ] 平台未部署在能直连核心内网的网络位置（页面 request 动作是任意 fetch）
- [ ] `pages.json` 目录权限最小化，且纳入备份
- [ ] 如需登录：在网关层对 `/api` 写接口加鉴权（平台不内置用户体系）

## 故障排查

| 现象 | 排查 |
| --- | --- |
| 页面打不开 / 接口全失败 | `curl :3001/api/health`；不通则看进程与端口（`npm run doctor` 可自检） |
| 保存报 409 | 他处已修改，前端弹窗可选覆盖/刷新；确认后重新保存 |
| 保存/导入报 400 | 看 message：组件类型白名单 / 节点数 / 树深 / schema 体积超限 |
| iframe 白屏 | 确认 `?embed=1` 在 `#` 之前；浏览器控制台看是否被 frame-ancestors 拒绝（需收窄/放行 EMBED_ANCESTORS） |
| embed 模式内层滚动条 | 用接入指南里的自动高度脚本，监听 `lc:resize` |
| 限流 429 | 反向代理是否透传 `X-Forwarded-For`；窗口内请求量是否正常 |
| 导出的 HTML 打不开 | 需联网加载 CDN 的 Vue3/Element Plus；离线环境按文件尾部注释替换本地依赖 |
