<template>
  <div class="app-shell">
    <header class="app-header">
      <el-button text size="small" @click="goBack"><el-icon><ArrowLeft /></el-icon></el-button>
      <div class="brand" style="font-size: 14px">
        <span class="brand__logo" style="width: 24px; height: 24px; font-size: 11px">LC</span>
        <el-input
          :model-value="store.name"
          size="small"
          style="width: 190px"
          @update:model-value="store.setPageName"
        />
      </div>
      <el-tag size="small" :type="store.status === 'published' ? 'success' : 'info'" effect="plain">
        {{ store.status === 'published' ? '已发布' : '草稿' }}
      </el-tag>
      <!-- 业务提示：已发布页面又被修改过，提醒用户重新发布，否则线上仍是旧版本 -->
      <el-tag
        v-if="store.status === 'published' && store.revision > (store.publishedRevision || 0)"
        size="small"
        type="warning"
        effect="plain"
      >
        有未发布修改
      </el-tag>
      <el-tag v-if="store.dirty" size="small" type="warning" effect="plain">未保存</el-tag>

      <span class="grow" />

      <el-button-group>
        <el-tooltip content="撤销 (Ctrl+Z)" placement="bottom">
          <el-button size="small" :disabled="!store.canUndo" @click="store.undo()">
            <el-icon><RefreshLeft /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="重做 (Ctrl+Shift+Z)" placement="bottom">
          <el-button size="small" :disabled="!store.canRedo" @click="store.redo()">
            <el-icon><RefreshRight /></el-icon>
          </el-button>
        </el-tooltip>
      </el-button-group>

      <el-button size="small" @click="openTemplates">
        <el-icon><Files /></el-icon><span style="margin-left: 4px">模板</span>
      </el-button>
      <el-button size="small" @click="dsVisible = true">
        <el-icon><Coin /></el-icon><span style="margin-left: 4px">数据源</span>
        <el-tag v-if="store.datasources.length" size="small" type="primary" effect="plain" style="margin-left: 6px">
          {{ store.datasources.length }}
        </el-tag>
      </el-button>
      <el-tooltip content="使用说明（新手先看这个）" placement="bottom">
        <el-button size="small" @click="helpVisible = true"><el-icon><QuestionFilled /></el-icon></el-button>
      </el-tooltip>
      <el-tooltip
        content="打开后可像运行态一样试用下拉、输入、日期等控件；此模式下不能选中和拖动组件"
        placement="bottom"
      >
        <div
          class="interactive-toggle"
          :class="{ 'is-on': store.interactive }"
          @click="store.setInteractive(!store.interactive)"
        >
          <el-switch
            :model-value="store.interactive"
            size="small"
            @click.stop
            @update:model-value="store.setInteractive"
          />
          <span class="interactive-toggle__label">交互</span>
        </div>
      </el-tooltip>
      <el-button size="small" @click="preview"><el-icon><View /></el-icon><span style="margin-left: 4px">预览</span></el-button>
      <el-button size="small" type="success" plain @click="publish">
        <el-icon><Promotion /></el-icon><span style="margin-left: 4px">发布</span>
      </el-button>
      <el-button size="small" type="primary" :loading="store.saving" @click="save">
        <el-icon><Check /></el-icon><span style="margin-left: 4px">保存</span>
      </el-button>

      <el-dropdown trigger="click" @command="onCommand">
        <el-button size="small" text><el-icon><MoreFilled /></el-icon></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="export">导出页面 JSON</el-dropdown-item>
            <el-dropdown-item command="export-html">导出 HTML 代码</el-dropdown-item>
            <el-dropdown-item command="import">导入页面代码…</el-dropdown-item>
            <el-dropdown-item command="integration">接入其它系统…</el-dropdown-item>
            <el-dropdown-item command="clear" divided>清空画布</el-dropdown-item>
            <el-dropdown-item command="delete" divided>删除页面</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </header>

    <!-- 加载失败：给出原因和出口，而不是留在空白设计器里 -->
    <div v-if="loadError" class="list-page">
      <div class="list-inner">
        <el-result icon="warning" title="页面加载失败" :sub-title="loadError">
          <template #extra>
            <el-button type="primary" @click="reload">重新加载</el-button>
            <el-button @click="goBack">返回列表</el-button>
          </template>
        </el-result>
      </div>
    </div>

    <div v-else v-loading="store.loading" class="designer__body">
      <aside class="designer__left"><ComponentPanel /></aside>
      <main class="designer__center">
        <Canvas @open-templates="openTemplates" @open-help="helpVisible = true" />
        <div class="canvas-tip">
          <el-icon><InfoFilled /></el-icon>
          拖拽左侧组件到画布，选中后在右侧编辑属性 · Ctrl+Z 撤销 · Ctrl+S 保存 · 组件共
          {{ counts.nodes }} 个
          <span class="grow" />
          <el-button size="small" text type="primary" style="font-size: 12px" @click="openTemplates">套模板</el-button>
          <el-button size="small" text type="primary" style="font-size: 12px" @click="helpVisible = true">使用说明</el-button>
        </div>
      </main>
      <aside class="designer__right"><PropPanel /></aside>
    </div>

    <!-- 导入代码：先服务端校验再落到「新建页面」或「覆盖画布」，避免坏数据进平台 -->
    <ImportDialog
      v-model="importVisible"
      allow-overwrite
      @imported="onImported"
    />

    <el-drawer v-model="dsVisible" title="页面数据源" size="480px">
      <div style="padding: 0 4px 20px">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="数据源可被表格、下拉框等组件绑定；文本支持 {{数据源名.字段}} 插值"
          style="margin-bottom: 14px"
        />

        <div v-for="ds in store.datasources" :key="ds.id" class="ds-card">
          <div style="display: flex; gap: 8px; margin-bottom: 8px">
            <el-input
              :model-value="ds.name"
              size="small"
              placeholder="数据源名称，如 employees"
              @update:model-value="(v) => store.updateDatasource(ds.id, 'name', v)"
            />
            <el-select
              :model-value="ds.type"
              size="small"
              style="width: 96px"
              @update:model-value="(v) => store.updateDatasource(ds.id, 'type', v)"
            >
              <el-option label="静态 JSON" value="static" />
              <el-option label="接口 API" value="api" />
            </el-select>
            <el-button size="small" text type="danger" @click="store.removeDatasource(ds.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>

          <template v-if="ds.type === 'api'">
            <div style="display: flex; gap: 8px">
              <el-select
                :model-value="ds.method || 'GET'"
                size="small"
                style="width: 92px"
                @update:model-value="(v) => store.updateDatasource(ds.id, 'method', v)"
              >
                <el-option label="GET" value="GET" />
                <el-option label="POST" value="POST" />
              </el-select>
              <el-input
                :model-value="ds.url"
                size="small"
                placeholder="https://api.example.com/list"
                @update:model-value="(v) => store.updateDatasource(ds.id, 'url', v)"
              />
            </div>
            <div class="hint">返回 JSON 数组，或 {{ '{ data: [...] }' }} 结构</div>
          </template>

          <template v-else>
            <el-input
              :model-value="ds.json"
              type="textarea"
              :rows="7"
              size="small"
              class="mono"
              placeholder='[{"name":"张三","age":28}]'
              @update:model-value="(v) => store.updateDatasource(ds.id, 'json', v)"
            />
            <div class="hint">{{ jsonHint(ds.json) }}</div>
          </template>
        </div>

        <el-button style="width: 100%" plain @click="store.addDatasource()">
          <el-icon><Plus /></el-icon> 新增数据源
        </el-button>
      </div>
    </el-drawer>

    <!-- 套用模板：以「替换画布」的方式使用，覆盖前会二次确认，且可 Ctrl+Z 撤回 -->
    <TemplateDialog
      v-model="templateVisible"
      mode="apply"
      :submitting="applying"
      @submit="onTemplateSubmit"
    />

    <!-- 使用说明：首次进入设计器自动打开一次，用户可关闭自动弹出 -->
    <HelpDrawer
      v-model="helpVisible"
      v-model:auto-help="autoHelp"
      @open-templates="
        () => {
          helpVisible = false
          openTemplates()
        }
      "
      @open-integration="
        () => {
          helpVisible = false
          router.push('/integration')
        }
      "
    />
  </div>
</template>

<script setup>
/**
 * 可视化设计器
 * ------------------------------------------------------------
 * 功能：组装 组件面板 / 画布 / 属性面板 三栏，并承担页面级事务：
 *      加载与保存、发布与预览、数据源管理、JSON 导入导出、快捷键、离开保护。
 * 业务要点：
 *   1. 保存/预览/发布前都会先 save()——保证「看到的就能存到、能发出去」；
 *      保存失败（比如用户取消了冲突覆盖）时中止后续动作，避免把旧数据发上线；
 *   2. Ctrl+Z / Ctrl+Shift+Z / Ctrl+S / Delete 快捷键与主流编辑器对齐；
 *      输入框聚焦时不拦截 Delete，否则会误删组件；
 *   3. beforeunload + 路由守卫双层拦截未保存修改；
 *   4. 导入导出是「交付通道」：导出 JSON 用于跨环境迁移/备份，导出 HTML 是可独立运行的单文件代码，
 *      导入统一走服务端校验，并区分「新建页面」与「覆盖画布」两种落点；
 *   5. 新用户引导分两层：空画布上的可操作引导（套模板/自己拖/看说明）+ 首次打开空页面时自动弹出的使用说明，
 *      两者都指向真实的模板与应用内文档，不需要外部资料。
 */
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDesignerStore } from '@/stores/designer'
import { pageApi, templateApi } from '@/api'
import { buildFormModel, usePageRuntime } from '@/composables/usePageRuntime'
import { countNodes } from '@/utils/tree'
import { buildPagePackage, downloadPageHtml, downloadPageJson } from '@/utils/pageCode'
import ComponentPanel from '@/components/designer/ComponentPanel.vue'
import Canvas from '@/components/designer/Canvas.vue'
import PropPanel from '@/components/designer/PropPanel.vue'
import TemplateDialog from '@/components/TemplateDialog.vue'
import ImportDialog from '@/components/ImportDialog.vue'
import HelpDrawer from '@/components/HelpDrawer.vue'

const route = useRoute()
const router = useRouter()
const store = useDesignerStore()

const dsVisible = ref(false)
/** 导入弹窗 */
const importVisible = ref(false)
/** 加载失败原因：页面不存在 / 后端未启动 / 超时，都要区分开告诉用户 */
const loadError = ref('')
const templateVisible = ref(false)
const helpVisible = ref(false)
const applying = ref(false)
/** 说明抽屉的自动弹出开关，持久化到本地，避免每次都打扰熟手 */
const HELP_AUTO_KEY = 'lc_help_auto'
const autoHelp = ref(localStorage.getItem(HELP_AUTO_KEY) !== 'off')

watch(autoHelp, (value) => localStorage.setItem(HELP_AUTO_KEY, value ? 'on' : 'off'))

const formModel = reactive({})
provide('lcMode', ref('design'))
provide('lcForm', formModel)
const { data } = usePageRuntime(computed(() => store.datasources))
provide('lcData', data)

const counts = computed(() => ({ nodes: countNodes(store.schema) }))

function syncFormModel() {
  Object.keys(formModel).forEach((key) => delete formModel[key])
  Object.assign(formModel, buildFormModel(store.schema))
}

onMounted(async () => {
  await loadPage()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  maybeAutoHelp()
})

/**
 * 同一路由下切换页面 id（例如在设计器里改地址、或浏览器前进后退）
 * 业务：Vue 会复用同一个组件实例，onMounted 不会再执行。
 *      如果不处理，画布会残留上一个页面的内容，接着保存就会把 A 页面写进 B 页面——
 *      这是会造成数据错乱的真实风险，所以这里显式监听并重新加载。
 *      有未保存修改时先征得用户同意，避免静默丢改动。
 */
watch(
  () => route.params.id,
  async (id, oldId) => {
    if (!id || id === oldId) return
    if (store.dirty) {
      try {
        await ElMessageBox.confirm('切换页面会丢弃当前未保存的修改，确定继续？', '有未保存的修改', {
          confirmButtonText: '放弃并切换',
          cancelButtonText: '留在此页',
          type: 'warning'
        })
      } catch {
        // 用户选择留下：把地址恢复回去，保持界面与 URL 一致
        router.replace(`/designer/${oldId}`)
        return
      }
    }
    await loadPage()
    syncFormModel()
    maybeAutoHelp()
  }
)

/** 空页面首次进入时自动展开使用说明；已有内容的页面不打扰 */
function maybeAutoHelp() {
  if (!loadError.value && autoHelp.value && !store.schema.children.length) helpVisible.value = true
}

/** 进入设计器时加载页面；失败时展示可重试的错误态 */
async function loadPage() {
  loadError.value = ''
  try {
    await store.load(route.params.id)
    syncFormModel()
  } catch (err) {
    loadError.value = err.message
  }
}

async function reload() {
  await loadPage()
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

onBeforeRouteLeave(async () => {
  if (!store.dirty) return true
  try {
    await ElMessageBox.confirm('当前页面有未保存的修改，确定离开吗？', '提示', {
      type: 'warning',
      confirmButtonText: '离开',
      cancelButtonText: '继续编辑'
    })
    return true
  } catch {
    return false
  }
})

function onBeforeUnload(event) {
  if (!store.dirty) return
  event.preventDefault()
  event.returnValue = ''
}

function onKeydown(event) {
  const ctrl = event.ctrlKey || event.metaKey
  const tag = (document.activeElement?.tagName || '').toUpperCase()
  const typing = ['INPUT', 'TEXTAREA'].includes(tag)

  if (ctrl && event.key.toLowerCase() === 's') {
    event.preventDefault()
    save()
  } else if (ctrl && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    event.shiftKey ? store.redo() : store.undo()
  } else if ((event.key === 'Delete' || event.key === 'Backspace') && !typing && store.selectedId !== 'root') {
    event.preventDefault()
    store.removeNodeById(store.selectedId)
  }
}

/**
 * 保存
 * 业务：正常情况下直接保存；若服务端返回 409（别人先保存过），
 *      必须让用户明确选择「覆盖」还是「放弃」，绝不能静默覆盖他人成果。
 */
async function save() {
  try {
    await store.save()
    ElMessage.success('已保存')
    syncFormModel()
  } catch (err) {
    if (err.code === 'REVISION_CONFLICT') {
      await resolveConflict()
      return
    }
    ElMessage.error(err.message)
  }
}

/** 并发编辑冲突的处理 */
async function resolveConflict() {
  try {
    await ElMessageBox.confirm(
      '该页面已在其他窗口或他人处被修改。选择「以我的版本覆盖」会丢弃对方的修改；取消后请刷新页面获取最新版本。',
      '保存冲突',
      { confirmButtonText: '以我的版本覆盖', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    ElMessage.warning('已取消保存，建议刷新页面后再编辑')
    return
  }
  try {
    await store.forceOverwrite()
    ElMessage.success('已覆盖保存')
    syncFormModel()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

/**
 * 发布
 * 业务：发布 = 生成线上快照。草稿的后续修改不会影响已发布页面，
 *      直到用户再次点击发布，因此发布成功后要记录 publishedRevision。
 */
async function publish() {
  await save()
  // 保存失败（例如用户取消了覆盖）时不继续发布，避免把旧内容发上线
  if (store.dirty) return
  try {
    const res = await pageApi.publish(store.pageId)
    store.status = 'published'
    store.publishedRevision = res.publishedRevision ?? store.revision
    ElMessage.success('发布成功，页面链接已可访问')
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function preview() {
  await save()
  if (store.dirty) return
  window.open(`${location.origin}${location.pathname}#/view/${store.pageId}?preview=1`, '_blank')
}

function goBack() {
  router.push('/')
}

// ---------------------------------------------------------------- 模板

function openTemplates() {
  templateVisible.value = true
}

/**
 * 套用模板
 * 业务：设计器里的「套用模板」是覆盖式操作，因此：
 *   1. 画布已有内容时先二次确认，明确告知会覆盖（但可 Ctrl+Z 撤回）；
 *   2. 内容从 /templates/:id 现取，保证拿到的是最新模板；
 *   3. 套用后不自动保存——用户可能只是看看效果，保存由他自己决定。
 */
async function onTemplateSubmit(payload) {
  const hasContent = store.schema.children.length > 0
  if (hasContent) {
    try {
      await ElMessageBox.confirm(
        `当前画布已有 ${counts.value.nodes} 个组件，套用「${payload.template.name}」会覆盖现有内容。套用后可以按 Ctrl+Z 撤回。`,
        '确认覆盖画布',
        { confirmButtonText: '覆盖并套用', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }

  applying.value = true
  try {
    const full = await templateApi.get(payload.templateId)
    store.applyTemplate(full)
    syncFormModel()
    templateVisible.value = false
    ElMessage.success('模板已套用，改文字和字段就能用；记得点保存')
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    applying.value = false
  }
}

function onCommand(command) {
  if (command === 'export') exportJson()
  if (command === 'export-html') exportHtml()
  if (command === 'import') importVisible.value = true
  // 接入指南是独立页面：跳转前由路由守卫拦截未保存修改，不会静默丢内容
  if (command === 'integration') router.push('/integration')
  if (command === 'clear') clearCanvas()
  if (command === 'delete') deletePage()
}

/** 构造导出包：导出的是「当前画布」而非已保存版本，避免导出内容与屏幕不一致 */
function currentPackage() {
  return buildPagePackage({
    name: store.name,
    description: store.description,
    schema: store.schema,
    datasources: store.datasources
  })
}

/**
 * 导出页面 JSON
 * 业务：这是跨环境迁移与版本归档的标准交付物（format/version 保证未来可导入）；
 *      空页面也允许导出——用户可能只是想备份一个刚建好的空壳。
 */
function exportJson() {
  downloadPageJson(currentPackage())
  ElMessage.success('已导出页面 JSON，可在任意环境用「导入页面代码」还原')
}

/**
 * 导出 HTML 代码
 * 业务：生成可直接双击运行的单文件页面，适合交付给开发、客户或归档；
 *      文件内嵌了页面结构与渲染逻辑，只依赖 CDN 上的 Vue3 / Element Plus。
 */
function exportHtml() {
  downloadPageHtml(currentPackage())
  ElMessage.success('已导出 HTML 代码，双击即可运行（首次打开需联网加载 Vue3 / Element Plus）')
}

/**
 * 导入完成
 * create：服务端已建好新页面 → 跳转到该页面继续编辑；
 * overwrite：只替换画布内容，页面本身不变，且可 Ctrl+Z 撤回（覆盖前二次确认）。
 */
async function onImported(result) {
  if (result.mode === 'create' && result.page?.id) {
    ElMessage.success(`已导入「${result.page.name}」`)
    router.push(`/designer/${result.page.id}`)
    return
  }
  if (result.mode !== 'overwrite') return

  try {
    await ElMessageBox.confirm(
      `将用导入内容替换当前画布（当前 ${counts.value.nodes} 个组件、${store.datasources.length} 个数据源）。` +
        '覆盖不会立即保存，导入后可以按 Ctrl+Z 撤回，确认无误再点保存。',
      '确认覆盖画布',
      { confirmButtonText: '覆盖画布', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  try {
    store.importSchema({ schema: result.pkg.schema, datasources: result.pkg.datasources })
    syncFormModel()
    ElMessage.success(`已导入 ${result.summary?.nodes ?? counts.value.nodes} 个组件，可继续编辑或撤销`)
  } catch (err) {
    ElMessage.error(`导入失败：${err.message}`)
  }
}

async function clearCanvas() {
  try {
    await ElMessageBox.confirm('确定清空画布上的所有组件？', '清空画布', { type: 'warning' })
  } catch {
    return
  }
  store.clearCanvas()
}

async function deletePage() {
  try {
    await ElMessageBox.confirm(`确定删除「${store.name}」？该操作不可恢复。`, '删除页面', { type: 'warning' })
  } catch {
    return
  }
  try {
    await pageApi.remove(store.pageId)
    store.dirty = false
    ElMessage.success('已删除')
    router.push('/')
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function jsonHint(text) {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return `已解析：${parsed.length} 条记录`
    return '已解析：对象'
  } catch (e) {
    return 'JSON 格式有误，组件将取不到数据'
  }
}
</script>
