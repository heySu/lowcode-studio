<template>
  <div class="spec">
    <!-- 左侧目录 -->
    <aside class="spec__nav">
      <div class="spec__nav-title">设计规范</div>
      <div class="spec__nav-sub">Design Tokens · 活文档</div>
      <nav class="spec__toc">
        <a
          v-for="item in toc"
          :key="item.id"
          :href="`#${item.id}`"
          class="spec__toc-item"
          :class="{ 'is-active': activeId === item.id }"
        >{{ item.label }}</a>
      </nav>
      <div class="spec__nav-foot">
        <p>本页所有颜色、字号、间距都直接读取 <code>styles/tokens.css</code> 里的 CSS 变量渲染——文档即实现，不存在两套数值。点击色卡可复制变量名。</p>
        <p>面向开发者的详细文档见仓库 <code>docs/</code> 目录（架构 / 接口 / Schema / 组件开发 / 部署 / 测试 / 代码规范）。</p>
      </div>
    </aside>

    <!-- 右侧正文 -->
    <main class="spec__main">
      <!-- 1 设计原则 -->
      <section id="principles" class="spec__section">
        <h1 class="spec__h1">设计规范</h1>
        <p class="spec__lead">
          LowCode Studio 的界面规范。平台自身（列表 / 设计器 / 运行态）和用户搭建出来的页面共用一套视觉语言，
          规范的代码形态是 <code>styles/tokens.css</code>——所有样式只允许引用令牌，不允许写死色值和像素。
        </p>
        <div class="spec__principles">
          <div v-for="p in principles" :key="p.title" class="spec__principle">
            <div class="spec__principle-title">{{ p.title }}</div>
            <p>{{ p.desc }}</p>
          </div>
        </div>
      </section>

      <!-- 2 色彩 -->
      <section id="color" class="spec__section">
        <h2 class="spec__h2">色彩</h2>
        <p class="spec__p">
          三层结构：基础色阶（brand / gray）→ 语义令牌（text / border / surface）→ 组件样式。
          业务样式优先用语义层；主色只用于「可点击 / 选中 / 进行中」，不承担装饰职责。
        </p>

        <h3 class="spec__h3">品牌色阶</h3>
        <div class="spec__swatches">
          <button
            v-for="t in brandTokens"
            :key="t"
            class="spec__swatch"
            type="button"
            :title="`点击复制 ${t}`"
            @click="copyToken(t)"
          >
            <span class="spec__swatch-chip" :style="{ background: `var(${t})` }" />
            <span class="spec__swatch-name">{{ shortName(t) }}</span>
            <span class="spec__swatch-value mono">{{ tokenValues[t] }}</span>
          </button>
        </div>

        <h3 class="spec__h3">中性色阶</h3>
        <div class="spec__swatches">
          <button
            v-for="t in grayTokens"
            :key="t"
            class="spec__swatch"
            type="button"
            :title="`点击复制 ${t}`"
            @click="copyToken(t)"
          >
            <span class="spec__swatch-chip" :style="{ background: `var(${t})` }" />
            <span class="spec__swatch-name">{{ shortName(t) }}</span>
            <span class="spec__swatch-value mono">{{ tokenValues[t] }}</span>
          </button>
        </div>

        <h3 class="spec__h3">语义色（状态反馈）</h3>
        <div class="spec__semantic">
          <div v-for="s in semanticTokens" :key="s.key" class="spec__semantic-row" :style="s.previewStyle">
            <strong>{{ s.label }}</strong>
            <span class="mono">{{ s.vars.map((v) => `${v}=${tokenValues[v]}`).join('  ') }}</span>
            <span class="spec__semantic-note">{{ s.note }}</span>
          </div>
        </div>
      </section>

      <!-- 3 字体 -->
      <section id="type" class="spec__section">
        <h2 class="spec__h2">字体与字阶</h2>
        <p class="spec__p">
          系统字体栈（<code class="mono">--lc-font-sans</code>），数字与代码用等宽栈。正文 14px，
          辅助信息 12–13px，标题不超过 32px；行高正文 1.5、说明文字 1.7。
        </p>
        <div class="spec__types">
          <div v-for="t in typeScale" :key="t.token" class="spec__type-row">
            <span class="mono spec__type-meta">{{ t.token }} · {{ tokenValues[t.token] }} · {{ t.usage }}</span>
            <div :style="{ fontSize: `var(${t.token})`, fontWeight: t.weight, lineHeight: 'var(--lc-lh-tight)' }">
              {{ t.sample }}
            </div>
          </div>
        </div>
      </section>

      <!-- 4 间距/圆角/阴影 -->
      <section id="space" class="spec__section">
        <h2 class="spec__h2">间距 · 圆角 · 阴影</h2>
        <p class="spec__p">间距 4px 基数，只允许 <code class="mono">--lc-space-*</code> 刻度；圆角三档常用值（4 / 8 / 12）；阴影只表达层级关系，不做装饰。</p>
        <div class="spec__spaces">
          <div v-for="t in spaceTokens" :key="t" class="spec__space-row">
            <span class="mono spec__space-name">{{ t }}</span>
            <span class="spec__space-bar" :style="{ width: `var(${t})` }" />
            <span class="mono spec__space-value">{{ tokenValues[t] }}</span>
          </div>
        </div>
        <div class="spec__radius-shadow">
          <div class="spec__demo-group">
            <div class="spec__demo-title">圆角</div>
            <div class="spec__radius-list">
              <div v-for="t in radiusTokens" :key="t" class="spec__radius-box" :style="{ borderRadius: `var(${t})` }">
                <span class="mono">{{ t }}</span>
              </div>
            </div>
          </div>
          <div class="spec__demo-group">
            <div class="spec__demo-title">阴影</div>
            <div class="spec__shadow-list">
              <div v-for="t in shadowTokens" :key="t" class="spec__shadow-box" :style="{ boxShadow: `var(${t})` }">
                <span class="mono">{{ shortName(t) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 5 组件规范 -->
      <section id="components" class="spec__section">
        <h2 class="spec__h2">组件规范</h2>

        <h3 class="spec__h3">按钮</h3>
        <p class="spec__p">
          每个操作区只放一个「主要按钮」（primary），其余一律次要按钮；危险操作（删除页面）必须二次确认。
          文案用动宾结构（「新建页面」「导出 JSON」），不写「确定」「点击这里」。
        </p>
        <div class="spec__demo-block">
          <el-button type="primary">主要操作</el-button>
          <el-button>次要操作</el-button>
          <el-button type="primary" plain>描边强调</el-button>
          <el-button text>文字按钮</el-button>
          <el-button type="danger" plain>危险操作</el-button>
          <el-button type="primary" disabled>禁用态</el-button>
          <el-button type="primary" loading>提交中</el-button>
        </div>

        <h3 class="spec__h3">表单</h3>
        <p class="spec__p">
          标签默认在控件上方（窄列），宽表单可用左右布局；必填标红星；占位符写「请输入 / 请选择 + 内容」，
          不用占位符代替标签。
        </p>
        <div class="spec__demo-block spec__form-demo">
          <div class="lc-form-field">
            <label class="lc-form-field__label">姓名<span class="req">*</span></label>
            <el-input placeholder="请输入姓名" />
          </div>
          <div class="lc-form-field">
            <label class="lc-form-field__label">部门</label>
            <el-select placeholder="请选择部门" model-value="" style="width: 100%">
              <el-option label="研发部" value="rd" />
              <el-option label="产品部" value="pd" />
            </el-select>
          </div>
          <div class="lc-form-field lc-form-field--horizontal">
            <label class="lc-form-field__label">备注</label>
            <el-input type="textarea" :rows="2" placeholder="补充说明…" />
          </div>
        </div>

        <h3 class="spec__h3">数据展示与反馈</h3>
        <div class="spec__demo-block">
          <el-tag type="success" effect="light">已发布</el-tag>
          <el-tag type="warning" effect="light">草稿</el-tag>
          <el-tag effect="plain">v12</el-tag>
          <el-alert type="success" :closable="false" show-icon title="保存成功，当前版本 v13" class="spec__alert" />
          <el-alert type="warning" :closable="false" show-icon title="有未发布的修改" description="草稿已保存但未发布，访问者看到的仍是旧版本。" class="spec__alert" />
          <el-alert type="error" :closable="false" show-icon title="保存失败：页面已在其他窗口被修改" class="spec__alert" />
        </div>
        <p class="spec__p">
          反馈文案三要素：发生了什么 + 原因 + 下一步怎么做。
          例如保存冲突必须说「你的版本 v12，服务器 v13，请刷新后再编辑」，而不是「操作失败」。
        </p>
      </section>

      <!-- 6 布局 -->
      <section id="layout" class="spec__section">
        <h2 class="spec__h2">布局规范</h2>
        <p class="spec__p">三个固定骨架，尺寸来自令牌，改主题只需改变量：</p>
        <div class="spec__layouts">
          <div v-for="l in layouts" :key="l.name" class="spec__layout">
            <div class="spec__layout-name">{{ l.name }}</div>
            <div class="spec__layout-demo" :class="l.cls">
              <template v-if="l.cls === 'is-designer'">
                <div class="spec__layout-cell is-left">组件面板 {{ tokenValues['--lc-left-w'] }}</div>
                <div class="spec__layout-cell is-center">画布</div>
                <div class="spec__layout-cell is-right">属性 {{ tokenValues['--lc-right-w'] }}</div>
              </template>
              <template v-else-if="l.cls === 'is-viewer'">
                <div class="spec__layout-cell is-center">页面内容 · 最大 {{ tokenValues['--lc-viewer-max'] }}</div>
              </template>
              <template v-else>
                <div class="spec__layout-cell is-center">内容区 · 最大 {{ tokenValues['--lc-list-max'] }}</div>
              </template>
            </div>
            <p class="spec__layout-note">{{ l.note }}</p>
          </div>
        </div>
      </section>

      <!-- 7 交互与状态 -->
      <section id="interaction" class="spec__section">
        <h2 class="spec__h2">交互与状态</h2>
        <ul class="spec__list">
          <li><strong>悬停</strong>：可点击元素 150ms 内给出背景 / 边框反馈；列表行悬停显示操作按钮。</li>
          <li><strong>选中（设计态）</strong>：1px 实线主色描边 + 徽标显示组件类型；悬停为虚线描边。</li>
          <li><strong>拖拽落点</strong>：插入位置用 3px 主色指示线（横向容器内为竖线），容器内部落点用内描边 + 浅色填充。</li>
          <li><strong>加载</strong>：整页 loading 遮罩；按钮内联 loading，禁止无反馈等待。</li>
          <li><strong>空状态</strong>：必须给下一步动作（空画布提供「套模板 / 自己拖 / 看说明」三个入口）。</li>
          <li><strong>快捷键</strong>：Ctrl+Z 撤销 / Ctrl+Y 重做 / Ctrl+S 保存 / Delete 删除选中。</li>
        </ul>
      </section>

      <!-- 8 无障碍与文案 -->
      <section id="a11y" class="spec__section">
        <h2 class="spec__h2">无障碍与文案</h2>
        <ul class="spec__list">
          <li>正文与背景对比度 ≥ 4.5:1；状态文字使用 <code class="mono">--lc-*-text</code> 深色变体，不用原色直接作文字。</li>
          <li>信息不允许只用颜色表达：标签、图标、文字至少两种通道同时存在。</li>
          <li>可点击区域高度 ≥ 24px；表单控件有可见标签，占位符不承担标签职责。</li>
          <li>文案用「你」称呼用户；按钮动词开头；报错说人话，禁止直接抛出原始异常堆栈。</li>
        </ul>
      </section>

      <!-- 9 落地约定 -->
      <section id="code" class="spec__section">
        <h2 class="spec__h2">落地约定</h2>
        <ul class="spec__list">
          <li>样式里禁止出现 <code class="mono">#hex</code> 与随手 px 值：颜色用 <code class="mono">var(--lc-*)</code>，间距用 <code class="mono">var(--lc-space-*)</code>。唯一允许写死色值的地方是 <code>styles/tokens.css</code>。</li>
          <li>新增令牌流程：先在 tokens.css 加基础值 + 语义映射 + 注释用途 → 设计规范页对应数组加一项 → 回归 docs-test。</li>
          <li>类名 BEM 风格；全局样式只放跨页面骨架，组件私有样式写在组件内。</li>
          <li>代码层面的规范（命名 / 注释 / 目录 / 提交）见 <code>docs/code-style.md</code>；视觉规范的可维护文档为 <code>docs/design-system.md</code>。</li>
        </ul>
        <div class="spec__docs">
          <div class="spec__docs-title">技术文档目录（仓库 docs/）</div>
          <div class="spec__docs-grid">
            <div v-for="d in docsIndex" :key="d.file" class="spec__doc-card">
              <div class="mono spec__doc-file">{{ d.file }}</div>
              <p>{{ d.desc }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
/**
 * 设计规范页（活文档）
 * ------------------------------------------------------------
 * 功能：把 tokens.css 里的设计令牌渲染成可浏览、可复制的规范页。
 * 业务：
 *   1. 规范如果只是一份 Word/PDF，和代码必然漂移；这里色卡的值是运行时
 *      getComputedStyle 从页面根节点读出来的——token 一改，规范页自动同步，
 *      docs-test 也会校验「页面展示值 == CSS 变量值」，文档与实现不允许两套数值。
 *   2. 内容分三块：设计原则与视觉令牌（给设计）、组件与交互规范（给设计 + 前端）、
 *      落地约定（硬性约束，见 docs/code-style.md）。
 *   3. 与 Integration 页共用「左目录 + 右正文」的文档版式，但样式独立，
 *      避免跨文件耦合导致改一处坏另一处。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const toc = [
  { id: 'principles', label: '设计原则' },
  { id: 'color', label: '色彩' },
  { id: 'type', label: '字体与字阶' },
  { id: 'space', label: '间距 · 圆角 · 阴影' },
  { id: 'components', label: '组件规范' },
  { id: 'layout', label: '布局规范' },
  { id: 'interaction', label: '交互与状态' },
  { id: 'a11y', label: '无障碍与文案' },
  { id: 'code', label: '落地约定' }
]

const principles = [
  { title: '一套令牌', desc: '平台界面与用户页面共用同一份 tokens.css；改主题只改变量文件，不碰业务样式。' },
  { title: '布局中立', desc: '容器类组件默认零内边距、无边框、透明背景，外观靠显式配置；这是「新加元素不错位」的根源。' },
  { title: '主色克制', desc: '品牌色只表示可交互 / 选中 / 进行中；大面积界面靠中性灰阶表达层次。' },
  { title: '反馈先行', desc: '任何操作 150ms 内要有视觉响应；错误文案说清原因与下一步，禁止无声失败。' }
]

const brandTokens = ['--lc-brand-25', '--lc-brand-50', '--lc-brand-100', '--lc-brand-200', '--lc-brand-300', '--lc-brand-400', '--lc-brand-500', '--lc-brand-600', '--lc-brand-700']
const grayTokens = ['--lc-gray-0', '--lc-gray-25', '--lc-gray-50', '--lc-gray-100', '--lc-gray-200', '--lc-gray-300', '--lc-gray-400', '--lc-gray-500', '--lc-gray-600', '--lc-gray-700', '--lc-gray-800', '--lc-gray-900']

const semanticTokens = [
  { key: 'success', label: '成功', vars: ['--lc-success', '--lc-success-bg', '--lc-success-text'], note: '保存 / 发布成功、校验通过', previewStyle: { background: 'var(--lc-success-bg)', color: 'var(--lc-success-text)', border: '1px solid var(--lc-success-border)' } },
  { key: 'warning', label: '警告', vars: ['--lc-warning', '--lc-warning-bg', '--lc-warning-text'], note: '未发布的修改、将要覆盖内容', previewStyle: { background: 'var(--lc-warning-bg)', color: 'var(--lc-warning-text)', border: '1px solid var(--lc-warning-border)' } },
  { key: 'danger', label: '危险', vars: ['--lc-danger', '--lc-danger-bg', '--lc-danger-text'], note: '保存失败、删除、校验不通过', previewStyle: { background: 'var(--lc-danger-bg)', color: 'var(--lc-danger-text)', border: '1px solid var(--lc-danger-border)' } },
  { key: 'info', label: '信息', vars: ['--lc-info', '--lc-info-bg'], note: '引导说明、中性提示', previewStyle: { background: 'var(--lc-info-bg)', color: 'var(--lc-info)', border: '1px solid var(--lc-info-border)' } }
]

const typeScale = [
  { token: '--lc-fs-h1', weight: 700, usage: '页面主标题', sample: '设计规范' },
  { token: '--lc-fs-h2', weight: 600, usage: '章节标题', sample: '团队数据看板' },
  { token: '--lc-fs-title', weight: 600, usage: '小节标题', sample: '员工信息登记' },
  { token: '--lc-fs-body', weight: 400, usage: '正文 / 控件', sample: '请填写员工基础信息' },
  { token: '--lc-fs-sm', weight: 400, usage: '次要说明', sample: '表单 + 数据表格示例' },
  { token: '--lc-fs-caption', weight: 400, usage: '辅助信息 / 徽标', sample: '更新于 2026-11-03' }
]

const spaceTokens = ['--lc-space-1', '--lc-space-2', '--lc-space-3', '--lc-space-4', '--lc-space-5', '--lc-space-6', '--lc-space-8', '--lc-space-10', '--lc-space-12']
const radiusTokens = ['--lc-radius-xs', '--lc-radius-sm', '--lc-radius-md', '--lc-radius-lg', '--lc-radius-xl', '--lc-radius-full']
const shadowTokens = ['--lc-shadow-xs', '--lc-shadow-sm', '--lc-shadow-md', '--lc-shadow-brand']

const layouts = [
  { name: '页面列表', cls: 'is-list', note: '顶栏 56px 吸顶；内容区限宽 1240px 居中，统计卡 4 列栅格。' },
  { name: '设计器', cls: 'is-designer', note: '左 252px 组件面板 / 中间自适应画布 / 右 306px 属性面板，三栏由令牌控制。' },
  { name: '运行态', cls: 'is-viewer', note: '无三栏，内容限宽 1080px；embed 模式下去掉外壳、背景透明。' }
]

const docsIndex = [
  { file: 'docs/README.md', desc: '文档索引与快速上手' },
  { file: 'docs/architecture.md', desc: '架构、数据流与关键设计决策' },
  { file: 'docs/api.md', desc: '后端接口参考与错误码' },
  { file: 'docs/page-schema.md', desc: '页面数据模型与 Schema 规范' },
  { file: 'docs/component-development.md', desc: '新增组件开发指南' },
  { file: 'docs/integration.md', desc: '嵌入其它系统的协议与示例' },
  { file: 'docs/deployment.md', desc: '部署、环境变量与运维' },
  { file: 'docs/testing.md', desc: '测试体系与编写方法' },
  { file: 'docs/code-style.md', desc: '代码规范与注释要求' },
  { file: 'docs/design-system.md', desc: '设计规范（本页的可维护版本）' }
]

/** 运行时读取的令牌值：键为 --lc-xxx，值为浏览器解析后的实际值 */
const tokenValues = ref({})
const activeId = ref('principles')

const shortName = (token) => token.replace('--lc-', '')

onMounted(async () => {
  const names = [...brandTokens, ...grayTokens, ...semanticTokens.flatMap((s) => s.vars), ...typeScale.map((t) => t.token), ...spaceTokens, ...radiusTokens, ...shadowTokens, '--lc-header-h', '--lc-left-w', '--lc-right-w', '--lc-list-max', '--lc-viewer-max']
  const styles = getComputedStyle(document.documentElement)
  const next = {}
  names.forEach((name) => {
    next[name] = (styles.getPropertyValue(name) || '').trim() || '未定义'
  })
  tokenValues.value = next

  // 滚动高亮当前小节
  const main = document.querySelector('.spec__main')
  const onScroll = () => {
    let current = toc[0].id
    toc.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el && el.offsetTop - main.scrollTop <= 140) current = item.id
    })
    activeId.value = current
  }
  main?.addEventListener('scroll', onScroll, { passive: true })
  onBeforeUnmount(() => main?.removeEventListener('scroll', onScroll))
})

async function copyToken(token) {
  try {
    await navigator.clipboard.writeText(token)
    // ElMessage 在按需引入下已全局注册
    const { ElMessage } = await import('element-plus')
    ElMessage.success(`已复制 ${token}`)
  } catch {
    /* 剪贴板不可用（非安全上下文）时静默失败，色卡本身仍可查看 */
  }
}
</script>

<style scoped>
.spec {
  display: flex;
  min-height: 100vh;
  background: var(--lc-surface);
}

/* ---------- 左侧目录 ---------- */
.spec__nav {
  width: 232px;
  flex: 0 0 232px;
  border-right: 1px solid var(--lc-border);
  padding: var(--lc-space-6) var(--lc-space-4);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: auto;
}

.spec__nav-title {
  font-size: var(--lc-fs-title);
  font-weight: var(--lc-fw-semibold);
}

.spec__nav-sub {
  font-size: var(--lc-fs-caption);
  color: var(--lc-text-3);
  margin-top: var(--lc-space-1);
  margin-bottom: var(--lc-space-4);
}

.spec__toc {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spec__toc-item {
  padding: 7px 10px;
  border-radius: var(--lc-radius-sm);
  font-size: var(--lc-fs-sm);
  color: var(--lc-text-2);
  transition: all var(--lc-duration-fast) var(--lc-ease);
}

.spec__toc-item:hover {
  background: var(--lc-bg);
  color: var(--lc-text);
}

.spec__toc-item.is-active {
  background: var(--lc-primary-soft);
  color: var(--lc-primary);
  font-weight: var(--lc-fw-medium);
}

.spec__nav-foot {
  margin-top: var(--lc-space-6);
  padding-top: var(--lc-space-4);
  border-top: 1px dashed var(--lc-border);
  font-size: var(--lc-fs-caption);
  color: var(--lc-text-3);
  line-height: var(--lc-lh-relaxed);
}

.spec__nav-foot code {
  font-family: var(--lc-font-mono);
  font-size: 11px;
}

/* ---------- 右侧正文 ---------- */
.spec__main {
  flex: 1;
  min-width: 0;
  padding: var(--lc-space-10) var(--lc-space-12) 120px;
  max-width: 980px;
}

.spec__section {
  margin-bottom: var(--lc-space-12);
}

.spec__h1 {
  font-size: var(--lc-fs-h1);
  font-weight: var(--lc-fw-bold);
  letter-spacing: -0.5px;
  margin: 0 0 var(--lc-space-3);
}

.spec__h2 {
  font-size: var(--lc-fs-h2);
  font-weight: var(--lc-fw-semibold);
  margin: 0 0 var(--lc-space-3);
  padding-top: var(--lc-space-4);
  border-top: 1px solid var(--lc-border-subtle);
}

.spec__section:first-of-type .spec__h2,
.spec__section:first-of-type {
  border-top: none;
}

.spec__h3 {
  font-size: var(--lc-fs-title);
  font-weight: var(--lc-fw-semibold);
  margin: var(--lc-space-6) 0 var(--lc-space-2);
}

.spec__lead,
.spec__p {
  font-size: var(--lc-fs-body);
  color: var(--lc-text-2);
  line-height: var(--lc-lh-relaxed);
  margin: 0 0 var(--lc-space-4);
}

.spec__lead {
  font-size: var(--lc-fs-title);
}

code {
  font-family: var(--lc-font-mono);
  background: var(--lc-bg);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-xs);
  padding: 1px 5px;
  font-size: 12px;
}

/* ---------- 设计原则 ---------- */
.spec__principles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--lc-space-3);
}

.spec__principle {
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  padding: var(--lc-space-4);
  background: var(--lc-surface-2);
}

.spec__principle-title {
  font-weight: var(--lc-fw-semibold);
  margin-bottom: var(--lc-space-2);
}

.spec__principle p {
  margin: 0;
  font-size: var(--lc-fs-sm);
  color: var(--lc-text-2);
  line-height: var(--lc-lh-relaxed);
}

/* ---------- 色卡 ---------- */
.spec__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lc-space-2);
  margin-bottom: var(--lc-space-4);
}

.spec__swatch {
  width: 86px;
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md);
  background: var(--lc-surface);
  cursor: copy;
  padding: 0;
  overflow: hidden;
  transition: all var(--lc-duration-fast) var(--lc-ease);
}

.spec__swatch:hover {
  border-color: var(--lc-primary);
  transform: translateY(-1px);
  box-shadow: var(--lc-shadow-brand);
}

.spec__swatch-chip {
  display: block;
  height: 44px;
  border-bottom: 1px solid var(--lc-border-subtle);
}

.spec__swatch-name {
  display: block;
  font-size: 11px;
  font-weight: var(--lc-fw-semibold);
  padding: 4px 6px 0;
  text-align: left;
  color: var(--lc-text);
}

.spec__swatch-value {
  display: block;
  font-size: 10px;
  color: var(--lc-text-3);
  padding: 0 6px 5px;
  text-align: left;
}

.spec__semantic {
  display: flex;
  flex-direction: column;
  gap: var(--lc-space-2);
}

.spec__semantic-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: var(--lc-space-1) var(--lc-space-4);
  align-items: center;
  border-radius: var(--lc-radius-md);
  padding: var(--lc-space-2) var(--lc-space-4);
  font-size: var(--lc-fs-sm);
}

.spec__semantic-row .mono {
  font-size: 11px;
  opacity: 0.9;
}

.spec__semantic-note {
  grid-column: 2;
  font-size: var(--lc-fs-caption);
  opacity: 0.75;
}

/* ---------- 字阶 ---------- */
.spec__types {
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  overflow: hidden;
}

.spec__type-row {
  padding: var(--lc-space-3) var(--lc-space-4);
  border-bottom: 1px solid var(--lc-border-subtle);
}

.spec__type-row:last-child {
  border-bottom: none;
}

.spec__type-meta {
  display: block;
  font-size: 11px;
  color: var(--lc-text-3);
  margin-bottom: var(--lc-space-1);
}

/* ---------- 间距 ---------- */
.spec__spaces {
  display: flex;
  flex-direction: column;
  gap: var(--lc-space-2);
  margin-bottom: var(--lc-space-6);
}

.spec__space-row {
  display: flex;
  align-items: center;
  gap: var(--lc-space-3);
}

.spec__space-name {
  width: 120px;
  font-size: 11px;
  color: var(--lc-text-2);
}

.spec__space-bar {
  height: 12px;
  background: var(--lc-primary-soft);
  border: 1px solid var(--lc-brand-300);
  border-radius: 3px;
}

.spec__space-value {
  font-size: 11px;
  color: var(--lc-text-3);
}

.spec__radius-shadow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--lc-space-6);
}

.spec__demo-title {
  font-size: var(--lc-fs-sm);
  font-weight: var(--lc-fw-semibold);
  margin-bottom: var(--lc-space-2);
}

.spec__radius-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lc-space-2);
}

.spec__radius-box {
  width: 72px;
  height: 44px;
  background: var(--lc-primary-soft);
  border: 1px solid var(--lc-brand-300);
  display: grid;
  place-items: center;
  font-size: 10px;
  color: var(--lc-text-2);
}

.spec__shadow-list {
  display: flex;
  flex-direction: column;
  gap: var(--lc-space-3);
}

.spec__shadow-box {
  background: var(--lc-surface);
  border-radius: var(--lc-radius-md);
  padding: var(--lc-space-2) var(--lc-space-3);
  font-size: 11px;
  color: var(--lc-text-2);
}

/* ---------- 组件示例 ---------- */
.spec__demo-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--lc-space-3);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  padding: var(--lc-space-4);
  background: var(--lc-surface-2);
  margin-bottom: var(--lc-space-3);
}

.spec__form-demo {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--lc-space-4);
  align-items: start;
}

.spec__form-demo .lc-form-field--horizontal {
  grid-column: 1 / -1;
}

.spec__alert {
  width: 100%;
}

/* ---------- 布局示意 ---------- */
.spec__layouts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--lc-space-3);
}

.spec__layout-name {
  font-size: var(--lc-fs-sm);
  font-weight: var(--lc-fw-semibold);
  margin-bottom: var(--lc-space-2);
}

.spec__layout-demo {
  display: flex;
  gap: 4px;
  height: 110px;
  border: 1px dashed var(--lc-border-strong);
  border-radius: var(--lc-radius-md);
  padding: 4px;
  background: var(--lc-bg);
}

.spec__layout-cell {
  border-radius: var(--lc-radius-sm);
  display: grid;
  place-items: center;
  font-size: 11px;
  text-align: center;
  padding: 4px;
  line-height: var(--lc-lh-normal);
}

.spec__layout-cell.is-left,
.spec__layout-cell.is-right {
  flex: 0 0 56px;
  background: var(--lc-primary-soft);
  color: var(--lc-primary);
}

.spec__layout-cell.is-center {
  flex: 1;
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  color: var(--lc-text-2);
}

.spec__layout-note {
  font-size: var(--lc-fs-caption);
  color: var(--lc-text-3);
  line-height: var(--lc-lh-relaxed);
  margin: var(--lc-space-2) 0 0;
}

/* ---------- 列表 ---------- */
.spec__list {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: var(--lc-space-2);
  font-size: var(--lc-fs-body);
  color: var(--lc-text-2);
  line-height: var(--lc-lh-relaxed);
}

.spec__list strong {
  color: var(--lc-text);
}

/* ---------- 文档目录 ---------- */
.spec__docs {
  margin-top: var(--lc-space-6);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  padding: var(--lc-space-4);
  background: var(--lc-bg);
}

.spec__docs-title {
  font-weight: var(--lc-fw-semibold);
  margin-bottom: var(--lc-space-3);
}

.spec__docs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--lc-space-2);
}

.spec__doc-card {
  background: var(--lc-surface);
  border: 1px solid var(--lc-border-subtle);
  border-radius: var(--lc-radius-md);
  padding: var(--lc-space-3);
}

.spec__doc-card p {
  margin: var(--lc-space-1) 0 0;
  font-size: var(--lc-fs-caption);
  color: var(--lc-text-2);
  line-height: var(--lc-lh-normal);
}

.spec__doc-file {
  font-size: 12px;
  color: var(--lc-primary);
  font-weight: var(--lc-fw-semibold);
}

@media (max-width: 1100px) {
  .spec__nav {
    display: none;
  }

  .spec__main {
    padding: var(--lc-space-6) var(--lc-space-5) 80px;
  }

  .spec__principles,
  .spec__radius-shadow,
  .spec__layouts,
  .spec__docs-grid,
  .spec__form-demo {
    grid-template-columns: 1fr;
  }
}
</style>
