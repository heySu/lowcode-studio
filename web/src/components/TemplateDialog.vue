<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新建页面' : '套用页面模板'"
    width="940px"
    top="6vh"
    :close-on-click-modal="false"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <!-- 说明：模板弹窗同时服务「新建页面」和「设计器套模板」两个场景，
         所以只保留一个入口组件，避免两处逻辑各自演化后行为不一致 -->
    <div class="tpl-wrap">
      <div class="tpl-main">
        <div v-if="mode === 'create'" class="tpl-basic">
          <el-input v-model="name" placeholder="页面名称，例如：客户信息登记" maxlength="40" show-word-limit clearable>
            <template #prepend>页面名称</template>
          </el-input>
          <el-input v-model="description" placeholder="选填，说明这个页面用来做什么" maxlength="120" clearable>
            <template #prepend>描述</template>
          </el-input>
        </div>

        <div class="tpl-main__head">
          <span class="tpl-main__title">选择模板</span>
          <span class="hint" style="margin: 0">选中右侧会显示这个模板怎么改造成你自己的业务</span>
          <span class="grow" />
          <el-tag v-if="loading" size="small" type="info" effect="plain">加载中</el-tag>
        </div>

        <div v-loading="loading" class="tpl-grid">
          <button
            v-for="item in templates"
            :key="item.id"
            type="button"
            class="tpl-card"
            :class="{ 'is-active': current?.id === item.id }"
            @click="current = item"
            @dblclick="confirm()"
          >
            <div class="tpl-card__icon"><el-icon><component :is="item.icon || 'Document'" /></el-icon></div>
            <div class="tpl-card__body">
              <div class="tpl-card__name">
                {{ item.name }}
                <el-tag size="small" type="info" effect="plain">{{ item.category }}</el-tag>
              </div>
              <div class="tpl-card__tagline">{{ item.tagline }}</div>
            </div>
          </button>
        </div>

        <el-alert v-if="loadError" type="error" :closable="false" show-icon :title="`模板加载失败：${loadError}`" style="margin-top: 12px">
          <template #default>
            <el-button size="small" type="primary" plain style="margin-top: 6px" @click="loadTemplates">重新加载</el-button>
            <span class="hint" style="margin-left: 8px">也可以直接选「空白页面」开始搭建</span>
          </template>
        </el-alert>
      </div>

      <!-- 右侧：模板详情 + 改造指引，这是「没有任何提示」问题的直接解法 -->
      <aside class="tpl-side">
        <template v-if="current">
          <div class="tpl-side__name">{{ current.name }}</div>
          <div class="tpl-side__summary">{{ current.summary }}</div>

          <div class="tpl-side__block">
            <div class="tpl-side__label">适用场景</div>
            <div class="tpl-chips">
              <el-tag v-for="scene in current.scenes" :key="scene" size="small" effect="plain" type="primary">{{ scene }}</el-tag>
            </div>
          </div>

          <div class="tpl-side__block">
            <div class="tpl-side__label">页面结构（{{ current.nodeCount }} 个组件）</div>
            <div class="tpl-structure">
              <template v-for="(type, index) in current.previewTypes" :key="index">
                <span class="tpl-structure__item">
                  <el-icon><component :is="iconOf(type)" /></el-icon>{{ labelOf(type) }}
                </span>
                <span v-if="index < current.previewTypes.length - 1" class="tpl-structure__sep">›</span>
              </template>
              <span v-if="!current.previewTypes.length" class="hint">空画布，由你自己决定结构</span>
            </div>
          </div>

          <div class="tpl-side__block">
            <div class="tpl-side__label">已预置</div>
            <ul class="tpl-list">
              <li v-for="item in current.highlights" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="tpl-side__block tpl-side__block--guide">
            <div class="tpl-side__label">怎么改成你的业务</div>
            <div v-for="(step, index) in current.guide" :key="index" class="tpl-step">
              <span class="tpl-step__index">{{ index + 1 }}</span>
              <div>
                <div class="tpl-step__title">{{ step.title }}</div>
                <div class="tpl-step__text">{{ step.text }}</div>
              </div>
            </div>
          </div>
        </template>
        <el-skeleton v-else :rows="6" animated />
      </aside>
    </div>

    <template #footer>
      <span class="tpl-footer-tip">
        <el-icon><InfoFilled /></el-icon>
        {{ mode === 'create' ? '创建后可随时在设计器中修改，模板只是起点' : '套用会覆盖当前画布内容，可以 Ctrl+Z 撤销' }}
      </span>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!current" @click="confirm()">
        {{ mode === 'create' ? '创建并开始设计' : '用此模板覆盖画布' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 模板选择弹窗
 * ------------------------------------------------------------
 * 功能：展示模板列表与详情，收集页面名称，输出用户的选择。
 * 业务：新建页面时最怕「给了一张白纸」，所以这里强制「选中才算数」，
 *      并在右侧同步展示适用场景、组件结构、已预置能力、改造步骤四块信息，
 *      让用户在点创建之前就知道这个页面长什么样、要改几处。
 * 复用：mode='create' 用于列表页新建；mode='apply' 用于设计器替换当前画布。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { templateApi } from '@/api'
import { getMeta } from '@/registry'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mode: { type: String, default: 'create' },
  submitting: { type: Boolean, default: false },
  defaultName: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'submit'])

const templates = ref([])
const current = ref(null)
const loading = ref(false)
const loadError = ref('')
const name = ref('')
const description = ref('')

/** 打开时重置表单并拉取模板；模板列表变化很少，但每次打开都拉一次能拿到最新模板 */
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    name.value = props.defaultName || ''
    description.value = ''
    if (!templates.value.length) await loadTemplates()
    // 默认选中「表单」模板：这是最高频的建页场景，减少一次点击
    current.value = templates.value.find((item) => item.id === 'form') || templates.value[0] || null
  }
)

async function loadTemplates() {
  loading.value = true
  loadError.value = ''
  try {
    templates.value = await templateApi.list()
  } catch (err) {
    loadError.value = err.message
    // 接口不通时仍保留「空白页面」这个兜底选项，保证用户不会被完全卡住
    templates.value = [
      {
        id: 'blank',
        name: '空白页面',
        category: '基础',
        icon: 'Document',
        tagline: '从零开始，自己拖组件',
        summary: '模板列表加载失败，可先用空白页开始搭建。',
        scenes: ['自由搭建'],
        highlights: ['空画布'],
        guide: [{ title: '从左侧拖组件', text: '把容器、表单控件拖进画布即可开始。' }],
        previewTypes: [],
        nodeCount: 0
      }
    ]
  } finally {
    loading.value = false
  }
}

const labelOf = (type) => getMeta(type).label
const iconOf = (type) => getMeta(type).icon

function confirm() {
  if (!current.value) return ElMessage.warning('请先选择一个模板')
  if (props.mode === 'create' && !name.value.trim()) return ElMessage.warning('请填写页面名称')
  emit('submit', {
    templateId: current.value.id,
    template: current.value,
    name: name.value.trim(),
    description: description.value.trim()
  })
}

defineExpose({ reset: () => (current.value = null) })
</script>

<style scoped>
.tpl-wrap {
  display: flex;
  gap: 18px;
  min-height: 420px;
}

.tpl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tpl-basic {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.tpl-main__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.tpl-main__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lc-text);
}

.tpl-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-content: start;
  max-height: 430px;
  overflow: auto;
  padding-right: 4px;
}

.tpl-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  text-align: left;
  padding: 12px;
  border: 1px solid var(--lc-border);
  background: var(--lc-surface-2);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.tpl-card:hover {
  border-color: var(--lc-brand-300);
  background: var(--lc-brand-25);
}

.tpl-card.is-active {
  border-color: var(--lc-primary);
  background: var(--lc-brand-25);
  box-shadow: 0 0 0 1px var(--lc-primary) inset;
}

.tpl-card__icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--lc-primary-soft);
  color: var(--lc-primary);
  font-size: 16px;
}

.tpl-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--lc-text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.tpl-card__tagline {
  font-size: 12px;
  color: var(--lc-text-2);
  margin-top: 3px;
  line-height: 1.5;
}

.tpl-side {
  width: 330px;
  flex: 0 0 330px;
  border-left: 1px solid var(--lc-border);
  padding-left: 18px;
  max-height: 500px;
  overflow: auto;
}

.tpl-side__name {
  font-size: 15px;
  font-weight: 700;
}

.tpl-side__summary {
  font-size: 12px;
  color: var(--lc-text-2);
  line-height: 1.7;
  margin-top: 6px;
}

.tpl-side__block {
  margin-top: 16px;
}

.tpl-side__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--lc-text-3);
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.tpl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tpl-structure {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--lc-gray-700);
}

.tpl-structure__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--lc-bg-subtle);
  border-radius: 6px;
  padding: 3px 7px;
}

.tpl-structure__sep {
  color: var(--lc-border-strong);
}

.tpl-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: var(--lc-gray-700);
  line-height: 1.9;
}

.tpl-side__block--guide {
  border-top: 1px dashed var(--lc-border);
  padding-top: 14px;
}

.tpl-step {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tpl-step__index {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--lc-primary-soft);
  color: var(--lc-primary);
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  margin-top: 1px;
}

.tpl-step__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--lc-text);
}

.tpl-step__text {
  font-size: 12px;
  color: var(--lc-text-2);
  line-height: 1.65;
  margin-top: 2px;
}

.tpl-footer-tip {
  float: left;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--lc-text-3);
  line-height: 32px;
}
</style>
