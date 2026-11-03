import { createRequire } from 'node:module'

const require = createRequire('D:/www/factory-dashboard/package.json')
const puppeteer = require('puppeteer-core')

const base = 'http://localhost:3001/'
const results = []
const ok = (name, pass, extra = '') => {
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
page.on('pageerror', (err) => results.push(`[pageerror] ${err.message}`))

const api = 'http://localhost:3001/api'

// ---------- 0. 备份被测页面 ----------
// 业务：这套用例会往示例页面里加组件并发布，如果每次都留痕，跑几次后示例数据就被污染了。
//      所以先备份 schema，结束时原样写回，保证用例可重复执行、结果可对比。
const snapshot = (await (await fetch(`${api}/pages/page_demo_dashboard`)).json()).data

// ---------- 1. 设计器：拖拽添加组件 ----------
await page.goto(`${base}#/designer/page_demo_dashboard`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2000))

const countNodes = () =>
  page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)

const before = await countNodes()
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.comp-item')]
  const src = items.find((el) => el.textContent.includes('按钮'))
  const dst = document.querySelector('.canvas-sheet')
  const dt = new DataTransfer()
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
  dst.dispatchEvent(
    new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: dst.getBoundingClientRect().bottom - 40 })
  )
  dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
})
await new Promise((r) => setTimeout(r, 800))
const after = await countNodes()
ok('拖拽「按钮」到画布', after === before + 1, `${before} -> ${after}`)

// ---------- 2. 选中节点，右侧属性面板联动 ----------
await page.evaluate(() => {
  document.querySelectorAll('.canvas-sheet .lc-node')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 500))
const badge = await page.evaluate(() => {
  const selected = document.querySelector('.canvas-sheet .lc-node.is-selected')
  return selected ? selected.querySelector('.lc-node__type')?.textContent : null
})
ok('点击画布节点出现选中态', !!badge, `badge=${badge}`)

// ---------- 3. 保存并验证后端持久化 ----------
await page.click('.app-header .el-button--primary')
await new Promise((r) => setTimeout(r, 1000))
const saved = await fetch('http://localhost:3001/api/pages/page_demo_dashboard').then((r) => r.json())
const nodeCount = JSON.stringify(saved.data.schema).match(/"type":/g).length
ok('保存后后端 schema 已更新', nodeCount > 19, `节点数=${nodeCount}`)

// ---------- 4. 运行态：填表单 -> 点按钮 -> 触发后端请求 ----------
await page.goto(`${base}#/view/page_demo_form?preview=1`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))
await page.type('.lc-root input.el-input__inner', '测试用户')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-button')].find((b) => b.textContent.includes('提交登记'))
  btn.click()
})
await new Promise((r) => setTimeout(r, 1200))
const message = await page.evaluate(() => document.querySelector('.el-message')?.textContent || '')
ok('按钮「请求接口」动作触发并收到提示', message.includes('成功') || message.includes('收到'), `message=${message.trim()}`)

// ---------- 5. 发布 -> 公开链接访问 ----------
await page.goto(`${base}#/designer/page_demo_form`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.app-header .el-button')].find((b) => b.textContent.includes('发布'))
  btn.click()
})
await new Promise((r) => setTimeout(r, 1200))
const pub = await fetch('http://localhost:3001/api/published/page_demo_form').then((r) => r.json())
ok('发布后 /api/published 返回快照', pub.success && !!pub.data?.schema, `status=${pub.success}`)

await page.goto(`${base}#/view/page_demo_form`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1200))
const pubTitle = await page.evaluate(() => document.querySelector('.viewer__bar strong')?.textContent || '')
ok('发布链接可正常访问', pubTitle.includes('员工信息登记'), `title=${pubTitle}`)

// 撤销/重做由 scripts/undo-test.mjs 单独覆盖

// ---------- 6. 还原被测页面，避免污染示例数据 ----------
const restored = await fetch(`${api}/pages/page_demo_dashboard`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ schema: snapshot.schema, datasources: snapshot.datasources })
}).then((r) => r.json())
ok('测试数据已还原', restored.success === true, `revision=${restored.data?.revision}`)

console.log(results.join('\n'))
await browser.close()

const failed = results.filter((r) => r.startsWith('FAIL') || r.includes('pageerror')).length
process.exit(failed ? 1 : 0)
