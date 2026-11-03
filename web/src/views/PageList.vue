<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="brand__logo">LC</span>
        LowCode Studio
        <span class="brand__sub">可视化低代码平台</span>
      </div>
      <span class="grow" />
      <el-input
        v-model="keyword"
        placeholder="搜索页面"
        size="small"
        clearable
        style="width: 220px"
        @keyup.enter="load"
        @clear="load"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button size="small" @click="load"><el-icon><Refresh /></el-icon></el-button>
      <el-button size="small" @click="goSpec">
        <el-icon><Brush /></el-icon><span style="margin-left: 4px">设计规范</span>
      </el-button>
      <el-button size="small" @click="goIntegration">
        <el-icon><Connection /></el-icon><span style="margin-left: 4px">接入指南</span>
      </el-button>
      <el-button size="small" @click="importVisible = true">
        <el-icon><Upload /></el-icon><span style="margin-left: 4px">导入</span>
      </el-button>
      <el-button type="primary" size="small" @click="openCreate">
        <el-icon><Plus /></el-icon><span style="margin-left: 4px">新建页面</span>
      </el-button>
    </header>

    <div class="list-page">
      <div class="list-inner">
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-card__label">页面总数</div>
            <div class="stat-card__value">{{ stats.pages }}<small>个</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">已发布</div>
            <div class="stat-card__value" style="color: #12b76a">{{ stats.published }}<small>个</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">草稿</div>
            <div class="stat-card__value">{{ stats.draft }}<small>个</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">组件实例</div>
            <div class="stat-card__value">{{ stats.nodes }}<small>个</small></div>
          </div>
        </div>

        <el-alert
          v-if="loadError"
          type="error"
          :closable="false"
          show-icon
          :title="`列表加载失败：${loadError}`"
          style="margin-bottom: 14px"
        >
          <template #default>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px">
              <span style="font-size: 12px">请确认后端服务已启动（npm run dev，默认 3001 端口）</span>
              <el-button size="small" type="primary" plain @click="load">重新加载</el-button>
            </div>
          </template>
        </el-alert>

        <div class="panel">
          <div class="panel__head">
            <span class="panel__title">我的页面</span>
            <el-tag size="small" type="info" effect="plain">{{ pages.length }}</el-tag>
            <span class="grow" />
            <span class="hint">数据由 Node 服务持久化到 data/pages.json</span>
          </div>

          <div class="panel__body" v-loading="loading">
            <div v-for="page in pages" :key="page.id" class="page-row" @click="design(page.id)">
              <div class="page-row__icon"><el-icon><Grid /></el-icon></div>
              <div class="page-row__main">
                <div class="page-row__name">
                  {{ page.name }}
                  <el-tag v-if="page.status === 'published'" size="small" type="success" effect="light">已发布</el-tag>
                  <el-tag v-else size="small" type="info" effect="plain">草稿</el-tag>
                </div>
                <div class="page-row__desc">{{ page.description || '暂无描述' }}</div>
              </div>
              <div class="page-row__meta">
                <span>{{ page.nodeCount }} 组件</span>
                <span>更新于 {{ formatTime(page.updatedAt) }}</span>
              </div>
              <div class="page-row__ops" @click.stop>
                <el-tooltip content="可视化设计" placement="top">
                  <el-button size="small" text @click="design(page.id)"><el-icon><EditPen /></el-icon></el-button>
                </el-tooltip>
                <el-tooltip content="预览运行效果" placement="top">
                  <el-button size="small" text @click="preview(page)"><el-icon><View /></el-icon></el-button>
                </el-tooltip>
                <el-tooltip :content="page.status === 'published' ? '撤回发布' : '发布页面'" placement="top">
                  <el-button size="small" text @click="togglePublish(page)">
                    <el-icon><Promotion /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip content="复制" placement="top">
                  <el-button size="small" text @click="duplicate(page)"><el-icon><CopyDocument /></el-icon></el-button>
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button size="small" text type="danger" @click="remove(page)"><el-icon><Delete /></el-icon></el-button>
                </el-tooltip>
              </div>
            </div>

            <div v-if="!pages.length && !loading && !loadError" class="empty-block">
              <el-empty description="还没有页面，先创建一个吧" :image-size="90">
                <el-button type="primary" @click="openCreate">新建页面</el-button>
              </el-empty>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建页面 = 选模板 + 起名字。模板弹窗里直接说明「怎么改成自己的业务」，
         避免新建后面对空白画布无从下手 -->
    <TemplateDialog v-model="createVisible" mode="create" :submitting="creating" @submit="submitCreate" />

    <!-- 导入：只能新建页面（列表页没有「当前画布」可覆盖） -->
    <ImportDialog v-model="importVisible" @imported="onImported" />
  </div>
</template>

<script setup>
/**
 * 页面列表（工作台首页）
 * ------------------------------------------------------------
 * 功能：页面 CRUD 的入口 + 平台运营指标概览。
 * 业务：
 *   1. 列表操作区分「设计（进编辑器）」与「预览（看运行效果）」两条路径，
 *      这是低代码平台最高频的两个动作，必须一键直达；
 *   2. 删除需要二次确认（ElMessageBox），不可恢复的操作必须留后悔时间；
 *   3. 后端不可用时展示错误横幅而不是「暂无页面」——
 *      把服务故障伪装成空数据是线上最常见的误导性设计。
 */
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pageApi } from '@/api'
import { formatTime } from '@/utils/format'
import TemplateDialog from '@/components/TemplateDialog.vue'
import ImportDialog from '@/components/ImportDialog.vue'

const router = useRouter()
const loading = ref(false)
const creating = ref(false)
const createVisible = ref(false)
const importVisible = ref(false)
const keyword = ref('')
const pages = ref([])
/** 列表加载失败原因：后端未启动时不能显示「还没有页面」，那是误导 */
const loadError = ref('')
const stats = reactive({ pages: 0, published: 0, draft: 0, nodes: 0, datasources: 0 })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    pages.value = await pageApi.list(keyword.value)
    Object.assign(stats, await pageApi.stats())
  } catch (err) {
    loadError.value = err.message
    pages.value = []
  } finally {
    loading.value = false
  }
}

function design(id) {
  router.push(`/designer/${id}`)
}

function preview(page) {
  window.open(`${location.origin}${location.pathname}#/view/${page.id}`, '_blank')
}

/** 接入指南：面向「要把页面放进已有业务系统」的人，和日常设计是两条使用路径 */
function goIntegration() {
  router.push('/integration')
}

/** 设计规范页：令牌活文档，设计与前端共用 */
function goSpec() {
  router.push('/spec')
}

function openCreate() {
  createVisible.value = true
}

/**
 * 创建页面
 * 业务：带上 templateId，由后端按模板生成 schema 与数据源——
 *      前端不自己拼 schema，避免校验规则散落在两端。
 */
async function submitCreate(payload) {
  if (!payload?.name?.trim()) return ElMessage.warning('请输入页面名称')
  creating.value = true
  try {
    const page = await pageApi.create({
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      templateId: payload.templateId
    })
    createVisible.value = false
    ElMessage.success('页面已创建，模板内容可直接修改')
    router.push(`/designer/${page.id}`)
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    creating.value = false
  }
}

/**
 * 导入完成
 * 业务：列表页导入只能新建页面，创建成功后直接进入设计器，
 *      让用户先确认内容再决定是否保存/发布（导入不会自动发布）。
 */
function onImported(result) {
  if (result.mode !== 'create' || !result.page?.id) return
  ElMessage.success(`已导入「${result.page.name}」`)
  router.push(`/designer/${result.page.id}`)
}

async function togglePublish(page) {  try {
    if (page.status === 'published') {
      await pageApi.unpublish(page.id)
      ElMessage.success('已撤回发布')
    } else {
      await pageApi.publish(page.id)
      ElMessage.success('发布成功，可通过 /view 链接访问')
    }
    await load()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function duplicate(page) {
  try {
    await pageApi.duplicate(page.id)
    ElMessage.success('已复制')
    await load()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function remove(page) {
  try {
    await ElMessageBox.confirm(`确定删除「${page.name}」？该操作不可恢复。`, '删除页面', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await pageApi.remove(page.id)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

onMounted(load)
</script>
