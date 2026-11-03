/**
 * 对外接口（运行态 / 运维）
 * ------------------------------------------------------------
 * 功能：健康检查、运营统计、已发布页面读取、示例提交接口。
 * 业务：
 *   - /health 供负载均衡或容器探针使用，必须轻量且不依赖鉴权；
 *   - /published/:id 是 C 端访问入口，只读发布快照，绝不返回草稿，
 *     避免「设计师改一半，线上访问者看到半成品」；
 *   - 页面未发布时返回 404 而不是空页面，便于访问者得到明确提示。
 */
import { Router } from 'express'
import { readDB, dbHealth } from '../store.js'
import { asyncHandler, rateLimit } from '../middleware.js'
import { notFound, invalid } from '../errors.js'
import { config } from '../config.js'
import { logger } from '../logger.js'

const router = Router()

const countNodes = (node) => {
  if (!node) return 0
  const self = node.type === 'Page' ? 0 : 1
  return (node.children || []).reduce((sum, child) => sum + countNodes(child), self)
}

// ---------------------------------------------------------------- 健康检查
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const db = await dbHealth()
    const status = db.ok ? 200 : 503
    res.status(status).json({
      success: db.ok,
      data: {
        status: db.ok ? 'up' : 'degraded',
        uptime: Math.round(process.uptime()),
        version: process.env.npm_package_version || '1.0.0',
        dataFile: db.file,
        pages: db.pages,
        time: new Date().toISOString()
      }
    })
  })
)

// ---------------------------------------------------------------- 运营统计
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const db = await readDB()
    res.json({
      success: true,
      data: {
        pages: db.pages.length,
        published: db.pages.filter((page) => page.status === 'published').length,
        draft: db.pages.filter((page) => page.status !== 'published').length,
        nodes: db.pages.reduce((sum, page) => sum + countNodes(page.schema), 0),
        datasources: db.pages.reduce((sum, page) => sum + (page.datasources || []).length, 0)
      }
    })
  })
)

// ---------------------------------------------------------------- 已发布页面（C 端读取）
router.get(
  '/published/:id',
  asyncHandler(async (req, res) => {
    const db = await readDB()
    const page = db.pages.find((item) => item.id === req.params.id)
    if (!page) throw notFound('页面不存在')

    // 业务：草稿态不对外可见，必须发布后访问
    if (page.status !== 'published' || !page.published) {
      throw notFound('该页面尚未发布，请联系管理员发布后再访问')
    }

    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json({
      success: true,
      data: {
        id: page.id,
        name: page.name,
        revision: page.published.revision,
        schema: page.published.schema,
        datasources: page.published.datasources || [],
        publishedAt: page.published.publishedAt
      }
    })
  })
)

// ---------------------------------------------------------------- 示例：表单提交接收端
// 业务：按钮「请求接口」动作的演示后端。真实项目里这里应替换为业务系统接口，
// 并补充鉴权（token / 签名）、幂等（去重键）与参数校验。
router.post(
  '/demo/submit',
  // 同一个 IP 每分钟最多 30 次提交：正常用户远远够用，脚本刷量会被挡住
  rateLimit({ scope: 'demo-submit', windowMs: 60_000, max: 30 }),
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    const keys = Object.keys(body)
    logger.info('[demo] 收到表单提交', { requestId: req.id, fields: keys.length })

    if (!keys.length) throw invalid('提交内容为空，请先填写表单')

    res.json({
      success: true,
      data: {
        received: body,
        message: `后端已收到 ${keys.length} 个字段的提交数据`,
        maxBodySize: config.limits.bodyLimit
      }
    })
  })
)

export default router
