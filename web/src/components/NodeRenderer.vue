<template>
  <div
    ref="wrapRef"
    class="lc-node"
    :class="wrapClass"
    :style="wrapperStyle"
    :data-node-id="node.id"
    :draggable="isDesign && !store.interactive"
    @click.stop="selectSelf"
    @dragstart.stop="onDragStart"
    @dragend="onDragEnd"
    @dragover.stop.prevent="onDragOver"
    @drop.stop.prevent="onDrop"
  >
    <div v-if="isDesign && selected" class="lc-node__badge">
      <span class="lc-node__type">{{ meta.label }}</span>
      <span class="lc-node__act" title="复制" @click.stop="onDuplicate"><el-icon><CopyDocument /></el-icon></span>
      <span class="lc-node__act" title="删除" @click.stop="onRemove"><el-icon><Delete /></el-icon></span>
    </div>

    <!-- 容器 -->
    <div v-if="node.type === 'Container'" class="lc-flex" :style="containerStyle">
      <template v-if="hasChildren">
        <NodeRenderer v-for="child in node.children" :key="child.id" :node="child" />
      </template>
      <div v-else-if="isDesign" class="lc-empty-tip">拖拽组件到此容器</div>
    </div>

    <!-- 卡片 -->
    <el-card
      v-else-if="node.type === 'Card'"
      :shadow="props.shadow"
      :body-style="{ padding: `${props.padding}px` }"
      class="lc-card"
    >
      <template v-if="props.title" #header>
        <span class="lc-card__title">{{ props.title }}</span>
      </template>
      <div class="lc-children">
        <template v-if="hasChildren">
          <NodeRenderer v-for="child in node.children" :key="child.id" :node="child" />
        </template>
        <div v-else-if="isDesign" class="lc-empty-tip">拖拽组件到此卡片</div>
      </div>
    </el-card>

    <!-- 分割线 -->
    <el-divider v-else-if="node.type === 'Divider'" :content-position="props.position">
      {{ props.text }}
    </el-divider>

    <!-- 标题 -->
    <component
      :is="`h${props.level || 2}`"
      v-else-if="node.type === 'Title'"
      :style="titleStyle"
    >
      {{ text(props.text) }}
    </component>

    <!-- 文本 -->
    <p v-else-if="node.type === 'Text'" :style="textStyle">{{ text(props.content) }}</p>

    <!-- 按钮 -->
    <el-button
      v-else-if="node.type === 'Button'"
      :type="props.type"
      :size="props.size"
      :plain="props.plain"
      :round="props.round"
      :style="props.block ? { width: '100%' } : {}"
      @click.stop="onButtonClick"
    >
      {{ text(props.text) }}
    </el-button>

    <!-- 图片 -->
    <img
      v-else-if="node.type === 'Image'"
      :src="props.src"
      :style="{ width: '100%', height: `${props.height}px`, objectFit: props.fit, borderRadius: `${props.radius}px`, display: 'block' }"
      alt=""
    />

    <!-- 提示 -->
    <el-alert
      v-else-if="node.type === 'Alert'"
      :title="text(props.title)"
      :type="props.type"
      :description="text(props.description)"
      :closable="props.closable"
      :show-icon="props.showIcon"
    />

    <!-- 标签 -->
    <el-tag v-else-if="node.type === 'Tag'" :type="props.type" :size="props.size" :effect="props.effect">
      {{ text(props.text) }}
    </el-tag>

    <!-- 数据表格 -->
    <div v-else-if="node.type === 'Table'">
      <el-table
        v-if="tableData.length || isDesign"
        :data="tableData"
        :stripe="props.stripe"
        :border="props.border"
        :size="props.size"
        :max-height="props.maxHeight || undefined"
        style="width: 100%"
        empty-text=""
      >
        <el-table-column
          v-for="col in columns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          show-overflow-tooltip
          min-width="120"
        />
      </el-table>
      <el-empty v-else :description="props.emptyText || '暂无数据'" :image-size="60" />
    </div>

    <!-- 指标卡 -->
    <div
      v-else-if="node.type === 'Statistic'"
      class="lc-stat"
      :style="{
        background: props.background || '#fff',
        border: props.border ? '1px solid #eaecf0' : '1px solid transparent',
        borderRadius: '10px',
        padding: '16px 18px'
      }"
    >
      <div class="lc-stat__title">{{ text(props.title) }}</div>
      <div class="lc-stat__value" :style="{ color: props.color || '#101828' }">
        <span v-if="props.prefix" class="lc-stat__affix">{{ props.prefix }}</span>
        {{ statValue }}
        <span v-if="props.suffix" class="lc-stat__affix">{{ props.suffix }}</span>
      </div>
    </div>

    <!-- 进度条 -->
    <el-progress
      v-else-if="node.type === 'Progress'"
      :percentage="Number(props.percentage) || 0"
      :stroke-width="props.strokeWidth"
      :status="props.status || undefined"
      :color="props.color"
      :show-text="props.showText"
    />

    <!-- 表单类组件 -->
    <div v-else-if="isFormField" class="lc-form-field" :class="`lc-form-field--${props.layout || 'vertical'}`">
      <label v-if="props.label" class="lc-form-field__label" :style="labelStyle">
        {{ props.label }}<span v-if="props.required" class="req">*</span>
      </label>
      <div class="lc-form-field__control">
        <el-input
          v-if="node.type === 'Input'"
          v-model="formModel[props.name]"
          :placeholder="props.placeholder"
          :clearable="props.clearable"
        />
        <el-input
          v-else-if="node.type === 'Textarea'"
          v-model="formModel[props.name]"
          type="textarea"
          :rows="props.rows"
          :placeholder="props.placeholder"
        />
        <el-input-number
          v-else-if="node.type === 'Number'"
          v-model="formModel[props.name]"
          :min="props.min"
          :max="props.max"
          :step="props.step"
          controls-position="right"
          style="width: 100%"
        />
        <el-select
          v-else-if="node.type === 'Select'"
          v-model="formModel[props.name]"
          :placeholder="props.placeholder"
          :multiple="props.multiple"
          :clearable="props.clearable"
          style="width: 100%"
        >
          <el-option v-for="opt in optionsList" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-radio-group v-else-if="node.type === 'Radio'" v-model="formModel[props.name]">
          <el-radio v-for="opt in optionsList" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio>
        </el-radio-group>
        <el-checkbox-group v-else-if="node.type === 'Checkbox'" v-model="formModel[props.name]">
          <el-checkbox v-for="opt in optionsList" :key="opt.value" :value="opt.value">{{ opt.label }}</el-checkbox>
        </el-checkbox-group>
        <el-switch
          v-else-if="node.type === 'Switch'"
          v-model="formModel[props.name]"
          :active-text="props.activeText"
          :inactive-text="props.inactiveText"
        />
        <el-date-picker
          v-else-if="node.type === 'DatePicker'"
          v-model="formModel[props.name]"
          :type="props.type"
          :placeholder="props.placeholder"
          style="width: 100%"
          value-format="YYYY-MM-DD"
        />
        <el-slider
          v-else-if="node.type === 'Slider'"
          v-model="formModel[props.name]"
          :min="props.min"
          :max="props.max"
          :step="props.step"
          :show-input="props.showInput"
        />
        <el-rate
          v-else-if="node.type === 'Rate'"
          v-model="formModel[props.name]"
          :max="props.max"
          :allow-half="props.allowHalf"
        />
      </div>
    </div>

    <div v-else class="lc-empty-tip">未知组件：{{ node.type }}</div>
  </div>
</template>

<script setup>
/**
 * 渲染引擎（设计态 / 运行态共用）
 * ------------------------------------------------------------
 * 功能：把一个 schema 节点渲染成真实 UI，并承载拖拽落点与选中态。
 * 业务：
 *   1. 设计态与运行态复用同一份模板——「所见即所得」的根基：
 *      拖拽时看到的布局、样式与发布后的页面完全一致，不存在「设计稿是 A、上线变 B」；
 *   2. 设计态下所有表单控件被 CSS 禁掉交互（见 global.css 的 pointer-events 规则），
 *      点击行为统一变成「选中组件」，避免设计时误输入、误触发；
 *   3. 拖拽落点分三类：容器内部（inside）、兄弟节点前/后（before/after）。
 *      子节点在 dragover 时 stopPropagation，保证命中的永远是最内层节点，
 *      这也是嵌套容器能精准插入的原因；
 *   4. 模板插值 {{form.x}} / {{数据源名.字段}} 在这里解析，让页面具备基础的数据驱动能力。
 */
import { computed, inject, onMounted, provide, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useDesignerStore } from '@/stores/designer'
import { getMeta } from '@/registry'
import { renderTemplate, toCssStyle, parseColumnTitles } from '@/utils/format'
import { postToHost } from '@/utils/embed'

defineOptions({ name: 'NodeRenderer' })

const props_ = defineProps({ node: { type: Object, required: true } })
const node = props_.node

const store = useDesignerStore()
const mode = inject('lcMode', ref('preview'))
const formModel = inject('lcForm', reactive({}))
const dataCtx = inject('lcData', reactive({}))

const meta = computed(() => getMeta(node.type))
const props = computed(() => node.props || {})
const isDesign = computed(() => mode.value === 'design')
const selected = computed(() => isDesign.value && !store.interactive && store.selectedId === node.id)
const hasChildren = computed(() => (node.children || []).length > 0)

const wrapRef = ref(null)

/**
 * 父容器排列方向（inject）与提供给子节点的方向（provide）。
 * 业务：拖拽插入的 before/after 必须沿父容器的排列轴判定——
 *      纵向容器里上下分前后，横向容器里左右分前后，否则行内排序无法命中。
 */
const parentDir = inject('lcParentDir', ref('column'))
provide(
  'lcParentDir',
  computed(() => (node.type === 'Container' ? props.value.direction || 'column' : 'column'))
)

const FORM_TYPES = ['Input', 'Textarea', 'Number', 'Select', 'Radio', 'Checkbox', 'Switch', 'DatePicker', 'Slider', 'Rate']
const isFormField = computed(() => FORM_TYPES.includes(node.type))

const wrapClass = computed(() => ({
  'is-selected': selected.value,
  'lc-axis-row': parentDir.value === 'row',
  'lc-drop-inside': store.dropTarget?.id === node.id && store.dropTarget?.pos === 'inside',
  'lc-drop-before': store.dropTarget?.id === node.id && store.dropTarget?.pos === 'before',
  'lc-drop-after': store.dropTarget?.id === node.id && store.dropTarget?.pos === 'after'
}))

/** 内容型组件：在横向容器里保持自身内容宽度，不参与均分（否则按钮会被拉得巨宽） */
const INLINE_TYPES = ['Button', 'Tag', 'Title', 'Text', 'Divider']

const wrapperStyle = computed(() => {
  const style = toCssStyle(node.style)
  /**
   * 横向容器里的子项默认宽度策略：
   *   - 填充型（表单控件/容器/表格等）→ flex:1 1 0 均分，这是「一行多个输入框」的预期体验；
   *   - 内容型（按钮/标签/标题/文本）→ 保持内容宽，靠容器 justify 排布。
   * 显式设置了弹性占比或宽度时一律以用户配置优先。
   */
  if (parentDir.value === 'row' && !style.flex && !style.width) {
    if (INLINE_TYPES.includes(node.type)) return { ...style, flex: '0 0 auto', minWidth: 0 }
    return { ...style, flex: '1 1 0%', minWidth: 0 }
  }
  return style
})

const containerStyle = computed(() => ({
  display: 'flex',
  flexDirection: props.value.direction || 'column',
  flexWrap: props.value.wrap ? 'wrap' : 'nowrap',
  gap: `${props.value.gap ?? 12}px`,
  padding: `${props.value.padding ?? 16}px`,
  background: props.value.background || 'transparent',
  border: props.value.border ? '1px solid #eaecf0' : '1px solid transparent',
  borderRadius: `${props.value.radius ?? 8}px`,
  justifyContent: props.value.justify || 'flex-start',
  alignItems: props.value.align || 'stretch',
  minHeight: props.value.minHeight ? `${props.value.minHeight}px` : '0px',
  width: '100%'
}))

const titleStyle = computed(() => ({
  margin: 0,
  textAlign: props.value.align,
  color: props.value.color,
  fontWeight: props.value.weight,
  fontSize: `${[30, 24, 20, 17, 15][(props.value.level || 2) - 1]}px`,
  lineHeight: 1.4
}))

const textStyle = computed(() => ({
  margin: 0,
  textAlign: props.value.align,
  color: props.value.color,
  fontWeight: props.value.weight,
  fontSize: `${props.value.size || 14}px`,
  lineHeight: props.value.lineHeight || 1.7
}))

const labelStyle = computed(() =>
  props.value.layout === 'horizontal' ? { width: props.value.labelWidth || '96px' } : {}
)

const ctx = computed(() => ({ form: formModel, ...dataCtx }))

function text(value) {
  return renderTemplate(value, ctx.value)
}

const optionsList = computed(() => {
  const source = props.value.optionsSource
  if (source && Array.isArray(dataCtx[source])) {
    return dataCtx[source].map((item) => {
      if (item && typeof item === 'object') {
        const label = item.label ?? item.name ?? String(item.value ?? '')
        return { label, value: item.value ?? item.id ?? label }
      }
      return { label: String(item), value: item }
    })
  }
  return props.value.options || []
})

const tableData = computed(() => {
  const source = props.value.dataSource
  const list = source ? dataCtx[source] : []
  return Array.isArray(list) ? list : []
})

const titleMap = computed(() => parseColumnTitles(props.value.columnTitles))

const columns = computed(() => {
  if (!tableData.value.length) return []
  const sample = tableData.value[0]
  if (sample == null || typeof sample !== 'object') return [{ prop: 'value', label: '数据' }]
  return Object.keys(sample).map((key) => ({ prop: key, label: titleMap.value[key] || key }))
})

const statValue = computed(() => {
  const raw = text(props.value.value)
  const precision = Number(props.value.precision || 0)
  const num = Number(raw)
  if (!Number.isNaN(num) && precision > 0) return num.toFixed(precision)
  return raw
})

onMounted(() => {
  if (!isFormField.value || !props.value.name) return
  const key = props.value.name
  if (formModel[key] === undefined) {
    const dv = props.value.defaultValue
    formModel[key] = node.type === 'Checkbox' ? [] : dv ?? ''
  }
})

// ---------- 交互 ----------
function selectSelf() {
  // 交互预览模式下点击是「试用控件」，不改变选中
  if (isDesign.value && !store.interactive) store.select(node.id)
}

function onDuplicate() {
  store.duplicateNode(node.id)
}

function onRemove() {
  store.removeNodeById(node.id)
}

async function onButtonClick() {
  if (isDesign.value) return
  const action = node.props.action || {}
  if (action.type === 'message') {
    ElMessage.success(action.text || '操作成功')
  } else if (action.type === 'link') {
    if (action.url) window.open(action.url, '_blank')
    else ElMessage.warning('未配置跳转地址')
  } else if (action.type === 'reset') {
    Object.keys(formModel).forEach((key) => delete formModel[key])
    ElMessage.info('表单已重置')
  } else if (action.type === 'request') {
    if (!action.url) return ElMessage.warning('未配置请求地址')
    const payloadBody = action.includeForm ? { ...formModel } : {}
    try {
      const res = await fetch(action.url, {
        method: action.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action.method === 'GET' ? undefined : JSON.stringify(payloadBody)
      })
      const payload = await res.json().catch(() => ({}))
      const ok = res.ok && payload?.success !== false
      /**
       * 嵌入接入：宿主系统需要知道「提交成功了没有、提交了什么」，
       * 才能刷新自己的列表或关闭弹窗。结果里带 response 便于宿主拿到业务单号。
       */
      postToHost('lc:submit', {
        ok,
        status: res.status,
        url: action.url,
        data: payloadBody,
        response: payload
      })
      if (ok) ElMessage.success(action.text || payload?.data?.message || '请求成功')
      else ElMessage.error(payload?.message || `请求失败（HTTP ${res.status}）`)
    } catch (err) {
      postToHost('lc:submit', { ok: false, url: action.url, data: payloadBody, error: err.message })
      ElMessage.error(`请求失败：${err.message}`)
    }
  }
}

// ---------- 拖拽 ----------
/**
 * 落点判定
 * ------------------------------------------------------------
 * 业务规则（这是「组件能否任意组合」的关键）：
 *   1. 容器类组件：默认落入内部（inside），但指针进入上下（或左右）边缘带时
 *      判定为 before/after——即插入为容器的「兄弟」。没有这条规则，
 *      一旦画布上有了容器，就再也摆不出与它并排的组件，只能无限嵌套；
 *   2. 叶子组件：沿父容器的排列轴判定——纵向容器按上下半区分前后，
 *      横向容器按左右半区，保证行内排序符合直觉；
 *   3. 边缘带宽度自适应（不超过短边的 1/4）：小容器不会被边缘带占满，
 *      仍能轻松拖入内部。
 */
const EDGE_BAND = 14

function computePos(event) {
  const el = wrapRef.value
  if (!el) return 'inside'
  const rect = el.getBoundingClientRect()
  // 判定轴跟随父容器排列方向：横向容器的子项按左右分前后
  const axisX = parentDir.value === 'row'
  if (meta.value.acceptsChildren) {
    const band = axisX ? Math.min(EDGE_BAND, rect.width / 4) : Math.min(EDGE_BAND, rect.height / 4)
    if (axisX) {
      if (event.clientX - rect.left <= band) return 'before'
      if (rect.right - event.clientX <= band) return 'after'
    } else {
      if (event.clientY - rect.top <= band) return 'before'
      if (rect.bottom - event.clientY <= band) return 'after'
    }
    return 'inside'
  }
  if (axisX) {
    return event.clientX - rect.left < rect.width / 2 ? 'before' : 'after'
  }
  return event.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
}

function onDragStart(event) {
  if (!isDesign.value || store.interactive) return
  event.stopPropagation()
  store.startDrag({ kind: 'move', id: node.id })
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', node.id)
  }
}

function onDragEnd() {
  if (isDesign.value) store.endDrag()
}

function onDragOver(event) {
  if (!isDesign.value || store.interactive || !store.drag) return
  if (store.drag.kind === 'move' && store.drag.id === node.id) {
    store.setDropTarget(null)
    return
  }
  store.setDropTarget({ id: node.id, pos: computePos(event) })
}

function onDrop(event) {
  if (!isDesign.value || store.interactive) return
  const result = store.commitDrop({ id: node.id, pos: computePos(event) })
  if (result && result.ok === false) ElMessage.warning(result.message)
}
</script>

<style scoped>
.lc-card {
  border-radius: 10px;
  width: 100%;
}
.lc-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lc-text);
}
.lc-stat__title {
  font-size: 12px;
  color: var(--lc-text-2);
  margin-bottom: 6px;
}
.lc-stat__value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.2;
}
.lc-stat__affix {
  font-size: 13px;
  font-weight: 500;
  color: var(--lc-text-2);
}
</style>
