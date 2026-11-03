/**
 * 页面运行时（数据源 + 表单模型）
 * ------------------------------------------------------------
 * 功能：
 *   1. buildFormModel：按 schema 收集所有表单字段的初始值，形成统一的 form 对象，
 *      供按钮「请求接口」提交、以及 {{form.x}} 插值使用；
 *   2. usePageRuntime：把页面数据源解析成 { 数据源名: 数组 } 的响应式映射。
 * 业务：数据源类型分两种——
 *   static：设计器里贴的 JSON，保存即生效，适合演示与静态内容；
 *   api：真实接口，运行态才请求，要求返回数组或 { data: [...] } 结构。
 *   真实项目接入时，api 数据源应挂在后端网关后面做鉴权，而不是让前端直连业务库。
 */
import { reactive, watch } from 'vue'
import { safeJsonParse } from '@/utils/format'

export const FORM_TYPES = ['Input', 'Textarea', 'Number', 'Select', 'Radio', 'Checkbox', 'Switch', 'DatePicker', 'Slider', 'Rate']

/** 按 schema 生成表单初始值 */
export function buildFormModel(schema) {
  const model = {}
  const walk = (node) => {
    ;(node.children || []).forEach((child) => {
      if (FORM_TYPES.includes(child.type) && child.props?.name) {
        const key = child.props.name
        model[key] = child.type === 'Checkbox' ? [] : child.props.defaultValue ?? ''
      }
      walk(child)
    })
  }
  walk(schema || {})
  return model
}

/**
 * 解析页面数据源：static 直接解析 JSON，api 走真实请求
 */
export function usePageRuntime(datasourcesRef) {
  const data = reactive({})

  async function refresh() {
    const list = datasourcesRef.value || []
    await Promise.all(
      list.map(async (ds) => {
        if (!ds.name) return
        if (ds.type === 'api' && ds.url) {
          try {
            const res = await fetch(ds.url, { method: ds.method || 'GET' })
            const json = await res.json()
            data[ds.name] = Array.isArray(json) ? json : json?.data ?? []
          } catch (err) {
            data[ds.name] = []
          }
        } else {
          data[ds.name] = safeJsonParse(ds.json, [])
        }
      })
    )
  }

  watch(datasourcesRef, refresh, { immediate: true, deep: true })

  return { data, refresh }
}
