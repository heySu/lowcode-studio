/**
 * 数据持久化层（JSON 文件）
 * ------------------------------------------------------------
 * 功能：把页面数据落到 data/pages.json，提供串行写、原子替换、备份恢复。
 * 业务：上线后最怕两件事——「并发写把文件写坏」和「进程被杀导致文件半截」。
 *      因此：
 *        1. 所有写操作进同一个 Promise 队列，串行执行，避免读改写互相覆盖；
 *        2. 先写临时文件再 rename，rename 在同一分区是原子操作，断电也不会出现半个 JSON；
 *        3. 每次写入前保留上一版本 .bak，主文件解析失败时自动回退，避免整站数据丢失。
 * 说明：数据量增长到万级页面时应替换为 SQLite/PostgreSQL，这里的接口已按仓储模式隔离，
 *      后续替换只改本文件，路由层无需变动。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'
import { logger } from './logger.js'
import { seedPages } from './seed.js'

const dataFile = () => path.join(config.dataDir, 'pages.json')
const backupFile = () => `${dataFile()}.bak`

/** 写队列：保证同一时刻只有一次写入在跑 */
let queue = Promise.resolve()

async function writePages(pages) {
  await fs.mkdir(config.dataDir, { recursive: true })
  const content = JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), pages }, null, 2)
  const tmp = `${dataFile()}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, content, 'utf8')

  // 备份当前版本（首次写入时主文件还不存在，忽略即可）
  try {
    await fs.copyFile(dataFile(), backupFile())
  } catch {
    /* 首次初始化无需备份 */
  }

  await fs.rename(tmp, dataFile()).catch(async (err) => {
    // Windows 上目标被占用时 rename 可能失败，退化为覆盖写，保证服务可用
    logger.warn('[db] 原子替换失败，退化为直接写入', { error: err.message })
    await fs.writeFile(dataFile(), content, 'utf8')
    await fs.unlink(tmp).catch(() => {})
  })
}

async function parseFile(file) {
  const raw = await fs.readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  return { pages: Array.isArray(parsed.pages) ? parsed.pages : [] }
}

/**
 * 数据迁移
 * ------------------------------------------------------------
 * 业务：数据结构会随版本演进（例如后来才加入 revision 乐观锁字段）。
 *      老数据直接读出来会缺字段，导致「保存永远冲突」这类隐性故障，
 *      因此启动时统一补齐默认值，并且只在确实发生变更时回写磁盘。
 */
function migrate(pages) {
  let changed = false
  const now = new Date().toISOString()

  pages.forEach((page) => {
    if (typeof page.revision !== 'number') {
      page.revision = 1
      changed = true
    }
    if (page.publishedRevision === undefined) {
      page.publishedRevision = page.status === 'published' ? page.revision : null
      changed = true
    }
    if (!page.status) {
      page.status = 'draft'
      changed = true
    }
    if (!page.createdAt) {
      page.createdAt = page.updatedAt || now
      changed = true
    }
    if (!Array.isArray(page.datasources)) {
      page.datasources = []
      changed = true
    }
    if (!page.schema || page.schema.type !== 'Page') {
      page.schema = { id: 'root', type: 'Page', props: {}, style: {}, children: [] }
      changed = true
    }
  })

  return changed
}

/** 初始化：目录不存在则创建，数据文件不存在则写入示例页面，并对历史数据做迁移 */
export async function initDB() {
  await fs.mkdir(config.dataDir, { recursive: true })
  try {
    await fs.access(dataFile())
  } catch {
    const pages = seedPages()
    await writePages(pages)
    logger.info('[db] 初始化数据文件并写入示例页面', { file: dataFile(), count: pages.length })
    return
  }

  const db = await readDB()
  if (migrate(db.pages)) {
    await writePages(db.pages)
    logger.info('[db] 已完成数据结构迁移', { pages: db.pages.length })
  }
}

/** 读取全部数据；主文件损坏时自动回退备份，避免直接 500 */
export async function readDB() {
  try {
    return await parseFile(dataFile())
  } catch (err) {
    if (err.code === 'ENOENT') return { pages: [] }
    logger.error('[db] 主数据文件读取失败，尝试备份恢复', { error: err.message })
    try {
      const db = await parseFile(backupFile())
      logger.warn('[db] 已从备份恢复', { count: db.pages.length })
      return db
    } catch (backupErr) {
      logger.error('[db] 备份同样不可用，返回空数据集', { error: backupErr.message })
      return { pages: [] }
    }
  }
}

/**
 * 串行化的读改写
 * @param {(db: {pages: Array}) => any} mutator 修改 db 并返回结果
 */
export function updateDB(mutator) {
  const run = async () => {
    const db = await readDB()
    const result = await mutator(db)
    await writePages(db.pages)
    return result
  }
  // then(run, run)：上一次失败也要继续执行下一次，队列不会卡死
  const task = queue.then(run, run)
  queue = task.catch(() => {})
  return task
}

/** 健康检查用：确认数据层可读、页面数量 */
export async function dbHealth() {
  try {
    const db = await readDB()
    return { ok: true, pages: db.pages.length, file: dataFile() }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
