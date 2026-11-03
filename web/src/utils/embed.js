/**
 * 嵌入接入（iframe）支持
 * ------------------------------------------------------------
 * 功能：
 *   1. 识别嵌入模式与 URL 传参（embed / prefill）；
 *   2. 把 URL 参数安全地预填到页面表单（只覆盖 schema 里真实存在的字段）；
 *   3. 与父页面通信：lc:ready（已就绪）、lc:resize（内容高度变化）、lc:submit（表单提交结果）；
 *   4. 监听内容尺寸变化，向父页面持续上报高度，父页面据此调整 iframe 高度，避免出现内层滚动条。
 * 业务：接入其它系统最常见的三种诉求是「嵌进去别带我们平台的壳」「带上当前用户信息」
 *      「提交完让父系统知道」。这三件事必须在运行态真实实现，否则接入文档就是空话。
 *
 * 注意（hash 路由的坑）：本平台用 hash 路由，`#/view/:id?embed=1` 里的 query 在 location.hash 内，
 *      location.search 读不到；而服务端只能根据文档 URL（# 之前）决定是否允许 iframe 引用。
 *      因此约定：
 *        - 影响服务端响应头的参数放在 # 之前：/?embed=1#/view/:id
 *        - 运行态参数既支持 # 前，也支持 # 后，两种写法都能识别，方便手工拼接。
 */

/** 消息来源标识：父页面据此过滤掉其它 iframe / 浏览器插件的 message */
export const BRIDGE_SOURCE = 'lowcode-studio'

/** 解析「#之前」与「#之后」的 query，后者覆盖前者（以 hash 内为准，更贴近用户直接改地址的场景） */
export function readUrlParams(hashQuery = {}) {
  const search = new URLSearchParams(window.location.search)
  const params = {}
  search.forEach((value, key) => {
    params[key] = value
  })
  Object.entries(hashQuery || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params[key] = value
  })
  return params
}

/** 是否嵌入模式：地址里带 embed=1（# 前或 # 后都算） */
export function isEmbedMode(hashQuery = {}) {
  return readUrlParams(hashQuery).embed === '1'
}

/**
 * 解码预填参数。
 * 约定格式：JSON 的 base64url（去掉 = 补位、+ 换 -、/ 换 _），避免中文与 & 被 URL 拆坏。
 * 兼容直接传 JSON 字符串，方便调试时手写。
 */
export function decodePrefill(raw) {
  if (!raw || typeof raw !== 'string') return null
  const text = raw.trim()
  if (text.startsWith('{')) {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  try {
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const binary = window.atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

/** 把对象编码成 base64url（接入指南里给父系统复制的算法，与 decodePrefill 对称） */
export function encodePrefill(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj || {}))
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** 收集 schema 里的表单字段类型，预填时按类型做转换（数字控件不能塞字符串） */
function collectFieldTypes(schema) {
  const types = {}
  const walk = (node) => {
    ;(node.children || []).forEach((child) => {
      const name = child.props?.name
      if (name && typeof name === 'string') types[name] = child.type
      walk(child)
    })
  }
  walk(schema || {})
  return types
}

const NUMERIC_TYPES = ['Number', 'Slider', 'Rate']

/**
 * 应用预填值
 * ------------------------------------------------------------
 * 只覆盖页面里真实存在的字段：父系统传了一堆用户属性过来时，多余字段直接忽略，
 * 避免把无关数据塞进提交体；类型按控件类型转换，否则数字输入框会拿到字符串而报错。
 * 返回 { applied, skipped } 便于排查「参数传了但没生效」。
 */
export function applyPrefill(formModel, prefill, schema) {
  const applied = []
  const skipped = []
  if (!prefill || typeof prefill !== 'object' || Array.isArray(prefill)) return { applied, skipped }

  const types = collectFieldTypes(schema)
  Object.entries(prefill).forEach(([key, raw]) => {
    if (!(key in formModel) || raw === undefined) {
      skipped.push(key)
      return
    }
    const type = types[key]
    if (type === 'Checkbox') {
      formModel[key] = Array.isArray(raw) ? raw.map(String) : [String(raw)]
    } else if (raw === null || raw === '') {
      formModel[key] = type === 'Checkbox' ? [] : ''
    } else if (NUMERIC_TYPES.includes(type)) {
      const num = Number(raw)
      formModel[key] = Number.isFinite(num) ? num : ''
    } else if (type === 'Switch') {
      formModel[key] = raw === true || raw === 'true' || raw === 1 || raw === '1'
    } else if (Array.isArray(raw) || typeof raw === 'object') {
      // 文本类字段拿到对象值属于传参错误，跳过而不是塞 "[object Object]"
      skipped.push(key)
      return
    } else {
      formModel[key] = String(raw)
    }
    applied.push(key)
  })
  return { applied, skipped }
}

/** 向父页面发消息；不在 iframe 里时静默跳过，设计器/预览环境不受影响 */
export function postToHost(type, payload = {}) {
  if (window.parent === window) return false
  try {
    // 目标来源用 *：嵌入方可能挂在任意域名下，且这里只发非敏感的运行态信息
    window.parent.postMessage({ source: BRIDGE_SOURCE, type, ...payload }, '*')
    return true
  } catch (err) {
    // 常见原因：payload 里带了 Vue 响应式代理 / 函数，无法结构化克隆。
    // 这里必须留下痕迹，否则接入方只能看到「消息没来」而无从排查。
    console.warn(`[embed] 消息 ${type} 发送失败：`, err)
    return false
  }
}

/**
 * 高度上报
 * ------------------------------------------------------------
 * 用 ResizeObserver 盯住页面容器，高度变化就通知父页面。
 * 业务：表单展开、下拉/日期面板、表格数据加载都会改变高度；只上报一次的话，
 *      父页面里要么留大片空白，要么出现内层滚动条，体验很差。
 */
export function startHeightReporter(getElement, { throttle = 120 } = {}) {
  let lastHeight = 0
  let timer = null
  let observer = null

  const measure = () => {
    const el = typeof getElement === 'function' ? getElement() : getElement
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(Math.ceil(rect.height), Math.ceil(el.scrollHeight))
  }

  const flush = () => {
    const height = measure()
    if (height > 0 && Math.abs(height - lastHeight) >= 1) {
      lastHeight = height
      postToHost('lc:resize', { height })
    }
  }

  const schedule = () => {
    if (timer) return
    timer = window.setTimeout(() => {
      timer = null
      flush()
    }, throttle)
  }

  const el = typeof getElement === 'function' ? getElement() : getElement
  if (el && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule)
    observer.observe(el)
    // 子元素高度变化（例如表格数据到达）也要重算，观察 document.body 作为补充
    if (document.body) observer.observe(document.body)
  }
  window.addEventListener('resize', schedule)
  // 首帧与图片加载完成后各补一次，保证父页面一开始就拿到正确高度
  window.setTimeout(flush, 0)
  window.addEventListener('load', flush)

  return {
    flush,
    stop() {
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('load', flush)
      if (timer) window.clearTimeout(timer)
    }
  }
}
