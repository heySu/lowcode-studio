/**
 * 服务入口
 * ------------------------------------------------------------
 * 功能：装配中间件与路由，托管前端构建产物，处理端口占用与优雅退出。
 * 业务：上线要有「可观测 + 可恢复」：
 *   - 启动即校验数据目录，失败给出明确原因，不带病运行；
 *   - 端口被占用时打印可操作的提示（换端口 / 停旧进程），而不是抛一堆堆栈；
 *   - 收到 SIGINT/SIGTERM 先停止接新请求，等在途请求处理完再退出，避免保存到一半被截断。
 */
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import cors from 'cors'

import { config } from './config.js'
import { logger } from './logger.js'
import { initDB } from './store.js'
import { requestContext, securityHeaders, apiNotFound, errorHandler } from './middleware.js'
import pagesRouter from './routes/pages.js'
import templatesRouter from './routes/templates.js'
import publicRouter from './routes/publicApi.js'

const app = express()
app.disable('x-powered-by')
// 部署在 Nginx / 云负载均衡后面时，需要它来拿到真实客户端 IP 与协议
app.set('trust proxy', 1)

// ---------------------------------------------------------------- 基础中间件
app.use(securityHeaders)
app.use(requestContext)

/**
 * CORS：默认放开（便于本地前后端分离开发）。
 * 生产环境建议设置 CORS_ORIGINS=https://your-domain.com，只允许自家域名调用接口。
 */
app.use(
  cors(
    config.corsOrigins.length
      ? {
          origin: (origin, callback) => {
            // 允许无 Origin 的请求（curl、服务端调用、同源访问）
            if (!origin || config.corsOrigins.includes(origin)) return callback(null, true)
            return callback(new Error(`来源 ${origin} 不在白名单内`))
          },
          credentials: true
        }
      : undefined
  )
)

// 请求体上限与校验：schema 是用户输入，必须限制体积
app.use(express.json({ limit: config.limits.bodyLimit }))

// ---------------------------------------------------------------- 业务路由
app.use('/api', publicRouter)
app.use('/api', templatesRouter)
app.use('/api', pagesRouter)

// 未匹配的 /api 一律 JSON 404，避免返回前端 HTML 导致调用方解析失败
app.use('/api', apiNotFound)

// ---------------------------------------------------------------- 前端托管
if (fs.existsSync(config.webDist)) {
  app.use(
    '/assets',
    express.static(path.join(config.webDist, 'assets'), {
      // 构建产物带内容哈希，可长期强缓存，显著降低重复访问的首屏耗时
      immutable: true,
      maxAge: '1y'
    })
  )
  app.use(
    express.static(config.webDist, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
      }
    })
  )

  // 单页应用回退：任何非 /api 的 GET 都返回 index.html，交给前端路由处理
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(config.webDist, 'index.html'))
  })
} else {
  logger.warn('[web] 未找到前端构建产物，仅提供 API 服务', { dist: config.webDist })
}

app.get('/favicon.ico', (req, res) => res.status(204).end())

// 统一异常兜底，必须放在所有路由之后
app.use(errorHandler)

// ---------------------------------------------------------------- 启动
await initDB()

const server = app.listen(config.port, config.host)

server.on('listening', () => {
  const shown = config.host === '0.0.0.0' ? 'localhost' : config.host
  logger.info('低代码平台已启动', { url: `http://${shown}:${config.port}`, pid: process.pid })
  console.log('\n  ┌─────────────────────────────────────────────┐')
  console.log(`  │  低代码平台  http://${shown}:${config.port}`)
  console.log('  │  健康检查    /api/health')
  console.log('  │  前端开发    npm run dev:web  (5173 端口)')
  console.log('  └─────────────────────────────────────────────┘\n')
})

/**
 * 端口占用的正确处理：很多「页面打不开」都是上一次的进程没退出，
 * 这里给出可执行的解决方式，而不是让 Node 抛出未捕获的 'error' 事件把进程搞崩。
 */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`端口 ${config.port} 已被占用，服务无法启动`, { port: config.port })
    console.error(`
  端口 ${config.port} 被占用。任选一种方式处理：
    1. 停掉占用进程：  npx kill-port ${config.port}      （或 lsof -ti:${config.port} | xargs kill）
    2. 换个端口启动：  PORT=${config.port + 1} npm start
  提示：如果之前用 npm run dev 起过服务，请先在原终端 Ctrl+C 结束。
`)
  } else if (err.code === 'EACCES') {
    logger.error(`端口 ${config.port} 无权限监听（1024 以下端口需要管理员权限）`)
  } else {
    logger.error('服务启动失败', { error: err.message })
  }
  process.exit(1)
})

// ---------------------------------------------------------------- 优雅退出
let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  logger.warn(`收到 ${signal}，开始优雅退出`)

  // 先停止接收新连接，再等在途请求结束；超时强制退出，避免容器里卡死
  server.close(() => {
    logger.info('HTTP 服务已关闭，进程退出')
    process.exit(0)
  })
  setTimeout(() => {
    logger.error('优雅退出超时，强制结束进程')
    process.exit(1)
  }, 10000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// 兜底：未捕获异常只记录不静默，避免进程带着未知状态继续对外服务
process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝', { reason: reason instanceof Error ? reason.stack : String(reason) })
})
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常，进程即将退出', { error: err.stack })
  shutdown('uncaughtException')
})
