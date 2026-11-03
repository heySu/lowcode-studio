<template>
  <div class="prop-panel">
    <div class="prop-head">
      <el-icon style="color: var(--lc-primary)">
        <component :is="isRoot ? 'Document' : meta.icon" />
      </el-icon>
      <span class="prop-head__type">{{ isRoot ? '页面设置' : meta.label }}</span>
      <span class="grow" />
      <span class="mono" style="font-size: 11px; color: #b0b7c3">{{ node?.id }}</span>
    </div>

    <el-tabs v-model="tab" class="prop-tabs" stretch>
      <el-tab-pane label="属性" name="props">
        <div class="prop-body">
          <!-- 页面级设置 -->
          <template v-if="isRoot">
            <div class="prop-field">
              <div class="prop-field__label">页面名称</div>
              <el-input :model-value="store.name" size="small" @update:model-value="store.setPageName" />
            </div>
            <div class="prop-field">
              <div class="prop-field__label">页面描述</div>
              <el-input
                :model-value="store.description"
                type="textarea"
                :rows="3"
                size="small"
                @update:model-value="store.setDescription"
              />
            </div>
            <div class="prop-section-title">页面概览</div>
            <div class="hint" style="line-height: 2">
              组件数量：{{ counts.nodes }}<br />
              数据源数量：{{ store.datasources.length }}<br />
              当前状态：{{ store.status === 'published' ? '已发布' : '草稿' }}
            </div>
            <el-alert
              type="info"
              :closable="false"
              show-icon
              title="选中画布中的组件即可编辑其属性"
              style="margin-top: 12px"
            />
          </template>

          <template v-else>
            <PropField
              v-for="field in meta.fields"
              :key="field.key"
              :field="field"
              :value="node.props?.[field.key]"
              @change="(v) => store.updateProp(field.key, v)"
            />
            <div v-if="!meta.fields?.length" class="hint">该组件没有可配置属性</div>
          </template>
        </div>
      </el-tab-pane>

      <el-tab-pane label="样式" name="style" :disabled="isRoot">
        <div class="prop-body">
          <PropField
            v-for="field in styleFields"
            :key="field.key"
            :field="field"
            :value="node?.style?.[field.key]"
            @change="(v) => store.updateStyle(field.key, v)"
          />
          <el-divider style="margin: 14px 0" />
          <el-button size="small" plain style="width: 100%" @click="resetStyle">重置样式</el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="事件" name="event" :disabled="isRoot">
        <div class="prop-body">
          <template v-if="node?.type === 'Button'">
            <div class="prop-section-title">点击时</div>
            <PropField
              :field="{ key: 'action', label: '动作配置', type: 'action' }"
              :value="node.props.action"
              @change="(v) => store.updateProp('action', v)"
            />
            <div class="hint">
              选择「请求接口」可把表单数据提交到后端，例如 <span class="mono">/api/demo/submit</span>
            </div>
          </template>
          <el-empty v-else description="该组件暂无可配置事件" :image-size="60" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <div v-if="!isRoot" class="prop-foot">
      <el-tooltip content="上移" placement="top">
        <el-button size="small" :disabled="!canShift(-1)" @click="store.shiftNode(node.id, -1)">
          <el-icon><Top /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="下移" placement="top">
        <el-button size="small" :disabled="!canShift(1)" @click="store.shiftNode(node.id, 1)">
          <el-icon><Bottom /></el-icon>
        </el-button>
      </el-tooltip>
      <el-button size="small" @click="store.duplicateNode(node.id)">
        <el-icon><CopyDocument /></el-icon><span style="margin-left: 4px">复制</span>
      </el-button>
      <el-button size="small" type="danger" plain @click="store.removeNodeById(node.id)">
        <el-icon><Delete /></el-icon><span style="margin-left: 4px">删除</span>
      </el-button>
    </div>
  </div>
</template>

<script setup>
/**
 * 右侧属性面板
 * ------------------------------------------------------------
 * 功能：编辑选中组件的属性（props）、通用样式（style）与事件（动作）。
 * 业务：
 *   1. 属性项由 registry 的 fields 驱动，面板本身不感知具体组件——
 *      新增组件的配置项只需要改注册表，这里零改动；
 *   2. 「样式」页签只放通用布局属性（宽度/弹性/边距等），与组件特有属性分离，
 *      避免用户在十几项里找「按钮类型」；
 *   3. 事件目前支持点击动作。预留扩展点：后续加「值变化」「显示条件」时，
 *      在 event 页签内按组件类型分发即可，不要把逻辑散落到渲染器里。
 */
import { computed, ref } from 'vue'
import { useDesignerStore } from '@/stores/designer'
import { getMeta } from '@/registry'
import { locate, countNodes } from '@/utils/tree'
import PropField from './PropField.vue'

const store = useDesignerStore()
const tab = ref('props')

const isRoot = computed(() => store.selectedId === 'root')
const node = computed(() => store.selectedNode)
const meta = computed(() => (node.value ? getMeta(node.value.type) : getMeta('Text')))

const counts = computed(() => ({ nodes: countNodes(store.schema) }))

const styleFields = [
  { key: 'width', label: '宽度', type: 'input', placeholder: 'auto / 100% / 320px' },
  { key: 'height', label: '高度', type: 'input', placeholder: 'auto' },
  {
    key: 'flex',
    label: '弹性占比',
    type: 'select',
    tip: '横向容器内默认均分宽度，可在此覆盖',
    options: [
      { label: '默认（均分）', value: '' },
      { label: '1 份', value: '1' },
      { label: '2 份', value: '2' },
      { label: '不伸缩', value: '0 0 auto' }
    ]
  },
  { key: 'margin', label: '外边距', type: 'input', placeholder: '0 或 8px 0' },
  { key: 'borderRadius', label: '圆角', type: 'number', min: 0, max: 40 },
  { key: 'opacity', label: '透明度', type: 'slider', min: 0, max: 1, step: 0.1 }
]

function resetStyle() {
  if (!node.value) return
  Object.keys(node.value.style || {}).forEach((key) => store.resetStyle(key))
}

function canShift(dir) {
  if (!node.value) return false
  const loc = locate(store.schema, node.value.id)
  if (!loc?.parent) return false
  const next = loc.index + dir
  return next >= 0 && next < loc.parent.children.length
}
</script>

<style scoped>
.prop-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.prop-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 12px;
}
.prop-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.prop-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow: hidden;
}
.prop-foot {
  border-top: 1px solid var(--lc-border);
  padding: 10px 12px;
  display: flex;
  gap: 6px;
}
</style>
