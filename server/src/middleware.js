/**
 * 通用中间件
 * ------------------------------------------------------------
 * 功能：请求上下文(RequestId)、访问日志、安全响应头、404 与统一异常处理。
 * 业务：前端出问题时，用户只需提供错误提示里的 requestId，运维就能在日志里定位到那一条请求，
 *      这是线上排障成本最低的做法。统一异常处理保证任何未预料的异常都以 JSON 返回，
 *      不会把 HTML 错误页丢给前端导致「解析失败」这种二次故障。
 */
import { randomUUID } from 'node:crypto'
import { logger } from './logger.js'
import { config } from './config.js'

/** 给每个请求打上 requestId，并记录耗时与状态码 */
export function requestContext(req, res, next) {
  req.id = randomUUID().slice(0, 8)
  const startAt = process.hrtime.bigint()
  res.setHeader('X-Request-Id', req.id)

  res.on('finish', () => {
    const ms = Math.round(Number(process.hrtime.bigint() - startAt) / 1e6)
    const meta = { requestId: req.id, method: req.method, url: req.originalUrl, status: res.statusCode, ms }
    if (res.statusCode >= 500) logger.error('[http] 服务异常', meta)
    else if (res.statusCode >= 400) logger.warn('[http] 请求被拒绝', meta)
    else logger.info('[http] 请求完成', meta)
  })

  next()
}

/**
 * 基础安全响应头（不引入 helmet，保持依赖精简）
 * ------------------------------------------------------------
 * 业务：默认禁止被第三方页面用 iframe 引用（X-Frame-Options: SAMEORIGIN），
 *      防止设计器被点击劫持。但「把页面嵌进别的系统」是明确要支持的接入方式，
 *      所以带 ?embed=1 的文档请求改为 CSP frame-ancestors：
 *      既允许被指定来源嵌入，又保留来源白名单能力（EMBED_ANCESTORS）。
 *      注意：X-Frame-Options 与 frame-ancestors 同时存在时前者优先，
 *      因此 embed 请求必须显式不发 XFO，不能只加 CSP。
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.query?.embed === '1') {
    res.setHeader('Content-Security-Policy', `frame-ancestors ${config.embedAncestors}`)
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  }
  res.setHeader('Referrer-Policy', 'same-origin')
  next()
}

/** 把 async 路由的异常转交给统一异常处理（Express 4 不会自动捕获 Promise 拒绝） */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

/**
 * 简易限流（固定窗口，进程内计数）
 * ------------------------------------------------------------
 * 功能：按「调用方 IP + 目标路由」统计请求次数，超过阈值返回 429。
 * 业务：公开写接口（表单提交、页面保存）如果没有限流，被脚本循环调用会打满 CPU、
 *      写爆日志磁盘，最终整站不可用。这里做最基础的一道闸：
 *        - 只对写接口启用，读接口保持不限流，不影响正常访问；
 *        - 超出时返回 Retry-After，调用方知道多久后重试；
 *        - 多实例部署时进程内计数不共享，应换成 Redis 计数，这里留了 key 参数便于替换。
 */
export function rateLimit({ windowMs = 60_000, max = 60, scope = 'default' } = {}) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key = `${scope}:${req.ip}`

    // 惰性清理：条目过期就重置，避免长期运行后 Map 无限增长
    const record = hits.get(key)
    if (!record || now - record.start > windowMs) {
      hits.set(key, { start: now, count: 1 })
      // 每次新增 key 时顺带清理一次，控制内存上界
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k)
      }
      return next()
    }

    record.count += 1
    if (record.count > max) {
      const retryAfter = Math.ceil((windowMs - (now - record.start)) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: `操作过于频繁，请 ${retryAfter} 秒后再试`,
        requestId: req.id
      })
    }
    next()
  }
}

/** /api 下未匹配到路由 */
export function apiNotFound(req, res) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `接口不存在：${req.method} ${req.originalUrl}`,
    requestId: req.id
  })
}

/** 统一异常出口（Express 要求 4 个入参才识别为错误中间件） */
export function errorHandler(err, req, res, next) {
  // 请求体不是合法 JSON 时，express.json 会抛出 entity.parse.failed
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_JSON',
      message: '请求体不是合法的 JSON',
      requestId: req.id
    })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
      message: '请求内容过大，请减少组件数量或拆分页面',
      requestId: req.id
    })
  }

  const status = err?.status || 500
  const exposed = err?.expose || status < 500
  if (status >= 500) logger.error('[http] 未处理异常', { requestId: req.id, error: err?.stack || String(err) })

  res.status(status).json({
    success: false,
    code: err?.code || 'INTERNAL_ERROR',
    // 5xx 对外脱敏，避免泄露堆栈与内部路径
    message: exposed ? err.message : '服务器内部错误，请稍后重试',
    requestId: req.id
  })
}
