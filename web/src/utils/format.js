/**
 * 通用格式化工具
 * ------------------------------------------------------------
 * 功能：模板插值、内联样式转换、表格列标题解析、JSON 容错解析、时间格式化。
 * 业务：插值（renderTemplate）是低代码页面「数据驱动」的最小实现——
 *      只做安全的属性取值（不支持函数调用/表达式），既满足展示需求，
 *      又不会像 eval 一样把 XSS 和死循环带进运行态。
 */

const TEMPLATE_RE = /\{\{\s*([^{}]+?)\s*\}\}/g

/** 按点号路径安全取值，任何一级为 null/undefined 都返回 undefined，不会抛错 */
function pick(path, ctx) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), ctx)
}

/**
 * 支持 {{form.name}} / {{employees.length}} 这类插值
 * 注意：出于安全考虑不做表达式求值，只做「路径取值」
 */
export function renderTemplate(value, ctx = {}) {
  if (typeof value !== 'string' || !value.includes('{{')) return value
  return value.replace(TEMPLATE_RE, (raw, expr) => {
    const val = pick(expr.trim(), ctx)
    if (val == null) return ''
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  })
}

const PX_KEYS = ['width', 'height', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'padding', 'borderRadius']

export function toCssStyle(style = {}) {
  const out = {}
  Object.entries(style || {}).forEach(([key, value]) => {
    if (value === '' || value == null) return
    if (PX_KEYS.includes(key)) {
      out[key] = typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? `${value}px` : value
    } else if (key === 'opacity') {
      out[key] = Number(value)
    } else if (key === 'flex') {
      out[key] = value
    } else {
      out[key] = value
    }
  })
  return out
}

/** "name:姓名, dept:部门" -> { name:'姓名', dept:'部门' } */
export function parseColumnTitles(text) {
  const map = {}
  String(text || '')
    .split(',')
    .forEach((pair) => {
      const [key, title] = pair.split(':')
      if (key && key.trim()) map[key.trim()] = (title || key).trim()
    })
  return map
}

export function safeJsonParse(text, fallback = []) {
  try {
    return JSON.parse(text)
  } catch (e) {
    return fallback
  }
}

export function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
