/**
 * 接口层
 * ------------------------------------------------------------
 * 功能：统一封装 fetch —— 超时控制、错误归一化、requestId 透传。
 * 业务：线上最容易踩的两个坑：
 *   1. 后端没起来时 fetch 会一直挂起，页面看起来「打不开」——这里 15s 超时并给出明确文案；
 *   2. 各类错误（网络/校验/冲突/服务异常）在前端要有可区分的 code，
 *      这样 UI 才能针对「并发冲突」给出覆盖还是刷新的选择，而不是一句无脑报错。
 */
const BASE = '/api'
const DEFAULT_TIMEOUT = 15000

export class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = meta.status || 0
    this.code = meta.code || 'UNKNOWN'
    this.requestId = meta.requestId || ''
  }
}

async function request(url, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, body, headers, ...rest } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let response
  try {
    response = await fetch(BASE + url, {
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      signal: controller.signal,
      ...rest,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch (err) {
    // AbortError：超时；TypeError：连接失败（后端未启动 / 端口不通）
    if (err.name === 'AbortError') {
      throw new ApiError(`请求超时（${timeout / 1000}s），请检查后端服务是否正常运行`, { code: 'TIMEOUT' })
    }
    throw new ApiError('无法连接后端服务，请确认 Node 服务已启动（默认 3001 端口）', { code: 'NETWORK' })
  } finally {
    clearTimeout(timer)
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    // 后端异常时可能返回 HTML（例如代理错误页），这里不能直接抛解析异常
    throw new ApiError(`服务返回了非 JSON 内容（HTTP ${response.status}），请查看后端日志`, {
      status: response.status,
      code: 'BAD_RESPONSE'
    })
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.message || `请求失败（HTTP ${response.status}）`, {
      status: response.status,
      code: payload?.code,
      requestId: payload?.requestId
    })
  }
  return payload.data
}

export const pageApi = {
  list: (keyword = '') => request(`/pages?keyword=${encodeURIComponent(keyword)}`),
  get: (id) => request(`/pages/${id}`),

  /** 新建页面：名称必填；传 templateId 则按模板初始化内容，不传为空白页 */
  create: (body) => request('/pages', { method: 'POST', body }),

  /**
   * 导入页面代码
   * 业务：dryRun=true 时只做校验并返回摘要（组件数/数据源数），不写库；
   *      正式导入会创建为新的草稿页面。导入文件可能较大，超时放宽到 30s。
   */
  importPage: (body) => request('/pages/import', { method: 'POST', body, timeout: 30000 }),

  /** 保存页面：带上 revision 做乐观锁，服务端发现版本落后会返回 409 REVISION_CONFLICT */
  update: (id, body) => request(`/pages/${id}`, { method: 'PUT', body }),

  remove: (id) => request(`/pages/${id}`, { method: 'DELETE' }),
  duplicate: (id) => request(`/pages/${id}/duplicate`, { method: 'POST' }),
  publish: (id) => request(`/pages/${id}/publish`, { method: 'POST' }),
  unpublish: (id) => request(`/pages/${id}/unpublish`, { method: 'POST' }),

  /** C 端读取已发布快照 */
  published: (id) => request(`/published/${id}`),
  stats: () => request('/stats'),
  health: () => request('/health', { timeout: 5000 })
}

export const templateApi = {
  /**
   * 模板列表（不含完整 schema，只含结构缩略与改造指引）
   * 业务：新建页面时调用。失败不阻断流程——调用方应退化为「空白页面」，
   *      绝不能因为模板接口挂了就让用户无法建页面。
   */
  list: () => request('/templates', { timeout: 8000 }),

  /** 取单个模板的完整内容（schema + 数据源），供设计器「套用模板」使用 */
  get: (id) => request(`/templates/${id}`)
}
