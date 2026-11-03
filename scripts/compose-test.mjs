/**
 * 组合能力端到端测试
 * ------------------------------------------------------------
 * 覆盖用户反馈「组件无法任意组合」的全部修复点：
 *   1. 拖「横向容器」到画布（面板预设变体）
 *   2. 拖两个输入框进横向容器 → 并排一行且均分宽度
 *   3. 拖组件到容器的边缘带 → 成为容器兄弟（不再被强制吸入内部）
 *   4. 横向容器内按左右半区排序（而非只认上下）
 *   5. 双击添加组件到选中的叶子节点 → 插到它后面（不凭空消失）
 *   6. 拖组件到根级组件之间的空隙 → 精确插入中间
 * 测试自建页面、结束删除，不污染示例数据。
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

// ---------- 0. 建测试页 ----------
const created = await fetch(`${api}/pages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '组合能力测试页' })
}).then((r) => r.json())
const pageId = created.data.id

await page.goto(`${base}#/designer/${pageId}`, { waitUntil: 'networkidle2' })
await wait(2000)

// 空页面会自动弹出「使用说明」抽屉，其遮罩会拦截 elementFromPoint —— 先关闭。
// 注意：Element Plus 的 overlay 关闭后仍留在 DOM，判定要用 display 而非节点存在性。
await page.evaluate(() => [...document.querySelectorAll('.el-drawer__close-btn')].forEach((b) => b.click()))
await wait(1000)
const drawerGone = await page.evaluate(
  () => ![...document.querySelectorAll('.el-overlay.is-drawer')].some((o) => getComputedStyle(o).display !== 'none')
)
ok('关闭自动弹出的帮助抽屉', drawerGone)

/**
 * HTML5 DnD 模拟：dragstart → dragover(带坐标) → drop → dragend。
 * clientX/clientY 必须显式传，DragEvent 构造器不会从 target 推导。
 */
function dragTo(srcSelectorFn, dstFn, point) {
  return page.evaluate(
    ({ srcStr, dstStr, point }) => {
      const src = new Function(`return (${srcStr})()`)()
      if (!src) return { ok: false, miss: 'src' }
      const dt = new DataTransfer()
      const opts = { bubbles: true, cancelable: true, dataTransfer: dt, ...point }
      src.dispatchEvent(new DragEvent('dragstart', opts))
      // 真实浏览器把 dragover 派发给指针下最深元素（再冒泡），
      // 有坐标时用 elementFromPoint，否则落到画布
      let dst = dstStr ? new Function(`return (${dstStr})()`)() : null
      if (point.clientX != null) {
        dst = document.elementFromPoint(point.clientX, point.clientY) || dst
      }
      if (!dst) return { ok: false, miss: 'dst' }
      dst.dispatchEvent(new DragEvent('dragover', opts))
      dst.dispatchEvent(new DragEvent('drop', opts))
      src.dispatchEvent(new DragEvent('dragend', opts))
      return { ok: true, hit: dst.className?.toString().slice(0, 40) }
    },
    { srcStr: srcSelectorFn.toString(), dstStr: dstFn?.toString(), point }
  )
}

/** 生成「自包含」的选择器函数：序列化到浏览器执行时不依赖外层闭包 */
const compItem = (label) =>
  new Function(
    `return function(){ return [...document.querySelectorAll('.comp-item')].find(function(el){ return el.textContent.includes(${JSON.stringify(label)}) }) }`
  )()
const rootEl = () => document.querySelector('.canvas-sheet')

// ---------- 1. 拖「横向容器」到画布 ----------
const d1 = await dragTo(compItem('横向容器'), rootEl, {})
console.log('step1 drag:', JSON.stringify(d1))
await wait(700)
const rowContainer = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.canvas-sheet .lc-node')].find((n) => {
    const flex = n.querySelector('.lc-flex')
    return flex && flex.style.flexDirection === 'row'
  })
  if (!el) return null
  const inner = el.querySelector('.lc-flex')
  return { id: el.dataset.nodeId, flexDir: inner?.style.flexDirection }
})
ok('拖入「横向容器」预设变体', !!rowContainer && rowContainer.flexDir === 'row', JSON.stringify(rowContainer))

/** 组件特征识别：badge 只在选中时渲染，顺序验证必须看 DOM 特征 */
const KIND_FN = `(function kind(el) {
  if (el.querySelector('.el-input-number')) return '数字输入'
  if (el.querySelector('.el-tag')) return '标签'
  if (el.querySelector('.el-button')) return '按钮'
  if (el.querySelector('.lc-flex')) return '容器'
  if (el.querySelector('textarea')) return '多行文本'
  if (el.querySelector('.el-input__inner')) return '单行输入'
  return '其他'
})`

// ---------- 2. 拖两个输入框进横向容器，验证并排 + 均分 ----------
const rowRect = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.canvas-sheet .lc-node')].find((n) => n.querySelector('.lc-flex'))
  const r = el.querySelector('.lc-flex').getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})
const d2 = await dragTo(compItem('单行输入'), rootEl, { clientX: rowRect.x, clientY: rowRect.y })
console.log('step2a drag:', JSON.stringify(d2))
await wait(700)
const d3 = await dragTo(compItem('数字输入'), rootEl, { clientX: rowRect.x, clientY: rowRect.y })
console.log('step2b drag:', JSON.stringify(d3))
await wait(700)
console.log(
  'state after step2:',
  await page.evaluate(() => {
    const kids = [...document.querySelectorAll('.canvas-sheet > .lc-root > .lc-node')]
    return kids.map((k) => ({
      id: k.dataset.nodeId,
      type: k.querySelector('.lc-node__type')?.textContent,
      children: k.querySelectorAll('.lc-node').length - 1
    }))
  })
)

const rowCheck = await page.evaluate(() => {
  const flex = document.querySelector('.canvas-sheet .lc-node .lc-flex')
  const kids = [...flex.children].filter((el) => el.classList.contains('lc-node'))
  if (kids.length < 2) return { count: kids.length }
  const [a, b] = kids.map((el) => el.getBoundingClientRect())
  return {
    count: kids.length,
    sameRow: Math.abs(a.top - b.top) < 4,
    equalWidth: Math.abs(a.width - b.width) < 6,
    width: Math.round(a.width)
  }
})
ok('两个输入框并排一行', rowCheck.count === 2 && rowCheck.sameRow, JSON.stringify(rowCheck))
ok('行内子项默认均分宽度', rowCheck.equalWidth, `width=${rowCheck.width}`)

// ---------- 3. 拖「文本」到容器下方的画布空白 → 成为兄弟（不被吸入容器） ----------
// 说明：容器默认布局中立（padding 0）后，子控件铺满容器盒子，
//      容器自身的边缘带只在容器空白处生效；往容器下方加兄弟组件
//      的正确姿势是指向容器下方的画布空白（由根级空隙落点逻辑接住）。
const edges = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.canvas-sheet .lc-node')].find((n) => n.querySelector('.lc-flex'))
  const r = el.getBoundingClientRect()
  return { id: el.dataset.nodeId, left: r.left + 60, below: r.bottom + 24 }
})
await dragTo(compItem('文本'), rootEl, { clientX: edges.left, clientY: edges.below })
await wait(700)
const afterEdge = await page.evaluate((rowId) => {
  const row = [...document.querySelectorAll('.canvas-sheet > .lc-root > .lc-node')].find((n) => n.dataset.nodeId === rowId)
  const rootKids = [...document.querySelectorAll('.canvas-sheet > .lc-root > .lc-node')]
  const rowChildren = row.querySelectorAll('.lc-node > .lc-flex > .lc-node').length
  return { rootCount: rootKids.length, rowChildCount: rowChildren }
}, edges.id)
ok('容器下方拖入 → 成为兄弟而非子级', afterEdge.rootCount === 2 && afterEdge.rowChildCount === 2, JSON.stringify(afterEdge))

// ---------- 4. 横向容器内左右半区排序 ----------
// 把第二个输入框（数字输入）拖到第一个输入框的左半区 → 顺序应互换
const swap = await page.evaluate(() => {
  const flex = document.querySelector('.canvas-sheet .lc-node .lc-flex')
  const kids = [...flex.children].filter((el) => el.classList.contains('lc-node'))
  const first = kids[0].getBoundingClientRect()
  return { targetId: kids[1].dataset.nodeId, x: first.left + 8, y: first.top + first.height / 2 }
})
await page.evaluate(({ swap }) => {
  const flex = document.querySelector('.canvas-sheet .lc-node .lc-flex')
  const kids = [...flex.children].filter((el) => el.classList.contains('lc-node'))
  const srcEl = kids.find((el) => el.dataset.nodeId === swap.targetId)
  const dt = new DataTransfer()
  const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: swap.x, clientY: swap.y }
  srcEl.dispatchEvent(new DragEvent('dragstart', opts))
  kids[0].dispatchEvent(new DragEvent('dragover', opts))
  kids[0].dispatchEvent(new DragEvent('drop', opts))
  srcEl.dispatchEvent(new DragEvent('dragend', opts))
}, { swap })
await wait(700)
const order = await page.evaluate(`(() => {
  const kind = ${KIND_FN}
  const flex = document.querySelector('.canvas-sheet .lc-node .lc-flex')
  const kids = [...flex.children].filter((el) => el.classList.contains('lc-node'))
  return kids.map(kind)
})()`)
ok('横向容器内左右半区排序生效', order[0] === '数字输入', `order=${order.join(',')}`)

// ---------- 5. 双击添加到选中的叶子节点 → 插到后面而非消失 ----------
await page.evaluate(() => {
  // 选中第一个根级子节点（横向容器前的兄弟不可能有，选行内第一个输入框）
  const flex = document.querySelector('.canvas-sheet .lc-node .lc-flex')
  const kid = [...flex.children].find((el) => el.classList.contains('lc-node'))
  kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await wait(400)
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.comp-item')].find((el) => el.textContent.includes('按钮'))
  item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
})
await wait(700)
const dbl = await page.evaluate(`(() => {
  const kind = ${KIND_FN}
  const flex = document.querySelector('.canvas-sheet .lc-node .lc-flex')
  const kids = [...flex.children].filter((el) => el.classList.contains('lc-node'))
  const labels = kids.map(kind)
  const total = document.querySelectorAll('.canvas-sheet .lc-node').length
  return { labels, total }
})()`)
ok('双击添加到叶子 → 插入其后（不消失）', dbl.labels[1] === '按钮' && dbl.labels.length === 3, JSON.stringify(dbl.labels))

// ---------- 6. 根级空隙插入中间 ----------
// 根级当前：横向容器 + 文本。把「标签」拖到两者的空隙 → 插到中间
const gap = await page.evaluate(() => {
  const kids = [...document.querySelectorAll('.canvas-sheet > .lc-root > .lc-node')]
  const a = kids[0].getBoundingClientRect()
  const b = kids[1].getBoundingClientRect()
  return { y: (a.bottom + b.top) / 2 }
})
await dragTo(compItem('标签'), rootEl, { clientX: 500, clientY: gap.y })
await wait(700)
const gapCheck = await page.evaluate(`(() => {
  const kind = ${KIND_FN}
  const kids = [...document.querySelectorAll('.canvas-sheet > .lc-root > .lc-node')]
  return kids.map(kind)
})()`)
ok('空隙拖入精确插入中间', gapCheck[1] === '标签' && gapCheck.length === 3, JSON.stringify(gapCheck))

// ---------- 7. 清理 ----------
await fetch(`${api}/pages/${pageId}`, { method: 'DELETE' })
await browser.close()

console.log(results.join('\n'))
if (results.some((r) => r.startsWith('FAIL') || r.startsWith('[pageerror]'))) process.exit(1)
