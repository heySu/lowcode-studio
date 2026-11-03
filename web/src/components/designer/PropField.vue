<template>
  <div class="prop-field">
    <div class="prop-field__label">
      <span>{{ field.label }}</span>
      <span v-if="field.type === 'color'" class="mono" style="color: #98a2b3">{{ value || '—' }}</span>
    </div>

    <el-input
      v-if="field.type === 'input'"
      :model-value="value"
      size="small"
      :placeholder="field.placeholder || ''"
      @update:model-value="(v) => emit('change', v)"
    />

    <el-input
      v-else-if="field.type === 'textarea'"
      :model-value="value"
      type="textarea"
      :rows="3"
      size="small"
      :placeholder="field.placeholder || ''"
      @update:model-value="(v) => emit('change', v)"
    />

    <el-input-number
      v-else-if="field.type === 'number'"
      :model-value="value"
      size="small"
      :min="field.min ?? -9999"
      :max="field.max ?? 99999"
      :step="field.step || 1"
      controls-position="right"
      style="width: 100%"
      @update:model-value="(v) => emit('change', v ?? 0)"
    />

    <el-switch
      v-else-if="field.type === 'switch'"
      :model-value="value"
      size="small"
      @update:model-value="(v) => emit('change', v)"
    />

    <el-select
      v-else-if="field.type === 'select'"
      :model-value="value"
      size="small"
      style="width: 100%"
      @update:model-value="(v) => emit('change', v)"
    >
      <el-option v-for="opt in field.options || []" :key="String(opt.value)" :label="opt.label" :value="opt.value" />
    </el-select>

    <el-color-picker
      v-else-if="field.type === 'color'"
      :model-value="value"
      size="small"
      show-alpha
      @update:model-value="(v) => emit('change', v || '')"
    />

    <el-slider
      v-else-if="field.type === 'slider'"
      :model-value="Number(value) || 0"
      :min="field.min ?? 0"
      :max="field.max ?? 100"
      :step="field.step || 1"
      size="small"
      @update:model-value="(v) => emit('change', v)"
    />

    <el-select
      v-else-if="field.type === 'datasource'"
      :model-value="value || ''"
      size="small"
      clearable
      style="width: 100%"
      @update:model-value="(v) => emit('change', v || '')"
    >
      <el-option v-for="ds in store.datasources" :key="ds.id" :label="ds.name" :value="ds.name" />
    </el-select>

    <div v-else-if="field.type === 'options'">
      <div v-for="(opt, index) in optionList" :key="index" class="opt-row">
        <el-input
          :model-value="opt.label"
          size="small"
          placeholder="显示文字"
          @update:model-value="(v) => updateOption(index, 'label', v)"
        />
        <el-input
          :model-value="opt.value"
          size="small"
          placeholder="值"
          @update:model-value="(v) => updateOption(index, 'value', v)"
        />
        <el-button link size="small" @click="removeOption(index)">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
      <el-button size="small" plain style="width: 100%" @click="addOption">
        <el-icon><Plus /></el-icon> 添加选项
      </el-button>
    </div>

    <div v-else-if="field.type === 'action'" class="action-editor">
      <el-select
        :model-value="action.type"
        size="small"
        style="width: 100%; margin-bottom: 6px"
        @update:model-value="(v) => updateAction({ type: v })"
      >
        <el-option label="无动作" value="none" />
        <el-option label="弹出提示" value="message" />
        <el-option label="打开链接" value="link" />
        <el-option label="请求接口" value="request" />
        <el-option label="重置表单" value="reset" />
      </el-select>

      <el-input
        v-if="['message', 'request'].includes(action.type)"
        :model-value="action.text"
        size="small"
        placeholder="成功提示文案"
        style="margin-bottom: 6px"
        @update:model-value="(v) => updateAction({ text: v })"
      />

      <template v-if="action.type === 'link'">
        <el-input
          :model-value="action.url"
          size="small"
          placeholder="https://example.com"
          @update:model-value="(v) => updateAction({ url: v })"
        />
      </template>

      <template v-if="action.type === 'request'">
        <div style="display: flex; gap: 6px; margin-bottom: 6px">
          <el-select
            :model-value="action.method || 'POST'"
            size="small"
            style="width: 92px"
            @update:model-value="(v) => updateAction({ method: v })"
          >
            <el-option label="POST" value="POST" />
            <el-option label="GET" value="GET" />
            <el-option label="PUT" value="PUT" />
          </el-select>
          <el-input
            :model-value="action.url"
            size="small"
            placeholder="/api/submit"
            @update:model-value="(v) => updateAction({ url: v })"
          />
        </div>
        <el-checkbox
          :model-value="action.includeForm"
          size="small"
          @update:model-value="(v) => updateAction({ includeForm: v })"
        >
          携带表单数据
        </el-checkbox>
      </template>
    </div>

    <div v-if="field.tip" class="hint">{{ field.tip }}</div>
  </div>
</template>

<script setup>
/**
 * 属性编辑控件
 * ------------------------------------------------------------
 * 功能：把 registry 里的字段定义（type + 参数）翻译成 Element Plus 控件。
 * 业务：这是一个「受控组件」——自身不持有状态，改值一律通过 change 事件上抛，
 *      由 store 的 updateProp/updateStyle 统一落树并记录历史。
 *      好处是撤销/重做、脏标记、自动保存只需要在一个地方实现。
 */
import { computed } from 'vue'
import { useDesignerStore } from '@/stores/designer'

const props = defineProps({
  field: { type: Object, required: true },
  value: { default: null }
})
const emit = defineEmits(['change'])

const store = useDesignerStore()

const action = computed(() => props.value || { type: 'none' })
const optionList = computed(() => (Array.isArray(props.value) ? props.value : []))

function updateAction(patch) {
  emit('change', { ...action.value, ...patch })
}

function updateOption(index, key, val) {
  const list = optionList.value.map((item, i) => (i === index ? { ...item, [key]: val } : item))
  emit('change', list)
}

function addOption() {
  emit('change', [...optionList.value, { label: `选项${optionList.value.length + 1}`, value: String(optionList.value.length + 1) }])
}

function removeOption(index) {
  emit('change', optionList.value.filter((_, i) => i !== index))
}
</script>

<style scoped>
.action-editor {
  border: 1px solid var(--lc-border-subtle);
  border-radius: 8px;
  padding: 8px;
  background: var(--lc-surface-2);
}
</style>
