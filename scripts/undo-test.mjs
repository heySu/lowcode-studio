import { createRequire } from 'node:module'

const require = createRequire('D:/www/factory-dashboard/package.json')
const puppeteer = require('puppeteer-core')

const base = 'http://localhost:3001/'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
page.on('pageerror', (err) => console.log('[pageerror]', err.message))

await page.goto(`${base}#/designer/page_demo_dashboard`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1800))

const count = () => page.evaluate(() => document.querySelectorAll('.canvas-sheet .lc-node').length)
const pre = await count()

// 双击组件面板「按钮」=> 添加到画布
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.comp-item')].find((el) => el.textContent.includes('按钮'))
  item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 500))
const added = await count()

await page.keyboard.down('Control')
await page.keyboard.press('z')
await page.keyboard.up('Control')
await new Promise((r) => setTimeout(r, 400))
const undone = await count()

await page.keyboard.down('Control')
await page.keyboard.down('Shift')
await page.keyboard.press('z')
await page.keyboard.up('Shift')
await page.keyboard.up('Control')
await new Promise((r) => setTimeout(r, 400))
const redone = await count()

console.log(`before=${pre} afterAdd=${added} afterUndo=${undone} afterRedo=${redone}`)
console.log(added === pre + 1 && undone === pre && redone === pre + 1 ? 'PASS 撤销/重做链路' : 'FAIL 撤销/重做')
await browser.close()
process.exit(added === pre + 1 && undone === pre && redone === pre + 1 ? 0 : 1)
