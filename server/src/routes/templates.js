/**
 * 模板接口
 * ------------------------------------------------------------
 * 功能：返回可用页面模板的元信息（结构缩略 + 适用场景 + 改造指引）。
 * 业务：模板列表变化频率很低，且所有用户看到的是同一份内容，
 *      因此允许 CDN / 浏览器缓存 5 分钟，减少新建弹窗的等待感；
 *      但缓存时间不宜过长，否则上线新模板后用户要等很久才能看到。
 */
import { Router } from 'express'
import { listTemplates, buildTemplate } from '../templates.js'
import { asyncHandler } from '../middleware.js'
import { notFound } from '../errors.js'

const router = Router()

router.get(
  '/templates',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.json({ success: true, data: listTemplates() })
  })
)

/**
 * 单个模板的完整内容
 * 业务：设计器「套用模板」需要真正的 schema 才能直接铺到画布上。
 *      列表接口刻意不带 schema（体积大），所以这里按需再取一次；
 *      每次生成都会重新分配节点 id，保证套用多次也不会出现重复 id。
 */
router.get(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const template = buildTemplate(req.params.id)
    if (!template) throw notFound(`模板不存在：${req.params.id}`)
    res.json({ success: true, data: template })
  })
)

export default router
