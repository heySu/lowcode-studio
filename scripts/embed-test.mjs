/**
 * 接入其它系统（iframe 嵌入）端到端测试
 * ------------------------------------------------------------
 * 覆盖「把页面接进宿主系统」的完整链路，验证文档不落空：
 *   1. 响应头：普通页面禁止被第三方 iframe 引用；带 ?embed=1 的文档改用 CSP frame-ancestors 放行；
 *   2. 嵌入模式：不渲染平台顶栏、加 lc-embed 类、背景透明（宿主背景能透出来）；
 *   3. 传参预填：?prefill=<base64url JSON> 生效，多余字段被忽略；
 *   4. postMessage：lc:hello / lc:ready / lc:resize / lc:submit / lc:error 按文档约定发出，
 *      宿主用 lc:resize 同步 iframe 高度后可消除内层滚动条；
 *   5. 表单提交：点击「请求接口」按钮后，宿主收到 lc:submit 且 data 里是表单字段；
 *   6. 未发布页面嵌入：宿主收到 lc:error（而不是一块无声的空白）；
 *   7. 接入指南页：能打开、生成器产出可粘贴的 iframe 代码且内含 embed=1 / #/view/。
 * 测试自建页面，结束删除，不污染示例数据。
 */
import { createRequire } from 'node:module'

const require = createRequire('D:/www/factory-dashboard/package.json')
const puppeteer = require('puppeteer-core')

const base = 'http://localhost:3001'
const api = `${base}/api`
const results = []
const ok = (name, pass, extra = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 与前端 utils/embed.js 的 encodePrefill 等价 */
const encodePrefill = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url')

let embedPageId = ''
let draftPageId = ''
let browser

try {
  // ---------- 0. 准备页面：标题 + 姓名输入 + 部门下拉 + 提交按钮 ----------
  const schema = {
    id: 'root',
    type: 'Page',
    children: [
      { id: 'title1', type: 'Title', props: { text: '接入测试页', level: 2 }, children: [] },
      {
        id: 'input1',
        type: 'Input',
        props: { name: 'name', label: '姓名', placeholder: '请输入姓名' },
        children: []
      },
      {
        id: 'select1',
        type: 'Select',
        props: {
          name: 'dept',
          label: '部门',
          placeholder: '请选择部门',
          options: [
            { label: '研发部', value: '研发部' },
            { label: '市场部', value: '市场部' }
          ]
        },
        children: []
      },
      {
        id: 'btn1',
        type: 'Button',
        props: {
          text: '提交登记',
          type: 'primary',
          action: { type: 'request', method: 'POST', url: '/api/demo/submit', includeForm: true, text: '' }
        },
        children: []
      }
    ]
  }

  const imported = await fetch(`${api}/pages/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: { name: `嵌入接入测试页-${Date.now()}` }, schema, datasources: [] })
  }).then((r) => r.json())
  embedPageId = imported.data?.id || ''
  ok('测试页创建成功', Boolean(embedPageId), imported.message || embedPageId)

  const draftImported = await fetch(`${api}/pages/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: { name: `未发布嵌入测试-${Date.now()}` },
      schema: { id: 'root', type: 'Page', children: [{ id: 't', type: 'Title', props: { text: '草稿' }, children: [] }] }
    })
  }).then((r) => r.json())
  draftPageId = draftImported.data?.id || ''

  const published = await fetch(`${api}/pages/${embedPageId}/publish`, { method: 'POST' }).then((r) => r.json())
  ok('测试页发布成功', published.success === true, published.message || '')

  // ---------- 1. 响应头：普通页禁止被引用，embed 页放行 ----------
  const plainHead = await fetch(`${base}/`)
  const embedHead = await fetch(`${base}/?embed=1`)
  const plainXfo = plainHead.headers.get('x-frame-options') || ''
  const embedXfo = embedHead.headers.get('x-frame-options') || ''
  const embedCsp = embedHead.headers.get('content-security-policy') || ''
  ok('普通页面禁止第三方 iframe 引用（防点击劫持）', /SAMEORIGIN/i.test(plainXfo), `X-Frame-Options=${plainXfo}`)
  ok(
    'embed 页面改用 CSP 放行嵌入',
    embedXfo === '' && /frame-ancestors/.test(embedCsp),
    `X-Frame-Options="${embedXfo}" CSP="${embedCsp}"`
  )

  // ---------- 2. 浏览器起 ----------
  browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  page.on('pageerror', (err) => results.push(`[pageerror] ${err.message}`))

  const prefill = { name: '李四', dept: '市场部', ghost: '页面里没有这个字段' }
  const embedUrl = `${base}/?embed=1&prefill=${encodePrefill(prefill)}#/view/${embedPageId}`

  // ---------- 3. 嵌入模式外观 + 预填 ----------
  await page.goto(embedUrl, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.viewer--embed .lc-form-field input', { timeout: 10000 })
  const look = await page.evaluate(() => ({
    bar: document.querySelectorAll('.viewer__bar').length,
    embedClass: document.documentElement.classList.contains('lc-embed'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    cardShadow: getComputedStyle(document.querySelector('.viewer__card')).boxShadow,
    nameValue: document.querySelector('.lc-form-field input')?.value || '',
    footer: document.body.innerText.includes('Powered by LowCode Studio')
  }))
  ok('嵌入模式不渲染平台顶栏', look.bar === 0)
  ok('嵌入模式标记与透明背景生效', look.embedClass && look.bodyBg === 'rgba(0, 0, 0, 0)', `bg=${look.bodyBg}`)
  ok('嵌入模式去掉卡片阴影与平台署名', look.cardShadow === 'none' && look.footer === false, `shadow=${look.cardShadow}`)
  ok('URL 预填生效（姓名=李四）', look.nameValue === '李四', `value=${look.nameValue}`)

  // 对照：非嵌入访问仍带平台外壳
  await page.goto(`${base}/#/view/${embedPageId}`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.viewer__bar', { timeout: 10000 })
  const plainBar = await page.evaluate(() => ({
    bar: document.querySelectorAll('.viewer__bar').length,
    embedClass: document.documentElement.classList.contains('lc-embed')
  }))
  ok('普通访问保留平台外壳', plainBar.bar === 1 && plainBar.embedClass === false)

  // ---------- 4. 宿主页面：iframe + postMessage ----------
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((url) => {
    window.__msgs = []
    window.addEventListener('message', (event) => {
      const data = event.data
      if (!data || data.source !== 'lowcode-studio') return
      window.__msgs.push(data)
      // 宿主按文档约定同步高度
      if (data.type === 'lc:resize') {
        const frame = document.getElementById('lc-frame')
        if (frame) frame.style.height = `${data.height}px`
      }
    })
    const frame = document.createElement('iframe')
    frame.id = 'lc-frame'
    frame.src = url
    frame.style.cssText = 'width: 100%; height: 300px; border: 0;'
    document.body.appendChild(frame)
  }, embedUrl)

  await page.waitForFunction(() => (window.__msgs || []).some((m) => m.type === 'lc:ready'), { timeout: 15000 })
  const bridge = await page.evaluate(() => {
    const types = window.__msgs.map((m) => m.type)
    const ready = window.__msgs.find((m) => m.type === 'lc:ready') || {}
    const resize = [...window.__msgs].reverse().find((m) => m.type === 'lc:resize') || {}
    return {
      types,
      readyPrefill: ready.prefill || [],
      resizeHeight: resize.height || 0,
      frameHeight: parseInt(document.getElementById('lc-frame').style.height, 10) || 0
    }
  })
  ok(
    '握手消息齐全（hello / ready / resize）',
    ['lc:hello', 'lc:ready', 'lc:resize'].every((type) => bridge.types.includes(type)),
    bridge.types.join(',')
  )
  ok('lc:ready 回报实际生效的预填字段', bridge.readyPrefill.includes('name') && !bridge.readyPrefill.includes('ghost'), bridge.readyPrefill.join(','))

  const frame = await (await page.$('#lc-frame')).contentFrame()
  const contentHeight = await frame.evaluate(() => Math.ceil(document.querySelector('.viewer').getBoundingClientRect().height))
  ok(
    'lc:resize 高度与页面内容一致且宿主已同步',
    bridge.resizeHeight > 60 && Math.abs(bridge.resizeHeight - contentHeight) <= 2 && bridge.frameHeight === bridge.resizeHeight,
    `reported=${bridge.resizeHeight} content=${contentHeight} frame=${bridge.frameHeight}`
  )

  // ---------- 5. 表单提交 → lc:submit ----------
  await frame.evaluate(() => {
    const input = document.querySelector('.lc-form-field input')
    input.value = '张嵌入'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await wait(200)
  await frame.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('提交登记'))
    btn?.click()
  })
  await page.waitForFunction(() => (window.__msgs || []).some((m) => m.type === 'lc:submit'), { timeout: 10000 })
  const submitMsg = await page.evaluate(() => window.__msgs.find((m) => m.type === 'lc:submit'))
  ok(
    '提交后宿主收到 lc:submit 且带表单数据',
    submitMsg.ok === true && submitMsg.data?.name === '张嵌入' && submitMsg.response?.data?.received?.name === '张嵌入',
    JSON.stringify({ ok: submitMsg.ok, data: submitMsg.data, received: submitMsg.response?.data?.received })
  )

  // ---------- 6. 未发布页面：lc:error ----------
  await page.evaluate((url) => {
    const frame = document.createElement('iframe')
    frame.id = 'lc-frame2'
    frame.src = url
    frame.style.cssText = 'width: 100%; height: 300px; border: 0;'
    document.body.appendChild(frame)
  }, `${base}/?embed=1#/view/${draftPageId}`)
  await page.waitForFunction(() => (window.__msgs || []).some((m) => m.type === 'lc:error'), { timeout: 10000 })
  const errMsg = await page.evaluate(() => window.__msgs.find((m) => m.type === 'lc:error'))
  ok('未发布页面嵌入时回传 lc:error', /尚未发布/.test(errMsg.message || ''), `${errMsg.code} ${errMsg.message}`)

  // ---------- 7. 接入指南页与代码生成器 ----------
  await page.goto(`${base}/#/integration`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.doc__h1', { timeout: 10000 })
  await wait(800)
  const doc = await page.evaluate(() => {
    const preList = [...document.querySelectorAll('pre.doc__code')].map((el) => el.textContent)
    return {
      title: document.querySelector('.doc__h1')?.textContent || '',
      sections: [...document.querySelectorAll('.doc__section')].map((el) => el.id),
      navCount: document.querySelectorAll('.doc__nav-item').length,
      iframeCode: preList.find((text) => text.includes('<iframe')) || '',
      hasHooks: preList.some((text) => text.includes('lc:resize')),
      previewFrame: Boolean(document.querySelector('.gen__frame'))
    }
  })
  ok(
    '接入指南页结构完整（7 小节 + 目录）',
    doc.title.includes('接入') && doc.sections.length >= 7 && doc.navCount >= 7,
    `sections=${doc.sections.join(',')}`
  )
  ok(
    '生成器产出可用 iframe 代码',
    doc.iframeCode.includes('?embed=1') && doc.iframeCode.includes('#/view/') && doc.iframeCode.includes('id="lc-frame"'),
    doc.iframeCode.split('\n')[1] || ''
  )
  ok('默认勾选自动高度时附带 lc:resize 监听代码', doc.hasHooks && doc.previewFrame)

  // 生成器里的预览 iframe 必须是嵌入模式（不带平台外壳）
  const genFrameEl = await page.$('.gen__frame')
  if (genFrameEl) {
    const genFrame = await genFrameEl.contentFrame()
    await wait(600)
    const gen = await genFrame.evaluate(() => ({
      embed: document.documentElement.classList.contains('lc-embed'),
      bar: document.querySelectorAll('.viewer__bar').length
    }))
    ok('生成器预览本身就是嵌入模式', gen.embed === true && gen.bar === 0, JSON.stringify(gen))
  } else {
    ok('生成器预览本身就是嵌入模式', false, '没有找到预览 iframe')
  }
} catch (err) {
  results.push(`FAIL  测试执行异常  -- ${err.message}`)
} finally {
  try {
    if (embedPageId) await fetch(`${api}/pages/${embedPageId}`, { method: 'DELETE' })
    if (draftPageId) await fetch(`${api}/pages/${draftPageId}`, { method: 'DELETE' })
  } catch {
    /* 清理失败不影响测试结论 */
  }
  if (browser) await browser.close()
}

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`)
process.exit(failed ? 1 : 0)
