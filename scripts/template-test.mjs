/**
 * 模板与新手引导的端到端验证
 * ------------------------------------------------------------
 * 覆盖：新建弹窗展示模板与改造指引 → 按模板建页落到设计器 → 空页面引导与使用说明自动弹出。
 * 说明：用例会创建临时页面并在结束后删除，避免污染示例数据。
 */
import { createRequire } from 'node:module'

const require = createRequire('D:/www/factory-dashboard/package.json')
const puppeteer = require('puppeteer-core')

const base = 'http://localhost:3001/'
const api = 'http://localhost:3001/api'
const results = []
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`)

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
page.on('pageerror', (err) => results.push(`[pageerror] ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') results.push(`[console] ${msg.text()}`)
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- 1. 新建弹窗：模板卡片 + 改造指引 ----------
await page.goto(base, { waitUntil: 'networkidle2' })
await wait(1200)
await page.click('.app-header .el-button--primary')
await wait(900)

const cardCount = await page.evaluate(() => document.querySelectorAll('.tpl-card').length)
ok('新建弹窗展示模板卡片', cardCount >= 5, `卡片数=${cardCount}`)

const sideText = await page.evaluate(() => document.querySelector('.tpl-side')?.innerText || '')
ok('右侧展示适用场景与改造步骤', sideText.includes('适用场景') && sideText.includes('怎么改成你的业务'), `长度=${sideText.length}`)

// 选「数据查询列表」模板，名称自动带入
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.tpl-card')].find((el) => el.innerText.includes('数据查询列表'))
  card?.click()
})
await wait(400)
const selectedName = await page.evaluate(() => document.querySelector('.tpl-side__name')?.textContent || '')
ok('切换模板后详情联动', selectedName.includes('数据查询列表'), `name=${selectedName.trim()}`)

await page.screenshot({ path: 'D:/www/lowcode-studio/shots/template-dialog.png' })

// ---------- 2. 按模板创建并进入设计器 ----------
// 用真实键盘输入：Element Plus 的输入框是受控组件，直接赋值不一定能触发 v-model
const nameInput = await page.$('.tpl-basic input')
await nameInput.click({ clickCount: 3 })
await nameInput.type('订单查询-模板用例')
await wait(200)
await page.evaluate(() => document.querySelector('.el-dialog__footer .el-button--primary').click())
await wait(2400)

const inDesigner = page.url().includes('#/designer/')
const canvasNodes = await page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)
ok('按模板创建后进入设计器', inDesigner, page.url().split('#')[1] || '')
ok('画布已铺好模板内容', canvasNodes >= 8, `节点数=${canvasNodes}`)

const pageId = page.url().split('#/designer/')[1]
await page.screenshot({ path: 'D:/www/lowcode-studio/shots/designer-from-template.png' })

// ---------- 3. 空页面：引导块 + 自动弹出使用说明 ----------
const blank = await fetch(`${api}/pages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '空白页-引导用例' })
}).then((r) => r.json())

await page.goto(`${base}#/designer/${blank.data.id}`, { waitUntil: 'networkidle2' })
await wait(1800)

const guideVisible = await page.evaluate(() => !!document.querySelector('.canvas-guide'))
const guideWays = await page.evaluate(() => document.querySelectorAll('.canvas-guide__way').length)
ok('空画布展示上手引导', guideVisible, `引导路径=${guideWays} 条`)

const helpOpen = await page.evaluate(() => !!document.querySelector('.help') && !!document.querySelector('.el-drawer__header'))
const helpText = await page.evaluate(() => document.querySelector('.help')?.innerText || '')
ok('空页面自动打开使用说明', helpOpen)
ok(
  '说明覆盖上手/数据/发布/常见问题',
  ['三分钟上手', '数据怎么进来', '保存、预览、发布有什么区别', '常见问题'].every((k) => helpText.includes(k)),
  `长度=${helpText.length}`
)
await page.screenshot({ path: 'D:/www/lowcode-studio/shots/designer-empty-guide.png' })

// ---------- 4. 引导里的「选择模板」可直接套用 ----------
// 用抽屉关闭按钮而不是 Escape：el-drawer 的 Esc 关闭依赖焦点，自动化下不稳定
await page.evaluate(() => document.querySelector('.el-drawer__close-btn')?.click())
await wait(800)
await page.evaluate(() => document.querySelector('.canvas-guide .el-button--primary')?.click())
await wait(1000)
const applyDialog = await page.evaluate(() => document.querySelector('.el-dialog__title')?.textContent || '')
ok('引导可直达模板弹窗', applyDialog.includes('套用'), `title=${applyDialog}`)

await page.evaluate(() => {
  const card = [...document.querySelectorAll('.tpl-card')].find((el) => el.innerText.includes('反馈收集'))
  card?.click()
})
await wait(300)
await page.evaluate(() => document.querySelector('.el-dialog__footer .el-button--primary')?.click())
await wait(1600)
const applied = await page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)
ok('套用模板后画布有内容', applied >= 8, `节点数=${applied}`)

// ---------- 清理 ----------
await fetch(`${api}/pages/${blank.data.id}`, { method: 'DELETE' })
if (pageId) await fetch(`${api}/pages/${pageId}`, { method: 'DELETE' })

console.log(results.join('\n'))
await browser.close()
process.exit(results.some((r) => r.startsWith('FAIL') || r.startsWith('[')) ? 1 : 0)
