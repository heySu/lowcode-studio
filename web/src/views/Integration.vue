<template>
  <div class="app-shell">
    <header class="app-header">
      <el-button text size="small" @click="goHome"><el-icon><ArrowLeft /></el-icon></el-button>
      <div class="brand" style="font-size: 14px">
        <span class="brand__logo" style="width: 24px; height: 24px; font-size: 11px">LC</span>
        接入其它系统
        <span class="brand__sub">把做好的页面放进已有业务系统</span>
      </div>
      <span class="grow" />
      <el-button size="small" @click="helpVisible = true">
        <el-icon><QuestionFilled /></el-icon><span style="margin-left: 4px">使用说明</span>
      </el-button>
      <el-button size="small" type="primary" @click="goHome">
        <el-icon><Grid /></el-icon><span style="margin-left: 4px">返回页面列表</span>
      </el-button>
    </header>

    <div class="doc">
      <div class="doc__inner">
        <!-- 左侧目录：长文档必须能直接跳到关心的那一节 -->
        <aside class="doc__nav">
          <div class="doc__nav-title">目录</div>
          <button
            v-for="item in toc"
            :key="item.id"
            class="doc__nav-item"
            :class="{ 'is-active': activeSection === item.id }"
            @click="scrollTo(item.id)"
          >
            {{ item.title }}
          </button>
          <div class="doc__nav-foot">
            <div>还没发布页面？</div>
            <el-button size="small" text type="primary" @click="goHome">先去发布一个 →</el-button>
          </div>
        </aside>

        <main class="doc__main">
          <!-- 概览 -->
          <section id="overview" class="doc__section">
            <h1 class="doc__h1">把低代码页面接入你的系统</h1>
            <p class="doc__lead">
              平台产出的页面本身就是一张可运行的网页。接入其它系统不需要对方懂本平台，
              三种方式覆盖绝大多数场景，先按用途选一种：
            </p>
            <el-table :data="approachRows" size="small" border class="doc__table">
              <el-table-column prop="way" label="方式" width="130" />
              <el-table-column prop="scene" label="适合的场景" width="220" />
              <el-table-column prop="feature" label="特点" />
            </el-table>
            <el-alert type="info" :closable="false" show-icon style="margin-top: 12px">
              <template #title>
                推荐：内部系统的菜单页/详情页用 <b>iframe 嵌入</b>（无平台外壳、自动高度、可传参、提交结果可回传）；
                对外独立页面用 <b>链接跳转</b>；要交付给客户或脱离平台部署用 <b>导出单文件</b>。
              </template>
            </el-alert>
          </section>

          <!-- 准备 -->
          <section id="prepare" class="doc__section">
            <h2 class="doc__h2">一、接入前：先发布，再拿地址</h2>
            <div class="doc__steps">
              <div v-for="(step, index) in prepareSteps" :key="step.title" class="doc__step">
                <span class="doc__step-index">{{ index + 1 }}</span>
                <div>
                  <div class="doc__step-title">{{ step.title }}</div>
                  <div class="doc__step-text">{{ step.text }}</div>
                </div>
              </div>
            </div>
            <p class="doc__p">地址规则（注意 <code>#</code> 的位置，参数写在 <code>#</code> 之前才会影响服务端是否允许嵌入）：</p>
            <pre class="doc__code">{{ urlRule }}</pre>
            <el-alert
              type="warning"
              :closable="false"
              show-icon
              title="没发布就嵌入，访问者会看到「该页面尚未发布」。发布后再改内容，必须重新点一次「发布」，线上不会自动跟着变。"
            />
          </section>

          <!-- iframe 生成器 -->
          <section id="iframe" class="doc__section">
            <h2 class="doc__h2">二、iframe 嵌入（推荐）</h2>
            <p class="doc__p">
              选一个已发布的页面，按需勾选自动高度、填写要预填的表单值，下面会生成可直接粘贴的代码。
            </p>

            <div class="gen">
              <div class="gen__form">
                <div class="gen__field">
                  <label>嵌入哪个页面（仅列已发布）</label>
                  <el-select v-model="selectedId" size="small" placeholder="选择页面" style="width: 100%" :loading="loading">
                    <el-option v-for="page in publishedPages" :key="page.id" :label="page.name" :value="page.id" />
                  </el-select>
                  <div v-if="!loading && !publishedPages.length" class="gen__hint is-warn">
                    还没有已发布页面，先回列表发布一个再回来。
                  </div>
                </div>

                <div class="gen__field">
                  <label>预填表单值（可选，JSON，键=页面字段名）</label>
                  <el-input
                    v-model="prefillText"
                    type="textarea"
                    :rows="4"
                    size="small"
                    spellcheck="false"
                    placeholder='{ "name": "张三", "dept": "研发部" }'
                  />
                  <div v-if="prefillError" class="gen__hint is-error">{{ prefillError }}</div>
                  <div v-else class="gen__hint">只覆盖页面里真实存在的字段；多余字段会被忽略。</div>
                </div>

                <div class="gen__switches">
                  <el-checkbox v-model="autoHeight">自动高度（随内容伸缩，避免内层滚动条）</el-checkbox>
                  <el-checkbox v-model="withSubmitHook">同时生成「提交结果回传」监听代码</el-checkbox>
                </div>
              </div>

              <div class="gen__preview">
                <div class="gen__preview-head">
                  <span>嵌入效果</span>
                  <el-button size="small" text type="primary" :disabled="!embedUrl" @click="openEmbed">新窗口打开</el-button>
                </div>
                <div class="gen__frame-wrap" :class="{ 'is-auto': autoHeight }">
                  <iframe v-if="embedUrl" :key="embedUrl" :src="embedUrl" title="嵌入预览" class="gen__frame" />
                  <el-empty v-else description="选择页面后这里显示嵌入效果" :image-size="60" />
                </div>
              </div>
            </div>

            <div class="doc__code-block">
              <div class="doc__code-head">
                <span>粘贴到对方系统的 HTML 里</span>
                <el-button size="small" text type="primary" @click="copy(embedCode, '嵌入代码')">复制</el-button>
              </div>
              <pre class="doc__code">{{ embedCode }}</pre>
            </div>

            <p class="doc__p">
              页面里能正常用下拉、日期、表格，和单独打开完全一致；区别只是没有平台顶栏，
              背景透明，宽度跟随容器。
            </p>
          </section>

          <!-- 传参与回传 -->
          <section id="params" class="doc__section">
            <h2 class="doc__h2">三、传参：把「当前是谁」带进来</h2>
            <p class="doc__p">
              地址上加 <code>prefill</code> 参数即可预填表单。值必须是 JSON 的 base64url 编码
              （中文和 <code>&amp;</code> 不会被 URL 拆坏），父系统生成参数照抄这段：
            </p>
            <div class="doc__code-block">
              <div class="doc__code-head">
                <span>父系统侧生成 prefill 参数</span>
                <el-button size="small" text type="primary" @click="copy(prefillSnippet, '生成代码')">复制</el-button>
              </div>
              <pre class="doc__code">{{ prefillSnippet }}</pre>
            </div>
            <div class="doc__code-block">
              <div class="doc__code-head">
                <span>拼接后的地址（可直接 iframe / window.open）</span>
                <el-button size="small" text type="primary" @click="copy(prefillUrl, '地址')">复制</el-button>
              </div>
              <pre class="doc__code">{{ prefillUrl }}</pre>
            </div>
            <div class="doc__hint-box">
              字段名要和设计器里表单控件的「字段名」一致（右侧属性面板可查）。传了页面里没有的字段不会报错，会被忽略，
              并在浏览器控制台列出来，方便对接时排查。
            </div>

            <h3 class="doc__h3">页面 → 宿主系统的消息（postMessage）</h3>
            <p class="doc__p">
              嵌入后页面会主动向父窗口发消息，宿主可据此调高度、刷新列表、关闭弹窗。消息格式统一为
              <code>{ source: 'lowcode-studio', type, ... }</code>，收到后请先校验 <code>event.source</code>
              是目标 iframe，避免别的 iframe 伪造。
            </p>
            <el-table :data="messageRows" size="small" border class="doc__table">
              <el-table-column prop="type" label="type" width="130" />
              <el-table-column prop="when" label="触发时机" width="200" />
              <el-table-column prop="payload" label="携带字段" />
            </el-table>
            <div class="doc__code-block">
              <div class="doc__code-head">
                <span>宿主系统监听（复制即用）</span>
                <el-button size="small" text type="primary" @click="copy(listenSnippet, '监听代码')">复制</el-button>
              </div>
              <pre class="doc__code">{{ listenSnippet }}</pre>
            </div>
          </section>

          <!-- 数据对接 -->
          <section id="data" class="doc__section">
            <h2 class="doc__h2">四、数据对接：读你的数据、写回你的系统</h2>

            <h3 class="doc__h3">1. 页面展示你系统的数据</h3>
            <ol class="doc__list">
              <li>设计器点「数据源 → 新增」，类型选 <b>接口 API</b>，填完整地址；</li>
              <li>接口返回数组，或 <code>{ "data": [...] }</code> 结构，两种都能识别；</li>
              <li>表格选这个数据源；下拉/单选/多选作为「选项数据源」；文本用 <code>{{ interpolationExample }}</code> 插值。</li>
            </ol>
            <el-alert type="warning" :closable="false" show-icon style="margin: 10px 0">
              <template #title>
                接口要允许页面所在域名跨域（CORS）。浏览器直连无法安全保存密钥，
                需要鉴权的数据请由你的后端做同域代理，或提供只读、按 token 限流的接口。
              </template>
            </el-alert>

            <h3 class="doc__h3">2. 表单提交写回你系统</h3>
            <p class="doc__p">
              选中按钮 → 右侧「事件」→ 动作选 <b>请求接口</b>，填你的接收地址、方法，
              打开「提交时带上表单数据」。请求体就是表单字段组成的 JSON：
            </p>
            <pre class="doc__code">{{ submitPayload }}</pre>
            <div class="doc__code-block">
              <div class="doc__code-head">
                <span>接收端示例（Node / Express，含 CORS 与幂等建议）</span>
                <el-button size="small" text type="primary" @click="copy(serverSnippet, '后端示例')">复制</el-button>
              </div>
              <pre class="doc__code">{{ serverSnippet }}</pre>
            </div>
            <ul class="doc__list">
              <li>接收地址可以是绝对地址（<code>https://erp.example.com/api/employee</code>），也可以是相对路径（同域部署时）；</li>
              <li>返回 <code>{ "success": true }</code> 视为成功，页面提示「提交成功」并可把结果回传给宿主；</li>
              <li>返回非 2xx 或 <code>success: false</code> 时，页面提示错误信息（取响应里的 <code>message</code>）。</li>
            </ul>
          </section>

          <!-- 快照接口 -->
          <section id="snapshot" class="doc__section">
            <h2 class="doc__h2">五、读取页面快照（自行渲染 / 做数据同步）</h2>
            <p class="doc__p">
              如果不想 iframe，也可以只取页面结构自己渲染。这个接口只返回<b>已发布快照</b>，
              草稿永远不会通过它泄露：
            </p>
            <pre class="doc__code">{{ snapshotRequest }}</pre>
            <pre class="doc__code">{{ snapshotResponse }}</pre>
            <ul class="doc__list">
              <li>未发布或页面不存在：<code>404</code>，返回 <code>{ "success": false, "message": "该页面尚未发布…" }</code>；</li>
              <li>响应带 <code>Cache-Control: max-age=30</code>，改完重新发布后最多 30 秒生效；</li>
              <li>结构说明：<code>schema</code> 是组件树，<code>datasources</code> 是页面数据源；节点字段为
                <code>id / type / props / style / children</code>。</li>
            </ul>
          </section>

          <!-- 部署与安全 -->
          <section id="deploy" class="doc__section">
            <h2 class="doc__h2">六、部署与安全清单</h2>
            <div class="checklist">
              <div v-for="item in checklist" :key="item.title" class="checklist__item">
                <el-icon class="checklist__icon"><CircleCheck /></el-icon>
                <div>
                  <div class="checklist__title">{{ item.title }}</div>
                  <div class="checklist__text">{{ item.text }}</div>
                </div>
              </div>
            </div>
          </section>

          <!-- FAQ -->
          <section id="faq" class="doc__section">
            <h2 class="doc__h2">七、常见问题</h2>
            <el-collapse>
              <el-collapse-item v-for="item in faqs" :key="item.q" :title="item.q">
                <div class="doc__p" style="margin: 0">{{ item.a }}</div>
              </el-collapse-item>
            </el-collapse>
          </section>

          <div class="doc__foot">
            仍有对不上的地方？先看浏览器控制台与 Network：嵌入相关的问题基本都能从
            <code>X-Frame-Options</code> / CORS 报错 / <code>lc:error</code> 消息三处定位。
          </div>
        </main>
      </div>
    </div>

    <HelpDrawer v-model="helpVisible" :auto-help="false" @open-templates="goHome" />
  </div>
</template>

<script setup>
/**
 * 接入指南
 * ------------------------------------------------------------
 * 功能：讲清「怎么把平台做好的页面接进别的系统」，并直接给出可复制的代码。
 * 业务：低代码平台的价值不在「能拖出页面」，而在「页面能被现有业务系统用起来」。
 *      文档里每一段代码都对应真实能力（embed 模式、prefill 传参、postMessage 协议、
 *      发布快照接口、请求接口动作），避免写一份看起来完整但对不上的说明书。
 *      生成器里的地址随当前部署环境变化，用户复制走的就是当下可用的地址。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { pageApi } from '@/api'
import { encodePrefill } from '@/utils/embed'
import HelpDrawer from '@/components/HelpDrawer.vue'

const router = useRouter()

const loading = ref(false)
const pages = ref([])
const selectedId = ref('')
const prefillText = ref('')
const autoHeight = ref(true)
const withSubmitHook = ref(false)
const helpVisible = ref(false)
const activeSection = ref('overview')

const toc = [
  { id: 'overview', title: '选哪种接入方式' },
  { id: 'prepare', title: '接入前：发布与地址' },
  { id: 'iframe', title: 'iframe 嵌入' },
  { id: 'params', title: '传参与会话回传' },
  { id: 'data', title: '数据对接' },
  { id: 'snapshot', title: '读取页面快照' },
  { id: 'deploy', title: '部署与安全清单' },
  { id: 'faq', title: '常见问题' }
]

const approachRows = [
  {
    way: 'iframe 嵌入',
    scene: '已有系统加一个菜单/详情页',
    feature: '无平台外壳、自动高度、可预填表单、提交结果回传宿主；改动最小'
  },
  { way: '链接跳转', scene: '独立页面、对外分享', feature: '一行链接即可；带平台顶栏，适合直接给人看' },
  { way: '导出单文件', scene: '交付客户、离线演示、自有服务器部署', feature: '不依赖本平台；但没有数据回写与统一维护' }
]

const prepareSteps = [
  { title: '保存并发布', text: '发布生成一份线上快照，访问者看到的永远是最近一次发布的版本。' },
  { title: '复制访问地址', text: '列表页「预览」打开后，地址栏里 #/view/页面ID 这一段就是页面地址。' },
  { title: '确认对方能访问', text: '内网系统要保证宿主页面和本平台在同一网络内可达；跨网需配置代理或对外域名。' }
]

/** 站点根地址：兼容部署在子路径（如 /lc/）的情况 */
const siteBase = (() => {
  const path = window.location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '')
  return window.location.origin + path
})()

/** 地址规则：embed 参数必须放在 # 之前，服务端才知道这个文档要允许被 iframe 引用 */
const urlRule = `普通访问：${siteBase}/#/view/页面ID
嵌入访问：${siteBase}/?embed=1#/view/页面ID
带参预填：${siteBase}/?embed=1&prefill=编码后的值#/view/页面ID`

const publishedPages = computed(() => pages.value.filter((page) => page.status === 'published'))

/** 插值示例写成常量：直接写在模板里会被 Vue 当成表达式解析 */
const interpolationExample = '{{数据源名.字段}}'

const selectedPage = computed(() => publishedPages.value.find((page) => page.id === selectedId.value) || null)

/** prefill JSON 解析：格式错误就不生成地址，避免给人一个坏参数 */
const prefillParsed = computed(() => {
  const text = prefillText.value.trim()
  if (!text) return { value: null, error: '' }
  try {
    const value = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { value: null, error: '请填一个 JSON 对象，例如 { "name": "张三" }' }
    }
    return { value, error: '' }
  } catch (err) {
    return { value: null, error: `JSON 格式有误：${err.message}` }
  }
})

const prefillError = computed(() => prefillParsed.value.error)

const embedUrl = computed(() => {
  if (!selectedId.value) return ''
  const prefill = prefillParsed.value.value
  const param = prefill && Object.keys(prefill).length ? `&prefill=${encodePrefill(prefill)}` : ''
  return `${siteBase}/?embed=1${param}#/view/${selectedId.value}`
})

/** 生成代码里的结束标签必须拆开写，否则会提前结束当前脚本块 */
const SCRIPT_END = '<' + '/script>'

const embedCode = computed(() => {
  if (!embedUrl.value) return '选择页面后生成代码'
  const name = selectedPage.value?.name || '低代码页面'
  const height = autoHeight.value ? 640 : 720
  const lines = [
    `<!-- ${name} · 由 LowCode Studio 生成 -->`,
    `<iframe`,
    `  id="lc-frame"`,
    `  src="${embedUrl.value}"`,
    `  title="${name}"`,
    `  style="width: 100%; height: ${height}px; border: 0;"`,
    `></iframe>`
  ]
  if (autoHeight.value) {
    lines.push(
      '',
      '<script>',
      '  // 页面会通过 postMessage 上报内容高度，这里同步给 iframe，避免出现内层滚动条',
      "  window.addEventListener('message', function (event) {",
      '    var data = event.data',
      "    if (!data || data.source !== 'lowcode-studio') return",
      "    if (data.type === 'lc:resize') {",
      "      var frame = document.getElementById('lc-frame')",
      "      if (frame && event.source === frame.contentWindow) frame.style.height = data.height + 'px'",
      '    }',
      '  })',
      SCRIPT_END
    )
  }
  if (withSubmitHook.value) {
    lines.push(
      '',
      '<script>',
      '  // 表单提交完成：成功时刷新宿主列表 / 关闭弹窗，失败时提示',
      "  window.addEventListener('message', function (event) {",
      '    var data = event.data',
      "    if (!data || data.source !== 'lowcode-studio' || data.type !== 'lc:submit') return",
      "    var frame = document.getElementById('lc-frame')",
      '    if (!frame || event.source !== frame.contentWindow) return',
      '    if (data.ok) {',
      "      console.log('提交成功', data.data, data.response)",
      "      // location.reload()",
      '    } else {',
      "      console.warn('提交失败', data.error || data.response)",
      '    }',
      '  })',
      SCRIPT_END
    )
  }
  return lines.join('\n')
})

const prefillSnippet = computed(
  () => `// 把用户信息编码成 URL 参数（UTF-8 安全，中文不会乱码）
function toPrefillParam(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
}

const prefill = toPrefillParam({ name: '张三', dept: '研发部' })`
)

const prefillUrl = computed(() => {
  const prefill = prefillParsed.value.value
  const param = prefill && Object.keys(prefill).length ? `&prefill=${encodePrefill(prefill)}` : '&prefill=（先在上面填写预填值）'
  return `${siteBase}/?embed=1${param}#/view/${selectedId.value || '页面ID'}`
})

const messageRows = [
  { type: 'lc:hello', when: '页面脚本就绪（最早期）', payload: 'pageId、url' },
  { type: 'lc:ready', when: '页面内容加载完成', payload: 'pageId、name、prefill（实际生效的字段名）' },
  { type: 'lc:resize', when: '内容高度变化（含下拉展开、数据加载）', payload: 'height（像素）' },
  { type: 'lc:submit', when: '点击「请求接口」按钮后', payload: 'ok、status、url、data（提交的字段）、response 或 error' },
  { type: 'lc:error', when: '页面加载失败（未发布/被删除/网络不通）', payload: 'pageId、message、code' }
]

const listenSnippet = computed(
  () => `// 宿主系统：接收低代码页面的消息
window.addEventListener('message', (event) => {
  const frame = document.getElementById('lc-frame')
  // 只信目标 iframe 发来的消息，避免别的 iframe 伪造
  if (!frame || event.source !== frame.contentWindow) return
  const data = event.data || {}
  if (data.source !== 'lowcode-studio') return

  if (data.type === 'lc:resize') frame.style.height = data.height + 'px'
  if (data.type === 'lc:ready') console.log('页面已就绪：', data.name, data.prefill)
  if (data.type === 'lc:submit' && data.ok) {
    // 提交成功：刷新列表或关闭弹窗
    console.log('收到提交数据：', data.data, data.response)
  }
  if (data.type === 'lc:error') console.warn('页面加载失败：', data.message)
})`
)

const submitPayload = computed(
  () => `POST 你的接收地址
Content-Type: application/json

{
  "name": "张三",
  "dept": "研发部"
}`
)

const serverSnippet = `// Node / Express：接收低代码页面提交
import express from 'express'
import cors from 'cors'

const app = express()
app.use(express.json())

// 只允许低代码平台所在域名调用，不要用 *
app.use(cors({ origin: 'https://lowcode.example.com' }))

app.post('/api/employee', (req, res) => {
  const { name, dept } = req.body || {}
  if (!name) {
    return res.status(400).json({ success: false, message: '姓名不能为空' })
  }

  // 幂等：同一个业务键重复提交时返回同一条记录，避免用户连点造成重复数据
  // const key = req.body.employeeNo

  // TODO: 写入你的数据库
  res.json({ success: true, data: { id: 'EMP-1001', message: '登记成功' } })
})

app.listen(8080)`

const snapshotRequest = `GET ${siteBase}/api/published/页面ID
Accept: application/json`

const snapshotResponse = `{
  "success": true,
  "data": {
    "id": "page_demo_form",
    "name": "员工信息登记",
    "revision": 12,
    "schema": {
      "id": "root",
      "type": "Page",
      "children": [
        { "id": "t1", "type": "Title", "props": { "text": "员工信息登记" }, "children": [] }
      ]
    },
    "datasources": [],
    "publishedAt": "2026-11-03T14:46:52.070Z"
  }
}`

const checklist = [
  {
    title: '限定可嵌入的域名',
    text: '生产环境设置环境变量 EMBED_ANCESTORS="https://portal.example.com"，只允许自己的系统用 iframe 引用；留空为 *，便于本地调试。'
  },
  {
    title: '收窄接口来源',
    text: '设置 CORS_ORIGINS，只允许自家域名调用 /api；对外只暴露必要的只读数据源接口。'
  },
  {
    title: '不要把设计器直接放公网',
    text: '平台当前未内置账号体系，设计器与管理接口可写。请部署在内网，或放在统一登录（SSO）网关之后。'
  },
  {
    title: '走 HTTPS 并使用同一协议',
    text: '宿主页与嵌入页协议不同会被浏览器拦截（http 页面里嵌 https 一般可以，反过来不行）。'
  },
  {
    title: '提交接口要幂等',
    text: '用户会连点、网络会重试。用业务单号做去重键，重复提交返回同一结果，不要让数据库里出现两条。'
  },
  {
    title: '发布 ≠ 自动生效',
    text: '改了页面必须重新发布；宿主若缓存了旧页面，强制刷新或等 30 秒快照缓存过期。'
  }
]

const faqs = [
  {
    q: 'iframe 里一片空白 / 控制台提示 refused to display',
    a: '先确认地址带 ?embed=1，并且这个参数在 # 之前。若仍被拒，说明反向代理或网关额外加了 X-Frame-Options: SAMEORIGIN（很多运维模板默认带），需要对该路径去掉或用 CSP frame-ancestors 代替。'
  },
  {
    q: '嵌入后出现两层滚动条',
    a: '用了固定高度但又没开自动高度。复制生成器里「自动高度」版本的代码：页面会发 lc:resize，宿主同步给 iframe；同时不要给 iframe 设 overflow。'
  },
  {
    q: '预填参数传了，页面没变',
    a: '三个检查点：字段名是否与设计器里控件的「字段名」一致；值是否是合法 JSON 且经过 base64url 编码；地址里的 &prefill= 是否放在 # 之前。浏览器控制台会打印被忽略的字段名。'
  },
  {
    q: '点了提交，宿主系统没收到消息',
    a: 'lc:submit 只在按钮动作是「请求接口」时发送。确认宿主监听里用 event.source 比对了 iframe.contentWindow；如果 iframe 是跨域的，event.origin 会是平台域名，不能要求它等于宿主域名。'
  },
  {
    q: '页面里的表格拿不到数据',
    a: '宿主系统与平台不同域时，被调接口必须返回 CORS 头；另外确认数据源地址是绝对地址（相对地址会请求到平台域名下）。'
  },
  {
    q: '能不能不用 iframe，把页面直接嵌进 Vue/React 应用？',
    a: '可以，但需要自己实现渲染：用 /api/published/:id 取快照，按 schema 递归渲染（组件类型见页面导出的 HTML 代码，里面有每种组件的渲染方式）。工作量大，除非有强样式/路由要求，否则优先 iframe。'
  }
]

/** 复制：优先 Clipboard API，http 内网环境降级到 textarea + execCommand */
async function copy(text, label = '内容') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.error('复制失败，请手动选中复制')
  }
}

function openEmbed() {
  if (embedUrl.value) window.open(embedUrl.value, '_blank')
}

function scrollTo(id) {
  activeSection.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 滚动时高亮目录：以「进入视口顶部 120px」为当前小节 */
function onScroll(event) {
  const container = event.target
  const baseTop = container.getBoundingClientRect().top
  let current = toc[0].id
  toc.forEach((item) => {
    const el = document.getElementById(item.id)
    if (el && el.getBoundingClientRect().top - baseTop <= 120) current = item.id
  })
  activeSection.value = current
}

function goHome() {
  router.push('/')
}

watch(publishedPages, (list) => {
  if (!selectedId.value && list.length) selectedId.value = list[0].id
})

onMounted(async () => {
  loading.value = true
  try {
    pages.value = await pageApi.list()
  } catch (err) {
    ElMessage.error(`页面列表加载失败：${err.message}`)
  } finally {
    loading.value = false
  }
  await nextTick()
  document.querySelector('.doc')?.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  document.querySelector('.doc')?.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.doc {
  flex: 1;
  overflow: auto;
  background: var(--lc-bg);
  scroll-behavior: smooth;
}

.doc__inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 26px 24px 80px;
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

.doc__nav {
  position: sticky;
  top: 8px;
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius);
  padding: 12px 10px;
}

.doc__nav-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--lc-text-3);
  letter-spacing: 0.06em;
  padding: 4px 8px 8px;
}

.doc__nav-item {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  color: var(--lc-text-2);
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.doc__nav-item:hover {
  background: var(--lc-bg-subtle);
  color: var(--lc-text);
}

.doc__nav-item.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--lc-primary);
  font-weight: 600;
}

.doc__nav-foot {
  margin-top: 8px;
  padding: 10px 8px 4px;
  border-top: 1px solid var(--lc-border);
  font-size: 11.5px;
  color: var(--lc-text-3);
  line-height: 1.7;
}

.doc__main {
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius);
  padding: 30px 34px 40px;
  min-width: 0;
}

.doc__h1 {
  font-size: 22px;
  margin: 0 0 10px;
  letter-spacing: -0.3px;
}

.doc__h2 {
  font-size: 16px;
  margin: 0 0 12px;
}

.doc__h3 {
  font-size: 13.5px;
  margin: 22px 0 8px;
}

.doc__section {
  padding-top: 34px;
  scroll-margin-top: 16px;
}

.doc__section:first-child {
  padding-top: 0;
}

.doc__lead {
  font-size: 13px;
  line-height: 1.85;
  color: var(--lc-gray-700);
  margin: 0 0 14px;
}

.doc__p {
  font-size: 13px;
  line-height: 1.85;
  color: var(--lc-gray-700);
  margin: 10px 0;
}

.doc__list {
  font-size: 13px;
  line-height: 1.95;
  color: var(--lc-gray-700);
  padding-left: 20px;
  margin: 8px 0;
}

.doc__code {
  background: var(--lc-text);
  color: var(--lc-border-strong);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.75;
  overflow: auto;
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  margin: 8px 0;
  white-space: pre;
}

.doc__code-block {
  margin: 12px 0;
}

.doc__code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--lc-text-2);
  margin-bottom: 6px;
}

.doc__hint-box {
  margin: 10px 0;
  padding: 10px 12px;
  border-left: 3px solid var(--lc-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 0 6px 6px 0;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--lc-gray-800);
}

.doc__table {
  margin: 8px 0;
}

.doc__steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 10px 0 4px;
}

.doc__step {
  display: flex;
  gap: 10px;
}

.doc__step-index {
  flex: 0 0 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--lc-primary-soft);
  color: var(--lc-primary);
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  margin-top: 1px;
}

.doc__step-title {
  font-size: 12.5px;
  font-weight: 600;
}

.doc__step-text {
  font-size: 12px;
  color: var(--lc-text-2);
  line-height: 1.7;
  margin-top: 2px;
}

/* ---------- 生成器 ---------- */
.gen {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 18px;
  margin: 12px 0 4px;
  align-items: start;
}

.gen__form {
  border: 1px solid var(--lc-border);
  border-radius: 10px;
  padding: 14px;
  background: var(--lc-surface-2);
}

.gen__field {
  margin-bottom: 12px;
}

.gen__field label {
  display: block;
  font-size: 12px;
  color: var(--lc-gray-700);
  margin-bottom: 5px;
}

.gen__hint {
  font-size: 11.5px;
  color: var(--lc-text-3);
  margin-top: 4px;
  line-height: 1.6;
}

.gen__hint.is-error {
  color: var(--lc-danger);
}

.gen__hint.is-warn {
  color: var(--lc-warning-text);
}

.gen__switches {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gen__preview {
  border: 1px solid var(--lc-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--lc-surface);
}

.gen__preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 6px 12px;
  font-size: 12px;
  color: var(--lc-text-2);
  border-bottom: 1px solid var(--lc-border);
  background: var(--lc-surface-2);
}

.gen__frame-wrap {
  height: 320px;
  overflow: auto;
  background: var(--lc-bg-subtle);
}

.gen__frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: transparent;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checklist__item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.checklist__icon {
  color: var(--lc-success);
  margin-top: 2px;
}

.checklist__title {
  font-size: 12.5px;
  font-weight: 600;
}

.checklist__text {
  font-size: 12.5px;
  color: var(--lc-text-2);
  line-height: 1.75;
  margin-top: 2px;
}

.doc__foot {
  margin-top: 30px;
  padding-top: 16px;
  border-top: 1px solid var(--lc-border);
  font-size: 12px;
  color: var(--lc-text-3);
  line-height: 1.8;
}

code {
  background: var(--lc-bg-subtle);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11.5px;
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  color: var(--lc-gray-800);
}

.doc__code code {
  background: transparent;
  color: inherit;
  padding: 0;
}

@media (max-width: 1000px) {
  .doc__inner {
    grid-template-columns: 1fr;
  }
  .doc__nav {
    position: static;
  }
  .gen {
    grid-template-columns: 1fr;
  }
}
</style>
