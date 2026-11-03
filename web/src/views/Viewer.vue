<template>
  <div ref="rootRef" class="viewer" :class="{ 'viewer--embed': isEmbed }">
    <!-- 嵌入模式不渲染平台外壳：父系统要的是「一张业务表单」，不是带我们导航条的整站 -->
    <div v-if="!isEmbed" class="viewer__bar">
      <span class="brand__logo" style="width: 24px; height: 24px; font-size: 11px">LC</span>
      <strong style="font-size: 14px">{{ title || '页面' }}</strong>
      <el-tag v-if="isPreview" size="small" type="warning" effect="plain">预览模式</el-tag>
      <el-tag v-else-if="loaded" size="small" type="success" effect="plain">已发布</el-tag>
      <span class="grow" />
      <el-button size="small" text @click="jsonVisible = true" :disabled="!page">页面 JSON</el-button>
      <el-button v-if="isPreview" size="small" @click="goDesigner">继续编辑</el-button>
      <el-button size="small" @click="goHome">返回列表</el-button>
    </div>

    <div v-if="error" class="viewer__body">
      <el-result icon="warning" :title="error" :sub-title="errorTip">
        <template #extra>
          <el-button type="primary" :loading="loading" @click="load">重新加载</el-button>
          <el-button @click="goHome">返回页面列表</el-button>
          <el-button v-if="isPreview" @click="goDesigner">去设计器</el-button>
        </template>
      </el-result>
    </div>

    <div v-else v-loading="loading" class="viewer__body">
      <div class="viewer__card">
        <div class="lc-root">
          <!-- 运行态错误边界：个别组件异常不影响整页展示，避免线上白屏 -->
          <ErrorBoundary :reset-key="page?.revision || 0">
            <NodeRenderer v-for="child in children" :key="child.id" :node="child" />
          </ErrorBoundary>
        </div>
      </div>
      <div v-if="!isEmbed" style="text-align: center; font-size: 12px; color: #98a2b3; margin-top: 22px">
        Powered by LowCode Studio
        <template v-if="publishedAt"> · 发布于 {{ formatTime(publishedAt) }}</template>
      </div>
    </div>

    <el-drawer v-model="jsonVisible" title="页面 Schema" size="520px">
      <pre class="mono" style="font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all">{{
        JSON.stringify(page, null, 2)
      }}</pre>
    </el-drawer>
  </div>
</template>

<script setup>
/**
 * 页面运行态（C 端访问 / 设计器预览共用）
 * ------------------------------------------------------------
 * 功能：按路由参数加载页面，用渲染引擎输出最终页面，并接管表单模型与数据源。
 * 业务：这是「交付给最终用户看的东西」，稳定性优先级最高，因此：
 *   - 预览读草稿、公开访问读发布快照。两者数据源严格分开，避免未发布内容外泄；
 *   - 失败时区分「后端不通 / 超时 / 未发布 / 已删除」，直接告诉用户下一步该做什么，
 *     而不是笼统报错——线上没人会去看控制台；
 *   - 渲染包在错误边界里，单个组件 schema 异常只降级该组件，不整体白屏。
 *
 * 嵌入接入（被其它系统 iframe 引用）：
 *   地址带 ?embed=1 时进入嵌入模式——隐藏平台顶栏/署名、去掉卡片阴影与内边距、背景透明，
 *   看起来就是宿主系统里的一张表单；同时通过 postMessage 与父页面通信，
 *   上报内容高度（父页面据此调整 iframe 高度）、就绪状态与表单提交结果。
 *   传参预填通过 ?prefill=<base64url JSON> 注入，只覆盖页面里真实存在的字段。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pageApi } from '@/api'
import { buildFormModel, usePageRuntime } from '@/composables/usePageRuntime'
import { formatTime } from '@/utils/format'
import { applyPrefill, decodePrefill, postToHost, readUrlParams, startHeightReporter } from '@/utils/embed'
import NodeRenderer from '@/components/NodeRenderer.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loaded = ref(false)
const error = ref('')
/** 错误码用于区分「未发布」「后端不通」「超时」，给用户不同的指引 */
const errorCode = ref('')
const page = ref(null)
const jsonVisible = ref(false)
/** 嵌入模式下页面根节点，用于测量内容高度 */
const rootRef = ref(null)
/** 预填结果（应用了哪些字段、忽略了哪些），排障时通过控制台可见 */
const prefillInfo = ref(null)
let heightReporter = null

/** 运行态参数：同时兼容 # 之前与 # 之后的 query（详见 utils/embed.js 的说明） */
const params = computed(() => readUrlParams(route.query))
const isPreview = computed(() => params.value.preview === '1')
const isEmbed = computed(() => params.value.embed === '1')
const title = computed(() => page.value?.name || '')
const publishedAt = computed(() => page.value?.publishedAt || '')
const children = computed(() => page.value?.schema?.children || [])

provide('lcMode', ref('preview'))
const formModel = reactive({})
provide('lcForm', formModel)
const { data } = usePageRuntime(computed(() => page.value?.datasources || []))
provide('lcData', data)

const errorTip = computed(() => {
  if (errorCode.value === 'NETWORK' || errorCode.value === 'TIMEOUT') {
    return '无法连接后端服务。请确认已执行 npm run dev，且后端 3001 端口可访问，然后点击「重新加载」。'
  }
  if (errorCode.value === 'NOT_FOUND') {
    return isPreview.value
      ? '页面不存在或已被删除，请回到设计器确认。'
      : '该页面尚未发布，或已被删除。可前往设计器发布后再访问。'
  }
  return '请稍后重试；若持续失败，请联系管理员查看后端日志。'
})

onMounted(() => {
  if (isEmbed.value) {
    // 嵌入模式要透出宿主页面的背景，不能保留平台的浅灰底
    document.documentElement.classList.add('lc-embed')
    heightReporter = startHeightReporter(() => rootRef.value)
    // 握手：一个宿主页面可能嵌了多个低代码页面，父页面靠 pageId 区分是谁在说话
    postToHost('lc:hello', { pageId: route.params.id, url: window.location.href })
  }
  load()
})

onBeforeUnmount(() => {
  heightReporter?.stop()
  heightReporter = null
  document.documentElement.classList.remove('lc-embed')
})

/**
 * 加载页面
 * 业务：预览模式读草稿（自己看），正常访问读发布快照（C 端看），
 *      两者数据来源不同，不能混用——否则未发布内容会泄露给访问者。
 */
async function load() {
  loading.value = true
  error.value = ''
  try {
    page.value = isPreview.value ? await pageApi.get(route.params.id) : await pageApi.published(route.params.id)
    Object.keys(formModel).forEach((key) => delete formModel[key])
    Object.assign(formModel, buildFormModel(page.value.schema))
    prefillInfo.value = applyPrefillFromUrl()
    document.title = `${page.value.name} · LowCode Studio`
    loaded.value = true
    if (isEmbed.value) {
      // 等组件渲染完再量高度，否则拿到的是骨架屏/加载中的高度
      nextTick(() => heightReporter?.flush())
      postToHost('lc:ready', {
        pageId: page.value.id,
        name: page.value.name,
        // 必须是普通数组：ref 里取出的是响应式代理，postMessage 无法结构化克隆代理对象
        prefill: [...(prefillInfo.value?.applied || [])]
      })
    }
  } catch (err) {
    error.value = err.message || '页面加载失败'
    errorCode.value = err.code || ''
    // 嵌入模式下父系统看不到我们的界面，必须把失败原因告诉它，否则用户只看到一块空白
    if (isEmbed.value) {
      postToHost('lc:error', { pageId: route.params.id, message: error.value, code: errorCode.value })
      nextTick(() => heightReporter?.flush())
    }
  } finally {
    loading.value = false
  }
}

/**
 * 应用 URL 预填
 * 业务：其它系统常常已经知道「当前是谁」（工号、姓名、部门），
 *      跳转/嵌入时带过来就能省掉重复填写；这里只认页面里存在的字段，
 *      多余参数忽略并在控制台列出，便于对接方排查字段名写错的问题。
 */
function applyPrefillFromUrl() {
  const raw = params.value.prefill
  if (!raw) return null
  const decoded = decodePrefill(raw)
  if (!decoded) {
    console.warn('[embed] prefill 参数不是合法的 base64url JSON，已忽略')
    return { applied: [], skipped: [] }
  }
  const result = applyPrefill(formModel, decoded, page.value.schema)
  if (result.skipped.length) {
    console.info('[embed] 以下预填字段在页面中不存在，已忽略：', result.skipped)
  }
  return result
}

function goHome() {
  router.push('/')
}

function goDesigner() {
  router.push(`/designer/${route.params.id}`)
}
</script>

<style scoped>
/* 嵌入模式：去掉平台外壳的一切视觉痕迹，让页面像宿主系统自己的内容 */
.viewer--embed {
  min-height: 0;
  background: transparent;
}
.viewer--embed .viewer__body {
  max-width: none;
  padding: 0;
}
.viewer--embed .viewer__card {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
}
</style>
