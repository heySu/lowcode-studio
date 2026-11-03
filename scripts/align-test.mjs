/**
 * 行内对齐回归测试
 * ------------------------------------------------------------
 * 覆盖用户反馈「新增加元素后错位」的修复点：
 *   1. 基线：信息登记模板第 1/2 行的表单控件本身对齐（模板渲染无错位）；
 *   2. 拖「容器」进第一行、再拖「单行输入」进该容器——
 *      修复前容器默认带 16px 内边距 + 边框 + 白底，与同行控件错位；
 *      修复后容器默认布局中立（padding 0 / 无边框 / 透明背景），
 *      行内三个控件顶部对齐、高度一致、宽度均分；
 *   3. 直接拖「单行输入」到第二行（不经过容器）→ 作为行内兄弟插入且对齐。
 * 测试自建页面（套用 form 模板）、结束删除，不污染示例数据。
 */
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

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

// ---------- 0. 用「信息登记表单」模板建测试页 ----------
const created = await fetch(`${api}/pages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '对齐回归测试页', templateId: 'form' })
}).then((r) => r.json())
const pageId = created.data.id
if (!pageId) {
  console.log('FAIL  模板建页失败', JSON.stringify(created))
  process.exit(1)
}

await page.goto(`${base}#/designer/${pageId}`, { waitUntil: 'networkidle2' })
await wait(2200)
// 防御性关闭可能的帮助抽屉（遮罩会拦截 elementFromPoint）
await page.evaluate(() => [...document.querySelectorAll('.el-drawer__close-btn')].forEach((b) => b.click()))
await wait(600)

/** 行容器定位：画布里 flexDirection=row 的 .lc-flex（按出现顺序） */
const rowBox = (index) =>
  page.evaluate((idx) => {
    const rows = [...document.querySelectorAll('.canvas-sheet .lc-flex')].filter(
      (el) => el.style.flexDirection === 'row'
    )
    const el = rows[idx]
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, height: r.height }
  }, index)

/** 行内对齐度量：该行的直接 .lc-node 子项里，每个表单控件的输入框盒子 */
function measureRow(index) {
  return page.evaluate((idx) => {
    const rows = [...document.querySelectorAll('.canvas-sheet .lc-flex')].filter(
      (el) => el.style.flexDirection === 'row'
    )
    const row = rows[idx]
    if (!row) return null
    const kids = [...row.children].filter((el) => el.classList.contains('lc-node'))
    return kids.map((el) => {
      const control = el.querySelector('.el-input__wrapper, .el-select__wrapper, .el-date-editor, textarea')
      const r = (control || el).getBoundingClientRect()
      const cs = getComputedStyle(el.querySelector('.lc-flex') || el)
      return {
        kind: el.querySelector('.lc-node__type')?.textContent || el.dataset.nodeId,
        top: Math.round(r.top),
        height: Math.round(r.height),
        width: Math.round(el.getBoundingClientRect().width),
        // 容器子项要确认布局中立：padding 应为 0、背景透明
        pad: cs.padding,
        bg: cs.backgroundColor
      }
    })
  }, index)
}

// ---------- 1. 模板基线：第 1 行（姓名/手机号）应对齐 ----------
const base1 = await measureRow(0)
const aligned = (cells, tol = 3) =>
  cells.every((c) => Math.abs(c.top - cells[0].top) <= tol && Math.abs(c.height - cells[0].height) <= tol)
ok('模板基线：第一行控件对齐', Array.isArray(base1) && base1.length === 2 && aligned(base1), JSON.stringify(base1))

// ---------- 2. 复现用户操作：拖「容器」进第一行，再拖「单行输入」进容器 ----------
function dragTo(srcSelectorFn, point) {
  return page.evaluate(
    ({ srcStr, point }) => {
      const src = new Function(`return (${srcStr})()`)()
      if (!src) return { ok: false, miss: 'src' }
      const dt = new DataTransfer()
      const opts = { bubbles: true, cancelable: true, dataTransfer: dt, ...point }
      src.dispatchEvent(new DragEvent('dragstart', opts))
      const dst = (point.clientX != null && document.elementFromPoint(point.clientX, point.clientY)) || null
      if (!dst) return { ok: false, miss: 'dst' }
      dst.dispatchEvent(new DragEvent('dragover', opts))
      dst.dispatchEvent(new DragEvent('drop', opts))
      src.dispatchEvent(new DragEvent('dragend', opts))
      return { ok: true, hit: dst.className?.toString().slice(0, 40) }
    },
    { srcStr: srcSelectorFn.toString(), point }
  )
}
const exactItem = (label) =>
  new Function(
    `return function(){ return [...document.querySelectorAll('.comp-item')].find(function(el){ return el.textContent.trim() === ${JSON.stringify(label)} }) }`
  )()

const r0 = await rowBox(0)
// 第一步：把「容器」拖到第一行中部 → 落进行内成为第三个子项
const d1 = await dragTo(exactItem('容器'), { clientX: r0.x, clientY: r0.y })
await wait(700)
// 第二步：定位新容器（行内最后一个子项）的中心，把「单行输入」拖进容器内部
const dropInNewContainer = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.canvas-sheet .lc-flex')].filter(
    (el) => el.style.flexDirection === 'row'
  )
  const kids = [...rows[0].children].filter((el) => el.classList.contains('lc-node'))
  const r = kids[kids.length - 1].getBoundingClientRect()
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
})
const d2 = await dragTo(exactItem('单行输入'), dropInNewContainer)
console.log('drag container:', JSON.stringify(d1), ' drag input:', JSON.stringify(d2))
await wait(700)

const row1 = await measureRow(0)
// 三个子项：姓名 / 手机号 / 新容器(内含输入框)。
ok(
  '第一行拖入容器+输入框后仍对齐',
  row1.length === 3 && aligned(row1),
  JSON.stringify(row1)
)
// 容器子项要确认布局中立：padding 应为 0、背景透明
const neutral = row1[2] ? row1[2].pad === '0px' && ['rgba(0, 0, 0, 0)', 'transparent'].includes(row1[2].bg) : false
ok('新增容器默认布局中立（无内边距/透明背景）', neutral, JSON.stringify(row1[2]))
// 宽度：三个填充型子项应近似均分
const eq = row1.length === 3 && Math.abs(row1[0].width - row1[2].width) < 8 && Math.abs(row1[1].width - row1[2].width) < 8
ok('行内三个子项宽度均分', eq, row1.map((c) => c.width).join(','))

// ---------- 3. 直接拖「下拉选择」到第二行 → 兄弟插入且对齐 ----------
const r1 = await rowBox(1)
const d3 = await dragTo(exactItem('下拉选择'), { clientX: r1.x, clientY: r1.y })
console.log('drag select:', JSON.stringify(d3))
await wait(700)
const row2 = await measureRow(1)
ok(
  '第二行直接拖入控件后对齐（3 项均分）',
  row2.length === 3 && aligned(row2) && Math.abs(row2[0].width - row2[2].width) < 8,
  JSON.stringify(row2)
)

// ---------- 4. 截图留档 ----------
await page.screenshot({ path: 'scripts/align-test.png', fullPage: false })

// ---------- 5. 清理 ----------
await fetch(`${api}/pages/${pageId}`, { method: 'DELETE' })
await browser.close()

console.log(results.join('\n'))
if (results.some((r) => r.startsWith('FAIL') || r.startsWith('[pageerror]'))) process.exit(1)
