/**
 * 设计器状态（Pinia）
 * ------------------------------------------------------------
 * 功能：画布 schema 的唯一数据源，负责加载/保存、拖拽落点、节点增删改、撤销重做。
 * 业务约定：
 *   1. schema 根节点固定为 { id:'root', type:'Page' }，组件树只挂在其 children 上；
 *   2. 所有修改必须经过这里的 action，组件不要直接改树——
 *      只有走 action 才会触发历史快照（撤销/重做）与 dirty 标记（保存提示）；
 *   3. 拖拽协议：dragstart 时 startDrag({kind,new/move})，dragover 时 setDropTarget({id,pos})，
 *      drop 时 commitDrop 统一落树。pos 三种取值：inside（容器内）/ before / after；
 *   4. 保存走乐观锁：携带 revision，409 冲突由页面层弹窗让用户选择覆盖或放弃。
 */
import { defineStore } from 'pinia'
import { pageApi } from '@/api'
import { createNode as buildNode, getMeta } from '@/registry'
import { locate, insertNode, removeNode, containsNode, cloneWithNewIds, newId } from '@/utils/tree'

const emptySchema = () => ({ id: 'root', type: 'Page', props: {}, style: {}, children: [] })

let commitTimer = null

export const useDesignerStore = defineStore('designer', {
  state: () => ({
    loading: false,
    saving: false,
    pageId: '',
    name: '',
    description: '',
    status: 'draft',
    /** 服务端版本号，用于并发保存的乐观锁 */
    revision: 1,
    /** 已发布快照对应的版本号，用于提示「有未发布的修改」 */
    publishedRevision: null,
    datasources: [],
    schema: emptySchema(),
    selectedId: 'root',
    drag: null,
    dropTarget: null,
    history: [],
    historyIndex: -1,
    dirty: false,
    /**
     * 交互预览模式
     * 业务：设计态默认禁用所有控件交互（防止误输入、误触发），
     *      但用户需要「试一下下拉能不能选、日期能不能弹」来验证配置是否正确。
     *      打开本开关后画布恢复真实交互（等同运行态），此模式下不选中、不拖拽。
     */
    interactive: false
  }),

  getters: {
    selectedNode(state) {
      return locate(state.schema, state.selectedId)?.node || null
    },
    selectedMeta() {
      const node = this.selectedNode
      return node ? getMeta(node.type) : null
    },
    canUndo: (state) => state.historyIndex > 0,
    canRedo: (state) => state.historyIndex < state.history.length - 1
  },

  actions: {
    // ---------- 加载 / 保存 ----------
    async load(id) {
      this.loading = true
      try {
        const page = await pageApi.get(id)
        this.pageId = id
        this.name = page.name
        this.description = page.description || ''
        this.status = page.status || 'draft'
        this.revision = page.revision || 1
        this.publishedRevision = page.publishedRevision ?? null
        this.schema = page.schema?.type === 'Page' ? page.schema : emptySchema()
        if (!Array.isArray(this.schema.children)) this.schema.children = []
        this.datasources = Array.isArray(page.datasources) ? page.datasources : []
        this.selectedId = 'root'
        this.drag = null
        this.dropTarget = null
        this.history = [this.snapshot()]
        this.historyIndex = 0
        this.dirty = false
      } finally {
        this.loading = false
      }
    },

    snapshot() {
      return JSON.stringify({ schema: this.schema, datasources: this.datasources })
    },

    pushHistory() {
      const snap = this.snapshot()
      this.history = this.history.slice(0, this.historyIndex + 1)
      if (this.history[this.history.length - 1] === snap) return
      this.history.push(snap)
      if (this.history.length > 60) this.history.shift()
      this.historyIndex = this.history.length - 1
    },

    /**
     * 历史快照在「变更完成后」提交。
     * immediate=true 用于结构操作（拖拽/增删）；false 用于连续输入，400ms 内合并为一条。
     */
    commit(immediate = true) {
      if (immediate) {
        if (commitTimer) {
          clearTimeout(commitTimer)
          commitTimer = null
        }
        this.pushHistory()
        return
      }
      if (!commitTimer) {
        commitTimer = setTimeout(() => {
          commitTimer = null
          this.pushHistory()
        }, 400)
      }
    },

    flushCommit() {
      if (commitTimer) {
        clearTimeout(commitTimer)
        commitTimer = null
        this.pushHistory()
      }
    },

    applyState(snap) {
      const state = JSON.parse(snap)
      this.schema = state.schema
      this.datasources = state.datasources
      if (!locate(this.schema, this.selectedId)) this.selectedId = 'root'
      this.dirty = true
    },

    undo() {
      this.flushCommit()
      if (!this.canUndo) return
      this.historyIndex -= 1
      this.applyState(this.history[this.historyIndex])
    },

    redo() {
      this.flushCommit()
      if (!this.canRedo) return
      this.historyIndex += 1
      this.applyState(this.history[this.historyIndex])
    },

    /**
     * 保存到服务端。
     * 业务：带上 revision 做乐观锁；若返回 409（别人先保存了），
     *      调用方（Designer 页面）需要问用户「覆盖」还是「取消刷新」，
     *      所以这里不吞异常，原样抛给上层处理。
     */
    async save() {
      if (!this.pageId) return null
      this.flushCommit()
      this.saving = true
      try {
        const res = await pageApi.update(this.pageId, {
          name: this.name,
          description: this.description,
          schema: JSON.parse(JSON.stringify(this.schema)),
          datasources: JSON.parse(JSON.stringify(this.datasources)),
          revision: this.revision
        })
        this.revision = res.revision
        this.dirty = false
        return res
      } finally {
        this.saving = false
      }
    },

    /**
     * 强制覆盖：先把服务端最新版本号取回来，再用当前画布内容覆盖。
     * 业务：只应在用户明确确认「以我的版本为准」后调用，否则会丢失他人修改。
     */
    async forceOverwrite() {
      const latest = await pageApi.get(this.pageId)
      this.revision = latest.revision || 1
      return this.save()
    },

    // ---------- 选中 ----------
    select(id) {
      this.selectedId = id
    },

    /** 切换交互预览：进入时清空拖拽态，避免残留高亮 */
    setInteractive(value) {
      this.interactive = Boolean(value)
      this.drag = null
      this.dropTarget = null
    },

    // ---------- 拖拽 ----------
    startDrag(payload) {
      this.drag = payload
    },

    endDrag() {
      this.drag = null
      this.dropTarget = null
    },

    setDropTarget(target) {
      this.dropTarget = target
    },

    /**
     * 把任意落点归一化为 { parentId, index }。
     * 业务规则：inside 落到「非容器」上没有意义（叶子不渲染 children，
     * 塞进去组件会凭空消失）——自动改为插入到该节点的后面，保证任何
     * 落点组合都能得到符合直觉的结果，而不是静默丢组件。
     */
    resolveDrop(targetId, pos) {
      const loc = locate(this.schema, targetId)
      if (!loc) return null
      if (pos === 'inside' || targetId === 'root') {
        const isContainer = Boolean(loc.node.children) || loc.node.type === 'Page'
        if (isContainer || !loc.parent) {
          return { parentId: targetId, index: loc.node.children ? loc.node.children.length : 0 }
        }
        // 非容器：退化为「插到它后面」
        return { parentId: loc.parent.id, index: loc.index + 1 }
      }
      const parent = loc.parent
      if (!parent) return null
      return { parentId: parent.id, index: loc.index + (pos === 'after' ? 1 : 0) }
    },

    /**
     * 添加节点
     * @param {string} type 组件类型
     * @param {string} targetId 落点节点
     * @param {string} pos inside / before / after
     * @param {object} presetProps 预设属性（组件面板变体，如横向容器）
     */
    addNode(type, targetId = 'root', pos = 'inside', presetProps = undefined) {
      const drop = this.resolveDrop(targetId, pos)
      if (!drop) return null
      const node = buildNode(type, presetProps)
      if (!node) return null
      if (!insertNode(this.schema, drop.parentId, drop.index, node)) return null
      this.commit()
      this.selectedId = node.id
      this.dirty = true
      return node
    },

    moveNode(id, targetId, pos) {
      const src = locate(this.schema, id)
      if (!src || !src.parent) return { ok: false, message: '根节点不可移动' }
      if (containsNode(this.schema, id, targetId)) return { ok: false, message: '不能把容器拖进自己的子级' }
      const drop = this.resolveDrop(targetId, pos)
      if (!drop) return { ok: false, message: '无效的落点' }
      const sameParent = src.parent.id === drop.parentId
      const fromIndex = src.index
      removeNode(this.schema, id)
      let index = drop.index
      if (sameParent && fromIndex < index) index -= 1
      insertNode(this.schema, drop.parentId, index, src.node)
      this.commit()
      this.dirty = true
      return { ok: true }
    },

    commitDrop(target) {
      const drag = this.drag
      this.dropTarget = null
      this.drag = null
      if (!drag || !target) return null
      if (drag.kind === 'new') return this.addNode(drag.type, target.id, target.pos, drag.presetProps)
      if (drag.kind === 'move') return this.moveNode(drag.id, target.id, target.pos)
      return null
    },

    // ---------- 节点操作 ----------
    duplicateNode(id) {
      const loc = locate(this.schema, id)
      if (!loc || !loc.parent) return
      const copy = cloneWithNewIds(loc.node)
      copy.id = newId(copy.type.toLowerCase())
      insertNode(this.schema, loc.parent.id, loc.index + 1, copy)
      this.commit()
      this.selectedId = copy.id
      this.dirty = true
    },

    removeNodeById(id) {
      if (id === 'root') return
      const loc = locate(this.schema, id)
      if (!loc || !loc.parent) return
      removeNode(this.schema, id)
      this.commit()
      this.selectedId = loc.parent.id
      this.dirty = true
    },

    shiftNode(id, dir) {
      const loc = locate(this.schema, id)
      if (!loc || !loc.parent) return
      const list = loc.parent.children
      const next = loc.index + dir
      if (next < 0 || next >= list.length) return
      const [item] = list.splice(loc.index, 1)
      list.splice(next, 0, item)
      this.commit()
      this.dirty = true
    },

    updateProp(key, value) {
      const node = this.selectedNode
      if (!node) return
      node.props[key] = value
      this.commit(false)
      this.dirty = true
    },

    updateStyle(key, value) {
      const node = this.selectedNode
      if (!node) return
      if (!node.style) node.style = {}
      node.style[key] = value
      this.commit(false)
      this.dirty = true
    },

    resetStyle(key) {
      const node = this.selectedNode
      if (!node?.style) return
      delete node.style[key]
      this.commit()
      this.dirty = true
    },

    clearCanvas() {
      this.schema.children = []
      this.selectedId = 'root'
      this.commit()
      this.dirty = true
    },

    /**
     * 套用模板
     * 业务：模板是「起点」而不是「锁定」——套用后所有组件仍可自由编辑。
     *      覆盖前会走一次历史快照，用户误操作可以直接 Ctrl+Z 退回。
     *      数据源同理整体替换，避免旧数据源名与新模板里的绑定对不上。
     */
    applyTemplate(template) {
      if (!template?.schema) return
      const schema = JSON.parse(JSON.stringify(template.schema))
      this.schema = schema.type === 'Page' ? schema : emptySchema()
      if (!Array.isArray(this.schema.children)) this.schema.children = []
      this.datasources = Array.isArray(template.datasources) ? JSON.parse(JSON.stringify(template.datasources)) : []
      this.selectedId = 'root'
      this.commit()
      this.dirty = true
    },

    importSchema(json) {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json
      const schema = parsed?.schema && parsed.schema.type === 'Page' ? parsed.schema : parsed
      if (!schema || schema.type !== 'Page') throw new Error('JSON 结构不正确，应为页面 schema')
      this.schema = schema
      if (Array.isArray(parsed?.datasources)) this.datasources = parsed.datasources
      this.selectedId = 'root'
      this.commit()
      this.dirty = true
    },

    // ---------- 数据源 ----------
    addDatasource(payload = {}) {
      this.datasources.push({
        id: newId('ds'),
        name: payload.name || `datasource${this.datasources.length + 1}`,
        type: 'static',
        url: '',
        method: 'GET',
        json: '[]'
      })
      this.commit()
      this.dirty = true
    },

    updateDatasource(id, key, value) {
      const ds = this.datasources.find((d) => d.id === id)
      if (!ds) return
      ds[key] = value
      this.commit(false)
      this.dirty = true
    },

    removeDatasource(id) {
      this.datasources = this.datasources.filter((d) => d.id !== id)
      this.commit()
      this.dirty = true
    },

    setPageName(name) {
      this.name = name
      this.commit(false)
      this.dirty = true
    },

    setDescription(text) {
      this.description = text
      this.commit(false)
      this.dirty = true
    }
  }
})
