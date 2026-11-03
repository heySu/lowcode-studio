<template>
  <el-dialog
    :model-value="modelValue"
    :title="allowOverwrite ? '导入页面代码' : '导入页面'"
    width="680px"
    top="8vh"
    destroy-on-close
    @update:model-value="(v) => emit('update:modelValue', v)"
    @closed="reset"
  >
    <div class="import-body">
      <el-alert type="info" :closable="false" show-icon class="import-tip">
        <template #title>
          支持本平台导出的 <b>.page.json</b>（标准导出包）、旧版导出文件，以及裸页面结构（Page schema）。
          导入前会先做一次服务端校验，不合法会明确指出问题，不会把坏数据写进平台。
        </template>
      </el-alert>

      <!-- 方式一：选文件 / 拖入文件 -->
      <div
        class="drop-zone"
        :class="{ 'is-over': dragging, 'has-file': !!fileName }"
        @click="pickFile"
        @dragover.prevent.stop="dragging = true"
        @dragleave.prevent.stop="dragging = false"
        @drop.prevent.stop="onDrop"
      >
        <el-icon class="drop-zone__icon"><UploadFilled /></el-icon>
        <div class="drop-zone__title">
          {{ fileName ? fileName : '点击选择文件，或把导出的 JSON 文件拖到这里' }}
        </div>
        <div class="drop-zone__hint">
          {{ fileName ? '已读取文件内容，可在下方核对后再导入' : '文件仅在本机浏览器中读取，不会上传到第三方' }}
        </div>
        <input ref="fileInput" type="file" accept=".json,application/json" style="display: none" @change="onFileChange" />
      </div>

      <div class="or-line"><span>或者直接粘贴 JSON</span></div>

      <!-- 方式二：粘贴文本 -->
      <el-input
        v-model="text"
        type="textarea"
        :rows="7"
        class="mono"
        resize="vertical"
        placeholder='{"format":"lowcode-page","version":1,"page":{"name":"信息登记"},"schema":{...}}'
      />

      <!-- 服务端校验 / 解析错误 -->
      <el-alert
        v-if="error"
        type="error"
        :closable="false"
        show-icon
        :title="error"
        class="import-error"
      />

      <!-- 校验通过后的摘要：让用户在「真正写库」前确认导的是什么 -->
      <div v-if="preview" class="preview">
        <div class="preview__head">
          <el-icon><DocumentChecked /></el-icon>
          <span>校验通过，可以导入</span>
          <el-tag size="small" type="info" effect="plain">{{ preview.formatLabel }}</el-tag>
          <el-tag v-if="preview.version" size="small" type="info" effect="plain">v{{ preview.version }}</el-tag>
        </div>

        <el-form label-width="86px" label-position="left" class="preview__form">
          <el-form-item label="组件数量">
            <span class="preview__metric">{{ preview.nodes }} 个</span>
            <span class="preview__metric">数据源 {{ preview.datasourceCount }} 个</span>
            <span v-if="preview.exportedAt" class="preview__metric preview__metric--dim">
              导出于 {{ formatTime(preview.exportedAt) }}
            </span>
          </el-form-item>

          <el-form-item v-if="mode === 'create'" label="页面名称">
            <el-input v-model="pageName" maxlength="60" show-word-limit placeholder="导入后的页面名称" />
          </el-form-item>
          <el-form-item v-else label="导入方式">
            <span class="preview__metric">替换画布内容，保留当前页面名称</span>
          </el-form-item>
        </el-form>

        <el-radio-group v-if="allowOverwrite" v-model="mode" class="preview__mode">
          <el-radio value="create">新建一个页面</el-radio>
          <el-radio value="overwrite">覆盖当前画布（可 Ctrl+Z 撤销）</el-radio>
        </el-radio-group>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span v-if="validating" class="dialog-footer__hint">正在校验…</span>
        <span v-else-if="!preview && !error && text.trim()" class="dialog-footer__hint">等待校验</span>
        <span class="grow" />
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" :disabled="!preview || !!error" :loading="submitting" @click="submit">
          {{ mode === 'overwrite' ? '覆盖画布' : '导入并打开' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 导入页面弹窗
 * ------------------------------------------------------------
 * 功能：读取用户提供的页面文件（选择/拖入/粘贴），解析出导出包，
 *      调用服务端 dryRun 接口做权威校验并展示摘要，确认后交给上层执行导入。
 * 业务要点：
 *   1. 校验放在服务端：组件白名单、嵌套深度、体积、数据源合法性这些规则只能有一处实现，
 *      前端重复一套必然出现「前端过了后端不过」的割裂，所以这里只做 JSON 解析与格式识别；
 *   2. 先校验后落库：dryRun 通过才允许点确认，避免「先创建再报错」留下垃圾页面；
 *   3. 两种落点明确分开：新建页面（进入新设计器）与覆盖当前画布（换内容、留页面、可撤销），
 *      覆盖必须二次选择，防止用户误把别人的页面内容顶掉自己的画布。
 */
import { ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { pageApi } from '@/api'
import { parseImportText, sanitizeFileName } from '@/utils/pageCode'
import { formatTime } from '@/utils/format'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 设计器内导入时允许「覆盖当前画布」；列表页只能新建 */
  allowOverwrite: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'imported'])

const fileInput = ref(null)
const text = ref('')
const fileName = ref('')
const dragging = ref(false)
const validating = ref(false)
const submitting = ref(false)
const error = ref('')
const preview = ref(null)
const pageName = ref('')
/** 默认总是「新建页面」：覆盖是破坏性动作，必须用户主动切换 */
const mode = ref('create')
/** 当前解析出的导出包，确认时直接提交给服务端 */
let currentPkg = null
let timer = null
/** 防止「先发请求后改文本」的竞态：只有最后一次输入的响应才允许落地 */
let seq = 0

watch(
  () => props.modelValue,
  (open) => {
    if (open) mode.value = 'create'
  }
)

watch(text, () => {
  scheduleValidate()
})

function scheduleValidate() {
  clearTimeout(timer)
  preview.value = null
  error.value = ''
  currentPkg = null
  if (!text.value.trim()) return
  timer = setTimeout(validate, 350)
}

/**
 * 校验流程：本地解析（快、能区分「不是 JSON」和「不是页面文件」）
 * → 服务端 dryRun（权威规则、返回组件数与数据源数）
 */
async function validate() {
  const mySeq = ++seq
  validating.value = true
  error.value = ''
  preview.value = null

  let parsed
  try {
    parsed = parseImportText(text.value)
  } catch (err) {
    if (mySeq === seq) {
      error.value = err.message
      validating.value = false
    }
    return
  }

  try {
    const summary = await pageApi.importPage({ ...parsed.pkg, dryRun: true })
    if (mySeq !== seq) return
    currentPkg = parsed.pkg
    preview.value = summary
    pageName.value = summary.name || parsed.pkg.page?.name || '导入的页面'
  } catch (err) {
    if (mySeq !== seq) return
    error.value = err.message
  } finally {
    if (mySeq === seq) validating.value = false
  }
}

function pickFile() {
  fileInput.value?.click()
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  await readFile(file)
}

async function onDrop(event) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) await readFile(file)
}

/** 文件大小前置拦截：后端请求体上限 6MB，超过 2MB 的页面文件基本可以判定不是正常导出 */
async function readFile(file) {
  if (!/\.json$/i.test(file.name)) {
    error.value = '请选择 .json 文件（页面导出文件的后缀是 .page.json）'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    error.value = `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），正常页面导出文件不会超过 1MB`
    return
  }
  fileName.value = sanitizeFileName(file.name, 'page.json')
  text.value = await file.text()
  // 文件读取后立刻校验，不等防抖
  clearTimeout(timer)
  await validate()
}

async function submit() {
  if (!currentPkg || !preview.value) return
  if (mode.value === 'create' && !pageName.value.trim()) {
    return ElMessage.warning('请填写页面名称')
  }

  submitting.value = true
  try {
    if (mode.value === 'overwrite') {
      // 覆盖画布不写库：由设计器改了画布状态，保存与撤销仍走原有流程
      emit('imported', { mode: 'overwrite', pkg: currentPkg, summary: preview.value })
    } else {
      const page = await pageApi.importPage({
        ...currentPkg,
        page: { ...currentPkg.page, name: pageName.value.trim() }
      })
      emit('imported', { mode: 'create', page, summary: preview.value })
    }
    emit('update:modelValue', false)
  } catch (err) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}

function reset() {
  clearTimeout(timer)
  text.value = ''
  fileName.value = ''
  error.value = ''
  preview.value = null
  currentPkg = null
  pageName.value = ''
  validating.value = false
  submitting.value = false
  seq += 1
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.import-body { display: flex; flex-direction: column; gap: 12px; }
.import-tip :deep(.el-alert__title) { line-height: 1.7; font-size: 12px; }

.drop-zone {
  border: 1px dashed var(--lc-border-strong);
  border-radius: 10px;
  padding: 22px 16px;
  text-align: center;
  cursor: pointer;
  background: var(--lc-surface-2);
  transition: border-color 0.2s, background 0.2s;
}
.drop-zone:hover, .drop-zone.is-over { border-color: var(--lc-primary); background: var(--lc-brand-25); }
.drop-zone.has-file { border-style: solid; border-color: var(--lc-success); background: var(--lc-success-bg); }
.drop-zone__icon { font-size: 24px; color: var(--lc-text-3); }
.drop-zone.has-file .drop-zone__icon { color: var(--lc-success); }
.drop-zone__title { margin-top: 6px; font-size: 13px; color: var(--lc-gray-800); }
.drop-zone__hint { margin-top: 4px; font-size: 12px; color: var(--lc-text-3); }

.or-line { display: flex; align-items: center; gap: 10px; color: var(--lc-text-3); font-size: 12px; }
.or-line::before, .or-line::after { content: ''; flex: 1; height: 1px; background: var(--lc-border); }

.import-error { margin-top: 2px; }

.preview {
  border: 1px solid var(--lc-success-border);
  background: var(--lc-success-bg);
  border-radius: 10px;
  padding: 14px 16px 6px;
}
.preview__head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--lc-success-text); font-weight: 600; }
.preview__form { margin-top: 10px; }
.preview__form :deep(.el-form-item) { margin-bottom: 12px; }
.preview__metric { font-size: 13px; color: var(--lc-gray-800); margin-right: 16px; }
.preview__metric--dim { color: var(--lc-text-3); font-size: 12px; }
.preview__mode { margin: 0 0 10px; }

.dialog-footer { display: flex; align-items: center; gap: 10px; }
.dialog-footer__hint { font-size: 12px; color: var(--lc-text-3); }
</style>
