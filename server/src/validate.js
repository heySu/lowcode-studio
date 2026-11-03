/**
 * 页面数据校验
 * ------------------------------------------------------------
 * 功能：对「保存页面」与「发布页面」的请求体做结构与业务校验，并返回清洗后的数据。
 * 业务：低代码平台的 schema 是用户通过拖拽生成的，属于不可信输入。
 *      如果直接把畸形 schema 写库，运行态渲染就会出现白屏、死循环、内存爆掉。
 *      所以这里做三件事：
 *        1. 结构校验：必须是 Page 根节点，节点/数据源字段类型正确；
 *        2. 业务边界：节点数、嵌套深度、数据源数量、名称长度都有上限；
 *        3. 洁净输出：只保留已知字段，避免前端塞入任意键污染存储。
 */
import { config } from './config.js'
import { invalid } from './errors.js'

/** 与 web/src/registry/index.js 的组件类型保持一致；新增组件需同步这里 */
export const ALLOWED_TYPES = new Set([
  'Container',
  'Card',
  'Divider',
  'Title',
  'Text',
  'Button',
  'Image',
  'Alert',
  'Tag',
  'Input',
  'Textarea',
  'Number',
  'Select',
  'Radio',
  'Checkbox',
  'Switch',
  'DatePicker',
  'Slider',
  'Rate',
  'Table',
  'Statistic',
  'Progress'
])

/** 允许包含子节点的容器类型 */
export const CONTAINER_TYPES = new Set(['Container', 'Card'])

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * 递归校验组件树
 * @returns {{ nodes: number }}
 */
export function validateSchema(schema, { requireContent = false } = {}) {
  if (!isPlainObject(schema)) throw invalid('页面结构（schema）缺失或格式错误')
  if (schema.type !== 'Page') throw invalid('schema 根节点必须是 Page 类型')
  if (schema.children !== undefined && !Array.isArray(schema.children)) {
    throw invalid('schema.children 必须是数组')
  }

  const seenIds = new Set(['root'])
  let count = 0

  const walk = (node, depth, path) => {
    if (!isPlainObject(node)) throw invalid(`组件结构异常：${path}`)
    if (depth > config.limits.maxDepth) {
      throw invalid(`组件嵌套超过 ${config.limits.maxDepth} 层，请拆分页面或精简容器层级`)
    }

    // 节点标识：用于设计器选中、拖拽定位，必须唯一，否则撤销/选中会串味
    if (typeof node.id !== 'string' || !node.id) throw invalid(`组件缺少 id：${path}`)
    if (seenIds.has(node.id)) throw invalid(`组件 id 重复：${node.id}`)
    seenIds.add(node.id)

    // 组件类型白名单：防止运行态拿到前端没有实现的类型而渲染成空白块
    if (!ALLOWED_TYPES.has(node.type)) throw invalid(`不支持的组件类型：${node.type}`)
    if (node.props !== undefined && !isPlainObject(node.props)) throw invalid(`组件 ${node.type} 的 props 必须是对象`)
    if (node.style !== undefined && !isPlainObject(node.style)) throw invalid(`组件 ${node.type} 的 style 必须是对象`)

    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) throw invalid(`组件 ${node.type} 的 children 必须是数组`)
      if (node.children.length && !CONTAINER_TYPES.has(node.type)) {
        throw invalid(`组件 ${node.type} 不支持子组件`)
      }
    }

    count += 1
    if (count > config.limits.maxNodes) {
      throw invalid(`单页组件数量超过上限（${config.limits.maxNodes} 个）`)
    }

    ;(node.children || []).forEach((child, index) => walk(child, depth + 1, `${path}/${node.type}[${index}]`))
  }

  ;(schema.children || []).forEach((child, index) => walk(child, 1, `root[${index}]`))

  if (requireContent && count === 0) throw invalid('页面还没有任何组件，无法发布')

  return { nodes: count }
}

/** 数据源校验：名称会被当作模板变量使用，因此限制为合法标识符 */
function sanitizeDatasources(list) {
  if (list === undefined) return undefined
  if (!Array.isArray(list)) throw invalid('数据源必须是数组')
  if (list.length > config.limits.maxDatasources) {
    throw invalid(`数据源数量超过上限（${config.limits.maxDatasources} 个）`)
  }

  const names = new Set()
  return list.map((item, index) => {
    if (!isPlainObject(item)) throw invalid(`第 ${index + 1} 个数据源格式错误`)

    const name = String(item.name || '').trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(name)) {
      throw invalid(`数据源名称「${name || '空'}」不合法：需以字母或下划线开头，仅含字母数字下划线`)
    }
    if (names.has(name)) throw invalid(`数据源名称重复：${name}`)
    names.add(name)

    const type = item.type === 'api' ? 'api' : 'static'
    const payload = {
      id: typeof item.id === 'string' && item.id ? item.id : `ds_${Date.now().toString(36)}_${index}`,
      name,
      type,
      method: item.method === 'POST' ? 'POST' : 'GET',
      url: typeof item.url === 'string' ? item.url.slice(0, 500) : '',
      json: typeof item.json === 'string' ? item.json : '[]'
    }

    // 静态 JSON 必须能被解析，否则运行态表格必然空数据，属于「保存即坏」
    if (type === 'static') {
      try {
        JSON.parse(payload.json)
      } catch {
        throw invalid(`数据源「${name}」的 JSON 格式有误，请修正后再保存`)
      }
    }
    if (type === 'api' && !payload.url) {
      throw invalid(`数据源「${name}」选择接口类型时必须填写 URL`)
    }
    return payload
  })
}

/**
 * 校验并清洗「保存页面」请求体
 * @param {object} body 请求体
 * @param {{ partial?: boolean }} options partial=true 时允许只传部分字段（如只改名）
 */
export function validatePagePayload(body, { partial = false } = {}) {
  if (!isPlainObject(body)) throw invalid('请求体格式错误')

  const result = {}

  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? '').trim()
    if (!name) throw invalid('页面名称不能为空')
    if (name.length > config.limits.maxNameLength) {
      throw invalid(`页面名称不能超过 ${config.limits.maxNameLength} 个字符`)
    }
    result.name = name
  }

  if (body.description !== undefined) {
    const desc = String(body.description ?? '').trim()
    if (desc.length > config.limits.maxDescriptionLength) {
      throw invalid(`页面描述不能超过 ${config.limits.maxDescriptionLength} 个字符`)
    }
    result.description = desc
  }

  if (body.schema !== undefined) {
    // 先做体积拦截，避免超大 schema 进入递归校验消耗 CPU
    const bytes = Buffer.byteLength(JSON.stringify(body.schema))
    if (bytes > config.limits.maxSchemaBytes) {
      throw invalid(`页面结构过大（${Math.round(bytes / 1024)}KB），请拆分为多个页面`)
    }
    validateSchema(body.schema)
    result.schema = body.schema
  }

  if (body.datasources !== undefined) {
    result.datasources = sanitizeDatasources(body.datasources)
  }

  return result
}
