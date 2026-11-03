/**
 * 页面管理接口
 * ------------------------------------------------------------
 * 功能：页面 CRUD、复制、发布/撤回，以及乐观锁（revision）并发控制。
 * 业务规则（重要，改动前请先确认）：
 *   1. 新建页面默认是「草稿」，只有发布后才会生成对外访问快照 /published/:id；
 *   2. 发布是「打快照」而不是实时读取草稿——设计师改一半的内容不会立刻影响线上访问者；
 *   3. 每次保存会把 revision +1。保存时带上客户端读取到的 revision，
 *      若与服务端不一致说明别人/别的窗口已经改过，返回 409 让前端决定是刷新还是强制覆盖，
 *      这是防止多人协作互相覆盖的最轻量方案；
 *   4. 空页面不允许发布（requireContent），避免把白屏页面推到线上。
 */
import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { readDB, updateDB } from '../store.js'
import { buildTemplate } from '../templates.js'
import { validatePagePayload, validateSchema } from '../validate.js'
import { AppError, invalid, notFound, conflict } from '../errors.js'
import { asyncHandler, rateLimit } from '../middleware.js'
import { logger } from '../logger.js'

const router = Router()

/**
 * 写接口限流
 * 业务：保存是「整页 schema 全量覆盖」，一次请求可能几百 KB。
 *      前端有防抖，但脚本或误触发的循环请求会持续写盘，
 *      单用户超过 100 次/分钟基本可以判定为异常，直接拒绝并提示重试时间。
 *      读接口（列表/详情）不限流，保证正常浏览不受影响。
 */
const writeLimit = rateLimit({ scope: 'pages-write', windowMs: 60_000, max: 100 })
router.use(['/pages', '/pages/:id'], (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next()
  return writeLimit(req, res, next)
})

const newPageId = () => `page_${Date.now().toString(36)}${randomBytes(2).toString('hex')}`
const emptySchema = () => ({ id: 'root', type: 'Page', props: {}, style: {}, children: [] })

/** 统计组件数量，用于列表展示与运营指标 */
function countNodes(node) {
  if (!node) return 0
  const self = node.type === 'Page' ? 0 : 1
  return (node.children || []).reduce((sum, child) => sum + countNodes(child), self)
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * 归一化导入文件
 * 业务：不同时期的导出格式都要能读，这里统一成 { format, version, name, description, schema, datasources }，
 *      后续校验与写库只认这一份内部结构，避免格式分支散落在业务代码里。
 */
function normalizeImportPackage(body) {
  const isPageSchema = (value) => isPlainObject(value) && value.type === 'Page'

  // 裸 schema：用户直接复制了页面结构，没有外层包装
  if (isPageSchema(body)) {
    return {
      format: 'raw-schema',
      version: 1,
      name: '导入的页面',
      description: '',
      schema: body,
      datasources: []
    }
  }

  if (!isPageSchema(body.schema)) {
    throw invalid('导入失败：文件中没有找到页面结构（schema 根节点必须是 Page 类型）')
  }

  const meta = isPlainObject(body.page) ? body.page : {}
  return {
    format: typeof body.format === 'string' && body.format ? body.format : 'legacy-json',
    version: Number(body.version) || 1,
    // 名称/描述先做长度截断，具体边界仍由 validatePagePayload 把关
    name: String(meta.name || body.name || '导入的页面').slice(0, 60),
    description: String(meta.description || body.description || '').slice(0, 500),
    schema: body.schema,
    datasources: Array.isArray(body.datasources) ? body.datasources : []
  }
}


/** 列表/详情返回体：不返回 schema 全文，避免列表接口被大字段拖慢 */
function toSummary(page) {
  return {
    id: page.id,
    name: page.name,
    description: page.description || '',
    status: page.status || 'draft',
    revision: page.revision || 1,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    publishedAt: page.publishedAt || null,
    publishedRevision: page.publishedRevision || null,
    nodeCount: countNodes(page.schema),
    datasourceCount: (page.datasources || []).length
  }
}

// ---------------------------------------------------------------- 列表
router.get(
  '/pages',
  asyncHandler(async (req, res) => {
    const db = await readDB()
    const keyword = String(req.query.keyword || '').trim().toLowerCase()

    let list = db.pages.map(toSummary)
    if (keyword) {
      list = list.filter(
        (page) => page.name.toLowerCase().includes(keyword) || page.description.toLowerCase().includes(keyword)
      )
    }
    // 最近编辑的排前面，符合「继续上次工作」的使用习惯
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    res.json({ success: true, data: list })
  })
)

// ---------------------------------------------------------------- 新建
router.post(
  '/pages',
  asyncHandler(async (req, res) => {
    const { name, description } = validatePagePayload(
      { name: req.body?.name ?? '未命名页面', description: req.body?.description ?? '' },
      { partial: false }
    )

    /**
     * 模板套用
     * 业务：templateId 是可选参数。不传 = 空白页，保持旧接口兼容；
     *      传了但不认识 = 400 明确报错，而不是悄悄退化成空白页——
     *      否则用户会以为「模板没生效」，排查成本极高。
     */
    const templateId = String(req.body?.templateId || '').trim()
    let template = null
    if (templateId) {
      template = buildTemplate(templateId)
      if (!template) throw invalid(`模板不存在：${templateId}`)
    }

    const now = new Date().toISOString()
    const page = {
      id: newPageId(),
      name,
      // 描述留空时用模板说明兜底，让列表页有内容可看，也方便用户知道这个页面的定位
      description: description || template?.description || '',
      status: 'draft',
      revision: 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      publishedRevision: null,
      published: null,
      datasources: template?.datasources || [],
      schema: template?.schema || emptySchema()
    }

    await updateDB((db) => {
      db.pages.push(page)
    })
    logger.info('[page] 新建页面', { id: page.id, name, template: templateId || 'blank', nodes: countNodes(page.schema) })
    res.status(201).json({ success: true, data: toSummary(page) })
  })
)

// ---------------------------------------------------------------- 导入
/**
 * 页面导入
 * ------------------------------------------------------------
 * 功能：接收客户端导出的页面文件，校验后创建为新的草稿页面；dryRun 时只校验不落库。
 * 业务：
 *   1. 支持三种文件格式，保证「昨天导出的文件今天还能导入」（向后兼容）：
 *        - 标准导出包 { format:'lowcode-page', version, page:{name,description}, schema, datasources }
 *        - 旧版导出   { name, schema, datasources }
 *        - 裸 schema  { type:'Page', children:[...] }
 *   2. 导入文件属于外部输入，一律复用 validatePagePayload 的白名单/深度/体积/数据源校验，
 *      不允许因为「是导入」就跳过校验——否则畸形 schema 会直接进库，运行态必然白屏；
 *   3. dryRun 供前端在确认前拿到服务端摘要与错误原文，避免「先建出来再报错」的脏数据；
 *   4. 导入只创建草稿，不会覆盖任何现有页面；覆盖画布由设计器在前端完成（可撤销）。
 */
router.post(
  '/pages/import',
  asyncHandler(async (req, res) => {
    const body = req.body || {}
    const pkg = normalizeImportPackage(body)
    const payload = validatePagePayload(
      {
        name: pkg.name,
        description: pkg.description,
        schema: pkg.schema,
        datasources: pkg.datasources
      },
      { partial: false }
    )

    const summary = {
      name: payload.name,
      description: payload.description || '',
      nodes: countNodes(payload.schema),
      datasourceCount: (payload.datasources || []).length,
      format: pkg.format,
      version: pkg.version
    }

    if (body.dryRun === true) {
      res.json({ success: true, data: summary })
      return
    }

    const now = new Date().toISOString()
    const page = {
      id: newPageId(),
      name: payload.name,
      description: payload.description || '',
      status: 'draft',
      revision: 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      publishedRevision: null,
      published: null,
      datasources: payload.datasources || [],
      schema: payload.schema
    }

    await updateDB((db) => {
      db.pages.push(page)
    })
    logger.info('[page] 导入页面', {
      id: page.id,
      name: page.name,
      format: pkg.format,
      nodes: summary.nodes,
      datasources: summary.datasourceCount
    })
    res.status(201).json({ success: true, data: toSummary(page) })
  })
)

// ---------------------------------------------------------------- 详情
router.get(
  '/pages/:id',
  asyncHandler(async (req, res) => {
    const db = await readDB()
    const page = db.pages.find((item) => item.id === req.params.id)
    if (!page) throw notFound('页面不存在或已被删除')
    res.json({ success: true, data: page })
  })
)

// ---------------------------------------------------------------- 保存
router.put(
  '/pages/:id',
  asyncHandler(async (req, res) => {
    // 先校验再进写队列，避免占用写入锁做无用功
    const payload = validatePagePayload(req.body || {}, { partial: true })
    const { revision: clientRevision } = req.body || {}

    let missing = false
    let conflictInfo = null

    const page = await updateDB((db) => {
      const item = db.pages.find((p) => p.id === req.params.id)
      if (!item) {
        missing = true
        return null
      }

      // 乐观锁：仅当客户端显式传了 revision 才校验，兼容脚本/旧客户端
      if (clientRevision !== undefined && clientRevision !== null) {
        const serverRevision = item.revision || 1
        if (Number(clientRevision) !== serverRevision) {
          conflictInfo = { clientRevision: Number(clientRevision), serverRevision }
          return null
        }
      }

      if (payload.name !== undefined) item.name = payload.name
      if (payload.description !== undefined) item.description = payload.description
      if (payload.schema !== undefined) item.schema = payload.schema
      if (payload.datasources !== undefined) item.datasources = payload.datasources

      item.revision = (item.revision || 1) + 1
      item.updatedAt = new Date().toISOString()
      // 草稿被修改后，「已发布」标记仍然保留，但 publishedRevision 落后于 revision，
      // 前端据此可提示「有未发布的修改」
      return item
    })

    if (missing) throw notFound('页面不存在或已被删除')
    if (conflictInfo) {
      throw conflict(
        `页面已在其他窗口被修改（你的版本 v${conflictInfo.clientRevision}，服务器 v${conflictInfo.serverRevision}），请刷新后再编辑`
      )
    }

    res.json({ success: true, data: { ...toSummary(page), revision: page.revision } })
  })
)

// ---------------------------------------------------------------- 删除
router.delete(
  '/pages/:id',
  asyncHandler(async (req, res) => {
    let removed = null
    await updateDB((db) => {
      const index = db.pages.findIndex((p) => p.id === req.params.id)
      if (index === -1) return
      removed = db.pages[index]
      db.pages.splice(index, 1)
    })
    if (!removed) throw notFound('页面不存在或已被删除')
    logger.warn('[page] 删除页面', { id: req.params.id, name: removed.name })
    res.json({ success: true, data: { id: req.params.id } })
  })
)

// ---------------------------------------------------------------- 复制
router.post(
  '/pages/:id/duplicate',
  asyncHandler(async (req, res) => {
    let created = null
    await updateDB((db) => {
      const source = db.pages.find((p) => p.id === req.params.id)
      if (!source) return

      const now = new Date().toISOString()
      created = {
        ...JSON.parse(JSON.stringify(source)),
        id: newPageId(),
        // 名称加「副本」并截断，避免超长名称破坏校验规则
        name: `${source.name} 副本`.slice(0, 60),
        status: 'draft',
        revision: 1,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        publishedRevision: null,
        published: null
      }
      db.pages.push(created)
    })
    if (!created) throw notFound('要复制的页面不存在')
    logger.info('[page] 复制页面', { from: req.params.id, to: created.id })
    res.status(201).json({ success: true, data: toSummary(created) })
  })
)

// ---------------------------------------------------------------- 发布
router.post(
  '/pages/:id/publish',
  asyncHandler(async (req, res) => {
    let missing = false
    const result = await updateDB((db) => {
      const item = db.pages.find((p) => p.id === req.params.id)
      if (!item) {
        missing = true
        return null
      }

      // 发布前的最后一道业务校验：空页面 / 畸形结构不允许上线
      validateSchema(item.schema, { requireContent: true })

      const now = new Date().toISOString()
      item.status = 'published'
      item.publishedAt = now
      item.publishedRevision = item.revision || 1
      item.published = {
        revision: item.revision || 1,
        schema: JSON.parse(JSON.stringify(item.schema)),
        datasources: JSON.parse(JSON.stringify(item.datasources || [])),
        publishedAt: now
      }
      return item
    })

    if (missing || !result) throw notFound('页面不存在或已被删除')
    logger.info('[page] 发布页面', { id: result.id, revision: result.publishedRevision })
    res.json({ success: true, data: toSummary(result) })
  })
)

// ---------------------------------------------------------------- 撤回发布
router.post(
  '/pages/:id/unpublish',
  asyncHandler(async (req, res) => {
    let page = null
    await updateDB((db) => {
      const item = db.pages.find((p) => p.id === req.params.id)
      if (!item) return
      item.status = 'draft'
      item.publishedAt = null
      item.publishedRevision = null
      // 保留 published 快照本身：撤回后重新发布会重新生成，无需额外清理
      page = item
    })
    if (!page) throw notFound('页面不存在或已被删除')
    logger.info('[page] 撤回发布', { id: page.id })
    res.json({ success: true, data: toSummary(page) })
  })
)

export default router
