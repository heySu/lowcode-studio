/**
 * 交互预览模式端到端测试
 * ------------------------------------------------------------
 * 背景：设计态为防止误操作禁用了控件交互，导致「下拉有值但点不开」；
 *      同时点击被禁用控件时命中测试落到父容器，造成「选中的是父元素」的困惑。
 * 修复：① 顶栏「交互」开关——打开后画布恢复真实交互（等同运行态）；
 *      ② Canvas 捕获阶段用 closest 选中命中的最近节点，不再依赖冒泡。
 * 覆盖：设计态点击不弹下拉且正确选中组件、开关切换、交互态下拉展开/选项/输入框、
 *      关闭后恢复编辑、徽标操作不受影响。测试自建页面、结束删除。
 */
import { createRequire } from 'node:module'

const require = createRequire('D:/www/factory-dashboard/package.json')
const puppeteer = require('puppeteer-core')

const base = 'http://localhost:3001/'
const api = 'http://localhost:3001/api'
const results = []
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
page.on('pageerror', (err) => results.push(`[pageerror] ${err.message}`))

const created = await fetch(`${api}/pages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '交互模式用例', templateId: 'form' })
}).then((r) => r.json())
const pageId = created.data.id

await page.goto(`${base}#/designer/${pageId}`, { waitUntil: 'networkidle2' })
await wait(2000)
await page.evaluate(() => [...document.querySelectorAll('.el-drawer__close-btn')].forEach((b) => b.click()))
await wait(900)

const selectPos = () =>
  page.evaluate(() => {
    const w = document.querySelector('.canvas-sheet .el-select__wrapper')
    const r = w.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  })

const visibleDropdown = () =>
  page.evaluate(() => {
    const v = [...document.querySelectorAll('.el-select-dropdown')].find(
      (el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0
    )
    return v ? [...v.querySelectorAll('.el-select-dropdown__item')].map((o) => o.textContent.trim()) : null
  })

const selectedType = () =>
  page.evaluate(() => {
    const s = document.querySelector('.canvas-sheet .lc-node.is-selected')
    return s ? s.querySelector('.lc-node__type')?.textContent || '选中节点' : 'root'
  })

// ---------- 1. 设计态：点下拉不弹出，且选中的是组件本身 ----------
let p = await selectPos()
await page.mouse.click(p.x, p.y)
await wait(500)
ok('设计态点下拉不弹出', !(await visibleDropdown()))
ok('设计态点击选中「下拉选择」组件', (await selectedType()) === '下拉选择', await selectedType())

// ---------- 2. 打开交互开关 ----------
await page.evaluate(() => document.querySelector('.interactive-toggle__label').click())
await wait(500)
const on = await page.evaluate(() => ({
  sw: document.querySelector('.interactive-toggle')?.classList.contains('is-on'),
  tip: !!document.querySelector('.canvas-interactive-tip'),
  design: document.querySelector('.canvas-sheet')?.classList.contains('lc-design')
}))
ok('交互开关开启并显示提示条', on.sw && on.tip && !on.design, JSON.stringify(on))

// ---------- 3. 交互态：下拉正常展开并可选 ----------
p = await selectPos()
await page.mouse.click(p.x, p.y)
await wait(900)
const options = await visibleDropdown()
ok('交互态下拉展开且带选项', Array.isArray(options) && options.length > 0, JSON.stringify(options))
if (options) {
  await page.evaluate(() => {
    const v = [...document.querySelectorAll('.el-select-dropdown')].find(
      (el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0
    )
    v.querySelector('.el-select-dropdown__item').click()
  })
  await wait(500)
  const val = await page.evaluate(
    () =>
      document.querySelector('.canvas-sheet .el-select__selected-item')?.textContent?.trim() ||
      document.querySelector('.canvas-sheet .el-select__placeholder')?.textContent?.trim()
  )
  ok('交互态可选中选项', val === '研发部', `当前值=${val}`)
}

// ---------- 4. 交互态：输入框可输入 ----------
const ip = await page.evaluate(() => {
  const r = document.querySelector('.canvas-sheet input.el-input__inner').getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
await page.mouse.click(ip.x, ip.y)
await page.keyboard.type('张三')
await wait(400)
const typed = await page.evaluate(() => document.querySelector('.canvas-sheet input.el-input__inner')?.value)
ok('交互态输入框可输入', typed === '张三', `value=${typed}`)

// ---------- 5. 交互态：点击组件不改变选中 ----------
const beforeSel = await selectedType()
await page.mouse.click(ip.x, ip.y)
await wait(300)
ok('交互态点击不改变选中', (await selectedType()) === beforeSel, `${beforeSel}`)

// ---------- 6. 关闭交互，恢复编辑态 ----------
await page.evaluate(() => document.querySelector('.interactive-toggle__label').click())
await wait(500)
p = await selectPos()
await page.mouse.click(p.x, p.y)
await wait(400)
ok('关闭交互后恢复点击选中', (await selectedType()) === '下拉选择', await selectedType())
ok('关闭交互后下拉不再弹出', !(await visibleDropdown()))

// ---------- 7. 徽标操作不受影响 ----------
const beforeCount = await page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)
await page.evaluate(() => document.querySelector('.lc-node__badge .lc-node__act')?.click())
await wait(500)
const afterCount = await page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)
ok('徽标复制操作正常', afterCount === beforeCount + 1, `${beforeCount} -> ${afterCount}`)

// ---------- 清理 ----------
await fetch(`${api}/pages/${pageId}`, { method: 'DELETE' })
await browser.close()

console.log(results.join('\n'))
if (results.some((r) => r.startsWith('FAIL') || r.startsWith('[pageerror]'))) process.exit(1)
