/**
 * 组件属性附录生成器
 * ------------------------------------------------------------
 * 用法：node scripts/gen-props-doc.mjs
 * 功能：在浏览器环境之外加载组件注册表，把每个组件的默认属性与可配置字段
 *      输出成 Markdown 表格，写入 docs/page-schema.md 的自动生成区。
 * 业务：文档里最容易腐烂的就是「属性清单」——组件改了文档忘改，新人照着旧文档开发必踩坑。
 *      所以附录不允许手写，只能由本脚本从注册表源码生成（单一事实来源），
 *      code-style 里也约定了改注册表后必须重新执行本脚本。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_SRC = path.join(__dirname, '..', 'web', 'src')
const OUT = path.join(__dirname, '..', 'docs', 'page-schema.md')
/** esbuild 装在 web/ 下（Vite 依赖），这里从 web 的依赖里解析 */
const { build } = createRequire(path.join(__dirname, '..', 'web', 'package.json'))('esbuild')

/** 把注册表打成可在 Node 里执行的临时模块（处理 @/ 别名与 ESM） */
async function loadRegistry() {
  const result = await build({
    entryPoints: [path.join(WEB_SRC, 'registry', 'index.js')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    alias: { '@': WEB_SRC },
    external: ['vue']
  })
  const tmpDir = path.join(__dirname, '..', 'web', '.tmp')
  const tmp = path.join(tmpDir, 'registry-bundle.cjs')
  await mkdir(tmpDir, { recursive: true })
  await writeFile(tmp, result.outputFiles[0].text)
  const mod = await import(pathToFileURL(tmp).href)
  return { registry: mod.registry, groups: mod.groups }
}

const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const fmtDefault = (v) => {
  if (v === undefined) return '—'
  if (typeof v === 'string') return v === '' ? "''" : `'${v}'`
  return JSON.stringify(v) ?? String(v)
}

const { registry, groups } = await loadRegistry()
const lines = []
lines.push('### 附录：组件属性表（自动生成）', '')
lines.push('> 由 `scripts/gen-props-doc.mjs` 从 `web/src/registry/index.js` 生成，请勿手改。')
lines.push('> 组件定义变化后执行 `npm run gen:props` 重新生成。', '')

for (const group of groups) {
  lines.push(`#### ${group.title}`, '')
  lines.push('| 组件 | type | 默认属性 | 可配置字段 |', '| --- | --- | --- | --- |')
  const seen = new Set()
  for (const item of group.items) {
    const type = typeof item === 'string' ? item : item.type
    if (seen.has(type + (item.label || ''))) continue
    seen.add(type + (item.label || ''))
    const meta = registry[type]
    if (!meta) continue
    const preset = typeof item === 'object' && item.presetProps ? `（预设：\`${esc(JSON.stringify(item.presetProps))}\`）` : ''
    const defaults = meta.props ? Object.entries(meta.props()).map(([k, v]) => `${k}=${fmtDefault(v)}`).join(', ') : '—'
    const fields = (meta.fields || []).map((f) => `${f.key}(${f.type})`).join(', ') || '—'
    lines.push(`| ${meta.label}${preset} | \`${type}\` | ${esc(defaults)} | ${esc(fields)} |`)
  }
  lines.push('')
}

const doc = await readFile(OUT, 'utf8')
const BEGIN = '<!-- PROPS-AUTO:BEGIN -->'
const END = '<!-- PROPS-AUTO:END -->'
const start = doc.indexOf(BEGIN)
const end = doc.indexOf(END)
const block = `${BEGIN}\n${lines.join('\n')}\n${END}`
if (start === -1 || end === -1) {
  await writeFile(OUT, `${doc.trimEnd()}\n\n${block}\n`)
  console.log('page-schema.md 无生成区，已在文末追加附录')
} else {
  await writeFile(OUT, doc.slice(0, start) + block + doc.slice(end + END.length))
  console.log('page-schema.md 附录已更新')
}
