/**
 * 设计规范与技术文档回归测试
 * ------------------------------------------------------------
 * 功能：保证「文档说的」与「代码做的」不漂移——
 *   1. docs/ 十篇文档存在且非空，关键内容（路由路径 / 环境变量 / 组件类型）与代码一致；
 *   2. page-schema.md 的属性附录由 gen-props-doc.mjs 生成且不过期（重新生成后无 diff）；
 *   3. 设计规范页 /#/spec 正常渲染，色卡展示值 == CSS 变量真实值（活文档契约）；
 *   4. 设计令牌禁令生效：tokens.css 之外的业务样式不允许出现硬编码色值；
 *   5. 列表页提供「设计规范」入口。
 * 业务：规范和文档最容易腐烂——改了代码忘改文档。把「文档与代码一致」做成测试后，
 *      腐烂会直接红掉，而不是上线后被人发现。
 */
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { globSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('D:/www/factory-dashboard/package.json')
const puppeteer = require('puppeteer-core')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const BASE = 'http://localhost:3001'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 统一的断言收集器：任何 FAIL 不中断流程，最后汇总退出码 */
const results = []
function ok(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? `  → ${detail}` : ''}`)
}

// ---------------------------------------------------------------- 1. 文档存在性与内容一致性
const DOC_FILES = [
  'README.md', 'architecture.md', 'api.md', 'page-schema.md', 'component-development.md',
  'integration.md', 'deployment.md', 'testing.md', 'code-style.md', 'design-system.md'
]
const docs = {}
for (const f of DOC_FILES) {
  try {
    const content = await readFile(path.join(ROOT, 'docs', f), 'utf8')
    docs[f] = content
    ok(`docs/${f} 存在且非空`, content.trim().length > 300)
  } catch {
    ok(`docs/${f} 存在且非空`, false, '文件缺失')
    docs[f] = ''
  }
}

// api.md 必须覆盖全部接口路径（与 server/src/routes 实际定义对齐）
const ROUTES = [
  'GET /pages', 'POST /pages', 'POST /pages/import', 'GET /pages/:id', 'PUT /pages/:id',
  'DELETE /pages/:id', 'POST /pages/:id/duplicate', 'POST /pages/:id/publish', 'POST /pages/:id/unpublish',
  'GET /health', 'GET /stats', 'GET /published/:id', 'POST /demo/submit', 'GET /templates', 'GET /templates/:id'
]
const missingRoutes = ROUTES.filter((r) => !docs['api.md'].includes(r))
ok('api.md 覆盖全部 15 个接口路径', missingRoutes.length === 0, `缺失：${missingRoutes.join(', ')}`)

// deployment.md 必须覆盖全部环境变量（与 server/src/config.js 对齐）
const ENV_VARS = ['PORT', 'HOST', 'LC_DATA_DIR', 'LC_MAX_NODES', 'CORS_ORIGINS', 'EMBED_ANCESTORS', 'LC_LOG_LEVEL']
const missingEnv = ENV_VARS.filter((v) => !docs['deployment.md'].includes(v))
ok('deployment.md 覆盖全部环境变量', missingEnv.length === 0, `缺失：${missingEnv.join(', ')}`)

// ---------------------------------------------------------------- 2. 属性附录不过期
const { execSync } = await import('node:child_process')
const before = await readFile(path.join(ROOT, 'docs', 'page-schema.md'), 'utf8')
execSync('node scripts/gen-props-doc.mjs', { cwd: ROOT, stdio: 'pipe' })
const after = await readFile(path.join(ROOT, 'docs', 'page-schema.md'), 'utf8')
ok('page-schema.md 属性附录与注册表同步（gen:props 幂等）', before === after, '附录过期：请执行 npm run gen:props')

// ---------------------------------------------------------------- 3. 设计令牌禁令：业务样式无硬编码色值
const ALLOWED_HEX = new Set([path.join(ROOT, 'web', 'src', 'styles', 'tokens.css')])
const styleTargets = globSync(path.join(ROOT, 'web', 'src', '**', '*.css').replaceAll('\\', '/'), {})
  .concat(globSync(path.join(ROOT, 'web', 'src', '**', '*.vue').replaceAll('\\', '/'), {}))
const offenders = []
for (const file of styleTargets) {
  if (ALLOWED_HEX.has(file)) continue
  const content = await readFile(file, 'utf8')
  // vue 文件只检查 <style> 块；css 文件全量检查
  const blocks = file.endsWith('.vue')
    ? [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
    : [content]
  for (const block of blocks) {
    const hits = block.match(/#[0-9a-fA-F]{3,8}\b/g)
    if (hits) offenders.push(`${path.relative(ROOT, file)}: ${hits.join(' ')}`)
  }
}
ok('业务样式无硬编码色值（仅 tokens.css 允许）', offenders.length === 0, offenders.slice(0, 5).join(' | '))

// tokens.css 里必须定义全部被引用的 --lc-* 令牌
const tokensCss = await readFile(path.join(ROOT, 'web', 'src', 'styles', 'tokens.css'), 'utf8')
const used = new Set()
for (const file of styleTargets) {
  const content = await readFile(file, 'utf8')
  for (const m of content.matchAll(/var\((--lc-[a-z0-9-]+)\)/g)) used.add(m[1])
}
const defined = new Set([...tokensCss.matchAll(/(--lc-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
const undefinedTokens = [...used].filter((t) => !defined.has(t))
ok(`被引用的 ${used.size} 个 --lc-* 令牌全部已在 tokens.css 定义`, undefinedTokens.length === 0, `未定义：${undefinedTokens.join(', ')}`)

// ---------------------------------------------------------------- 4. 浏览器验证规范页（活文档契约）
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (err) => pageErrors.push(err.message))
await page.setViewport({ width: 1440, height: 900 })

await page.goto(`${BASE}/#/spec`, { waitUntil: 'networkidle2' })
await wait(1200)

const specInfo = await page.evaluate(() => ({
  sections: document.querySelectorAll('.spec__section').length,
  swatches: document.querySelectorAll('.spec__swatch').length,
  emptyValues: [...document.querySelectorAll('.spec__swatch-value')].filter((el) => el.textContent.trim() === '').length,
  undefinedTokens: [...document.querySelectorAll('.spec__swatch-value')].filter((el) => el.textContent.includes('未定义')).length
}))
ok('设计规范页渲染 9 个章节', specInfo.sections === 9, `实际 ${specInfo.sections}`)
ok('色卡渲染完整（品牌 9 + 中性 12）', specInfo.swatches === 21, `实际 ${specInfo.swatches}`)
ok('色卡值全部来自真实 CSS 变量', specInfo.emptyValues === 0 && specInfo.undefinedTokens === 0)

// 抽查 3 个关键令牌：页面展示值 == getComputedStyle 真实值
const tokenCheck = await page.evaluate(() => {
  const styles = getComputedStyle(document.documentElement)
  const check = (token) => {
    const real = styles.getPropertyValue(token).trim()
    const swatch = [...document.querySelectorAll('.spec__swatch')].find((el) =>
      el.querySelector('.spec__swatch-name')?.textContent === token.replace('--lc-', '')
    )
    return { token, real, shown: swatch?.querySelector('.spec__swatch-value')?.textContent.trim() }
  }
  return [check('--lc-brand-500'), check('--lc-gray-200'), check('--lc-gray-900')]
})
const tokenMismatch = tokenCheck.filter((t) => t.real !== t.shown)
ok('规范页展示值与 CSS 变量一致（活文档契约）', tokenMismatch.length === 0, JSON.stringify(tokenMismatch.filter((t) => t.real !== t.shown)))

// 列表页入口
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle2' })
await wait(1000)
const hasEntry = await page.evaluate(() =>
  [...document.querySelectorAll('.app-header button')].some((b) => b.textContent.includes('设计规范'))
)
ok('列表页顶栏提供「设计规范」入口', hasEntry)

// 视觉留档
await page.goto(`${BASE}/#/spec`, { waitUntil: 'networkidle2' })
await wait(1000)
await page.screenshot({ path: path.join(__dirname, 'spec-page.png'), fullPage: false })
await browser.close()

ok('无页面运行时错误', pageErrors.length === 0, pageErrors.join(' | '))

// ---------------------------------------------------------------- 汇总
const failed = results.filter((r) => !r.pass)
console.log(`\n共 ${results.length} 项，PASS ${results.length - failed.length}，FAIL ${failed.length}`)
if (failed.length) process.exit(1)
