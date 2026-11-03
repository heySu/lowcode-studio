import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('D:/www/factory-dashboard/package.json')
const puppeteer = require('puppeteer-core')

const OUT = 'D:/www/lowcode-studio/shots'
fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const problems = []
page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type())) problems.push(`[${msg.type()}] ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`))

async function shot(url, name, wait = 1600) {
  await page.goto(url, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, wait))
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`captured ${name}`)
}

const base = 'http://localhost:3001/'
await shot(`${base}#/`, 'list')
await shot(`${base}#/designer/page_demo_form`, 'designer', 2400)
await shot(`${base}#/view/page_demo_form?preview=1`, 'viewer')

console.log('\n--- console problems ---')
console.log(problems.length ? problems.join('\n') : 'none')

await browser.close()
