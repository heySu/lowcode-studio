/**
 * 代码导入导出端到端测试
 * ------------------------------------------------------------
 * 覆盖「导出代码 / 导入页面」的完整链路：
 *   1. 服务端：dryRun 只校验不落库；非法组件类型 / 缺 schema 返回 400 且文案明确；
 *   2. 设计器「导出页面 JSON」：文件是标准导出包（format/version/page/schema/datasources）；
 *   3. 设计器「导出 HTML 代码」：单文件、内嵌结构、含 CDN 依赖说明，且**真实可运行**——
 *      把两个 CDN 地址替换成本地 node_modules 后打开，断言页面渲染出标题/输入框/下拉；
 *   4. 列表页「导入」：粘贴导出 JSON → 预览摘要 → 新建页面 → 自动进入设计器，组件数一致；
 *   5. 设计器「导入页面代码」：选「覆盖当前画布」→ 画布内容被替换（页面本身不新增）；
 *   6. 非法 JSON：弹窗内给出错误提示且确认按钮禁用。
 * 测试自建页面、结束删除，不污染示例数据。
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const require = createRequire('D:/www/factory-dashboard/package.json')
const puppeteer = require('puppeteer-core')

const base = 'http://localhost:3001/'
const api = 'http://localhost:3001/api'
const results = []
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`)
const skip = (name, reason) => results.push(`SKIP  ${name}  -- ${reason}`)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const countNodes = (node) => (node.type === 'Page' ? 0 : 1) + (node.children || []).reduce((s, c) => s + countNodes(c), 0)

// ---------- 0. 准备：用「信息登记表单」模板建一个源页面 ----------
const created = await fetch(`${api}/pages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '导入导出测试-源页面', templateId: 'form' })
}).then((r) => r.json())
const sourceId = created.data?.id
if (!sourceId) {
  console.log('FAIL  模板建页失败', JSON.stringify(created))
  process.exit(1)
}
const sourcePage = await fetch(`${api}/pages/${sourceId}`).then((r) => r.json())
const sourceNodeCount = countNodes(sourcePage.data.schema)

// ---------- 1. 服务端：dryRun 不落库 / 非法输入被拦截 ----------
const beforeCount = (await fetch(`${api}/pages`).then((r) => r.json())).data.length
const dry = await fetch(`${api}/pages/import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dryRun: true, schema: sourcePage.data.schema, datasources: [], page: { name: '干跑页' } })
}).then((r) => r.json())
const afterCount = (await fetch(`${api}/pages`).then((r) => r.json())).data.length
ok(
  'dryRun 只校验不落库',
  dry.success === true && dry.data.nodes === sourceNodeCount && beforeCount === afterCount,
  `nodes=${dry.data?.nodes} pages ${beforeCount}->${afterCount}`
)

const badType = await fetch(`${api}/pages/import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dryRun: true, schema: { id: 'root', type: 'Page', children: [{ id: 'x1', type: 'NotAComp' }] } })
}).then((r) => r.json())
ok('非法组件类型被拒绝', badType.success === false && /不支持的组件类型/.test(badType.message), badType.message)

const noSchema = await fetch(`${api}/pages/import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '空文件' })
}).then((r) => r.json())
ok('缺少 schema 的文件被拒绝', noSchema.success === false && /没有找到页面结构/.test(noSchema.message), noSchema.message)

// ---------- 2. 浏览器：导出 JSON / HTML ----------
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
page.on('pageerror', (err) => results.push(`[pageerror] ${err.message}`))

/** 拦截 Blob 与 <a download> 点击，避免 headless 下载卡住，同时把内容留在 window.__blobs 里 */
async function armDownloadTrap() {
  await page.evaluate(() => {
    window.__blobs = []
    const origCreate = URL.createObjectURL
    URL.createObjectURL = function (blob) {
      window.__blobs.push(blob)
      return origCreate.call(URL, blob)
    }
    const origClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) return // 只拦截下载，不影响正常点击
      return origClick.call(this)
    }
  })
}

async function readLastBlob() {
  return page.evaluate(async () => {
    const blob = window.__blobs[window.__blobs.length - 1]
    return blob ? await blob.text() : null
  })
}

/** 打开「更多」菜单并点击某一项 */
async function clickMenuItem(label) {
  await page.evaluate(() => {
    const trigger = document.querySelector('.app-header .el-dropdown .el-button')
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await wait(500)
  await page.evaluate((text) => {
    const item = [...document.querySelectorAll('.el-dropdown-menu__item')].find((el) =>
      el.textContent.includes(text)
    )
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, label)
  await wait(800)
}

await page.goto(`${base}#/designer/${sourceId}`, { waitUntil: 'networkidle2' })
await wait(2000)
await page.evaluate(() => [...document.querySelectorAll('.el-drawer__close-btn')].forEach((b) => b.click()))
await wait(500)

await armDownloadTrap()
await clickMenuItem('导出页面 JSON')
let exportJson = null
try {
  exportJson = JSON.parse(await readLastBlob())
} catch (err) {
  exportJson = null
}
ok(
  '导出页面 JSON：标准导出包结构',
  exportJson?.format === 'lowcode-page' &&
    exportJson?.version === 1 &&
    exportJson?.schema?.type === 'Page' &&
    Array.isArray(exportJson?.datasources) &&
    exportJson?.page?.name === '导入导出测试-源页面',
  exportJson ? `format=${exportJson.format} nodes=${countNodes(exportJson.schema)}` : '未捕获到导出文件'
)

await clickMenuItem('导出 HTML 代码')
const htmlCode = await readLastBlob()
const htmlOk =
  typeof htmlCode === 'string' &&
  htmlCode.includes('window.__LC_PAGE__') &&
  htmlCode.includes('vue.global.prod.js') &&
  htmlCode.includes('element-plus') &&
  htmlCode.includes('信息登记') &&
  !htmlCode.includes('lc-node__badge')
ok('导出 HTML 代码：单文件含结构与依赖', htmlOk, htmlOk ? `${Math.round(htmlCode.length / 1024)}KB` : '内容不符')

// ---------- 3. 导出的 HTML 真实可运行（换成本地依赖，排除网络因素） ----------
mkdirSync('web/.tmp', { recursive: true })
const localHtml = 'web/.tmp/io-export-check.html'
if (htmlOk) {
  const localVue = 'file:///D:/www/lowcode-studio/web/node_modules/vue/dist/vue.global.prod.js'
  const localEp = 'file:///D:/www/lowcode-studio/web/node_modules/element-plus/dist/index.full.min.js'
  const localCss = 'file:///D:/www/lowcode-studio/web/node_modules/element-plus/dist/index.css'
  const offlineHtml = htmlCode
    .replace('https://unpkg.com/vue@3/dist/vue.global.prod.js', localVue)
    .replace('https://unpkg.com/element-plus/dist/index.full.min.js', localEp)
    .replace('https://unpkg.com/element-plus/dist/index.css', localCss)
  writeFileSync(localHtml, offlineHtml, 'utf-8')

  const exportPage = await browser.newPage()
  const errors = []
  exportPage.on('pageerror', (err) => errors.push(err.message))
  await exportPage.goto(`file:///${process.cwd().replace(/\\/g, '/')}/web/.tmp/io-export-check.html`, {
    waitUntil: 'networkidle2'
  })
  await wait(1500)
  const rendered = await exportPage.evaluate(() => ({
    page: !!document.querySelector('.lc-page'),
    title: document.querySelector('.lc-page h2')?.textContent?.trim() || '',
    inputs: document.querySelectorAll('.lc-page .el-input__inner').length,
    selects: document.querySelectorAll('.lc-page .el-select').length,
    buttons: [...document.querySelectorAll('.lc-page button')].map((b) => b.textContent.trim())
  }))
  ok(
    '导出的 HTML 独立打开可正常渲染',
    rendered.page && rendered.title === '信息登记' && rendered.inputs >= 2 && rendered.selects >= 1,
    JSON.stringify(rendered)
  )
  ok('导出的 HTML 无运行时报错', errors.length === 0, errors.join(' | '))
  if (rendered.page) {
    await exportPage.screenshot({ path: 'scripts/io-export-check.png' })
  }
  await exportPage.close()
}

// ---------- 4. 列表页导入：新建页面 ----------
await page.goto(`${base}#/`, { waitUntil: 'networkidle2' })
await wait(1500)
const pagesBefore = (await fetch(`${api}/pages`).then((r) => r.json())).data.length

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.app-header button')].find((b) => b.textContent.includes('导入'))
  btn?.click()
})
await page.waitForSelector('.el-dialog textarea', { timeout: 5000 })
await page.evaluate((json) => {
  const ta = document.querySelector('.el-dialog textarea')
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, json)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}, JSON.stringify(exportJson, null, 2))

await page.waitForSelector('.el-dialog .preview', { timeout: 8000 })
const preview = await page.evaluate(() => ({
  text: document.querySelector('.el-dialog .preview')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  error: document.querySelector('.el-dialog .import-error')?.textContent?.trim() || ''
}))
ok('导入弹窗展示校验摘要', /组件数量/.test(preview.text) && !preview.error, preview.text.slice(0, 80))

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) =>
    b.textContent.includes('导入并打开')
  )
  btn?.click()
})
await wait(2500)
const pagesAfter = (await fetch(`${api}/pages`).then((r) => r.json())).data.length
const importedUrl = await page.evaluate(() => location.hash)
const canvasNodes = await page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)
ok(
  '导入新建页面并进入设计器',
  pagesAfter === pagesBefore + 1 && /#\/designer\/page_/.test(importedUrl) && canvasNodes === sourceNodeCount,
  `pages ${pagesBefore}->${pagesAfter} nodes=${canvasNodes}/${sourceNodeCount}`
)

const importedId = importedUrl.split('/').pop()

// ---------- 5. 设计器导入：覆盖当前画布 ----------
await page.goto(`${base}#/designer/${sourceId}`, { waitUntil: 'networkidle2' })
await wait(2000)
await page.evaluate(() => [...document.querySelectorAll('.el-drawer__close-btn')].forEach((b) => b.click()))
await wait(400)

// 先把画布清空，覆盖后应重新出现源页面的组件
await clickMenuItem('清空画布')
await wait(600)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) =>
    b.textContent.includes('确定')
  )
  btn?.click()
})
await wait(800)
const emptyNodes = await page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)

await clickMenuItem('导入页面代码')
await page.waitForSelector('.el-dialog textarea', { timeout: 5000 })
await page.evaluate((json) => {
  const ta = document.querySelector('.el-dialog textarea')
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, json)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}, JSON.stringify(exportJson, null, 2))
await page.waitForSelector('.el-dialog .preview', { timeout: 8000 })

// 选择「覆盖当前画布」
await page.evaluate(() => {
  const radio = [...document.querySelectorAll('.el-dialog .el-radio')].find((el) =>
    el.textContent.includes('覆盖当前画布')
  )
  radio?.click()
})
await wait(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) =>
    b.textContent.includes('覆盖画布')
  )
  btn?.click()
})
await wait(600)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) =>
    b.textContent.includes('覆盖画布')
  )
  btn?.click()
})
await wait(1200)
const coveredNodes = await page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)
ok(
  '设计器导入可覆盖当前画布',
  emptyNodes === 0 && coveredNodes === sourceNodeCount,
  `empty=${emptyNodes} covered=${coveredNodes}/${sourceNodeCount}`
)

// ---------- 6. 非法 JSON：提示明确且不能提交 ----------
await clickMenuItem('导入页面代码')
await page.waitForSelector('.el-dialog textarea', { timeout: 5000 })
await page.evaluate(() => {
  const ta = document.querySelector('.el-dialog textarea')
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, '{"format":"lowcode-page", bad json')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
})
await wait(900)
const invalid = await page.evaluate(() => {
  const err = document.querySelector('.el-dialog .import-error')?.textContent?.trim() || ''
  const submit = [...document.querySelectorAll('.el-dialog__footer button')].find((b) =>
    b.textContent.includes('导入并打开')
  )
  return { err, disabled: submit ? submit.disabled : null }
})
ok('非法 JSON 给出错误且禁用提交', /不是合法的 JSON/.test(invalid.err) && invalid.disabled === true, JSON.stringify(invalid))
await page.evaluate(() => {
  const cancel = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => b.textContent.includes('取消'))
  cancel?.click()
})

// ---------- 7. 清理 ----------
await fetch(`${api}/pages/${sourceId}`, { method: 'DELETE' })
if (importedId) await fetch(`${api}/pages/${importedId}`, { method: 'DELETE' })
await browser.close()

console.log(results.join('\n'))
if (results.some((r) => r.startsWith('FAIL') || r.startsWith('[pageerror]'))) process.exit(1)
