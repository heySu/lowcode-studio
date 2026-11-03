<template>
  <el-drawer
    :model-value="modelValue"
    title="使用说明"
    size="600px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div class="help">
      <el-alert type="info" :closable="false" show-icon title="第一次用？照着「三分钟上手」走一遍就能做出可发布的页面。">
      </el-alert>

      <!-- 1. 快速上手 -->
      <section class="help__section">
        <h4>三分钟上手</h4>
        <div class="help__steps">
          <div v-for="(step, index) in quickStart" :key="step.title" class="help__step">
            <span class="help__step-index">{{ index + 1 }}</span>
            <div>
              <div class="help__step-title">{{ step.title }}</div>
              <div class="help__step-text">{{ step.text }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. 界面 -->
      <section class="help__section">
        <h4>界面分三块</h4>
        <el-table :data="layoutRows" size="small" border>
          <el-table-column prop="area" label="区域" width="110" />
          <el-table-column prop="usage" label="作用" />
        </el-table>
        <div class="hint">提示：画布上方的浅灰条常驻提示快捷键与组件总数；点空白处可以选中「页面」本身，在右侧改页面名称和描述。</div>
      </section>

      <!-- 3. 组件 -->
      <section class="help__section">
        <h4>组件怎么选</h4>
        <el-table :data="componentRows" size="small" border>
          <el-table-column prop="group" label="分组" width="100" />
          <el-table-column prop="usage" label="什么时候用" />
        </el-table>
        <div class="hint">
          容器（Container / Card）可以嵌套，是排版的基础：横向容器做多列，纵向容器做上下堆叠。其他组件不能放子组件。
        </div>
        <h4 style="margin-top: 16px">怎么让一行放多个组件</h4>
        <ol class="help__list" style="padding-left: 18px">
          <li>从组件面板拖一个<b>「横向容器」</b>到画布（它就是排列方向=横向的容器）；</li>
          <li>把要并排的组件拖进这个容器，输入框等填充型组件会<b>自动均分宽度</b>；</li>
          <li>想让某个组件宽一点，选中后在右侧「样式 → 弹性占比」调大它的份数。</li>
        </ol>
        <div class="hint">
          落点规则：拖到容器<b>中间</b> = 放进容器；拖到容器<b>上下边缘</b> = 插到容器前面/后面（同级）；横向容器里按左右边缘分前后。按钮、标签这类小组件在横向容器里保持自身宽度。
        </div>
      </section>

      <!-- 4. 数据 -->
      <section class="help__section">
        <h4>数据怎么进来</h4>
        <p class="help__p">点顶部「数据源」可以加一份数据，两种类型：</p>
        <ul class="help__list">
          <li><b>静态 JSON</b>：直接贴一个数组，适合原型演示和固定选项。</li>
          <li><b>接口 API</b>：填后端地址，返回数组或 <code>{ data: [...] }</code> 结构都能识别。</li>
        </ul>
        <p class="help__p">绑定方式：表格选「数据源」，下拉/单选/多选选「选项数据源」。</p>
        <p class="help__p">文本、标题、指标卡支持插值，写法是双大括号：</p>
        <pre class="help__code">{{ interpolationExample }}</pre>
        <div class="hint">form 是表单控件「字段名」的集合；employees 是数据源名称。改字段名/数据源名后，插值也要跟着改。</div>
      </section>

      <!-- 5. 交互 -->
      <section class="help__section">
        <h4>按钮能做什么</h4>
        <el-table :data="actionRows" size="small" border>
          <el-table-column prop="type" label="动作" width="110" />
          <el-table-column prop="usage" label="说明" />
        </el-table>
        <div class="hint">选中按钮 → 右侧切到「事件」页签就能配置。开启「提交时带上表单数据」后，页面里所有表单字段会一起发给后端。</div>
      </section>

      <!-- 6. 保存 / 预览 / 发布 -->
      <section class="help__section">
        <h4>保存、预览、发布有什么区别</h4>
        <el-table :data="publishRows" size="small" border>
          <el-table-column prop="action" label="操作" width="90" />
          <el-table-column prop="usage" label="结果" />
        </el-table>
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          style="margin-top: 10px"
          title="发布之后又改了内容，一定要再点一次「发布」，否则访问者看到的还是上一版。"
        />
      </section>

      <!-- 7. 迁移与交付 -->
      <section class="help__section">
        <h4>导出代码 / 导入页面</h4>
        <p class="help__p">设计器右上角「更多」菜单里：</p>
        <el-table :data="portabilityRows" size="small" border>
          <el-table-column prop="action" label="操作" width="130" />
          <el-table-column prop="usage" label="用途" />
        </el-table>
        <div class="hint">
          导出的 HTML 是<b>单文件</b>，双击就能运行，不需要本平台；它通过 CDN 加载 Vue3 与 Element Plus，
          首次打开需要联网（离线使用可把这两个库下载到本地，改写文件末尾的 script 地址）。
        </div>
        <div class="hint">
          导入支持三种文件：标准导出包（.page.json）、旧版导出 JSON、裸页面结构。导入前会做服务端校验，
          不合法会指出具体原因；可以新建页面，也可以覆盖当前画布（覆盖后按 Ctrl+Z 可撤销）。
        </div>
      </section>

      <!-- 8. 接入其它系统 -->
      <section class="help__section">
        <h4>接到别的系统里</h4>
        <p class="help__p">发布后的页面不只能单独打开，还能放进你现有的 OA / ERP / 内部后台：</p>
        <ul class="help__list">
          <li><b>iframe 嵌入</b>：地址加 <code>?embed=1</code>，隐藏平台顶栏、高度自动、可预填表单；</li>
          <li><b>链接跳转</b>：把 <code>#/view/页面ID</code> 这段地址交给对方的菜单或按钮；</li>
          <li><b>导出单文件</b>：交付客户，或部署到自己的服务器上。</li>
        </ul>
        <el-button size="small" type="primary" plain @click="emit('open-integration')">
          打开接入指南（含可复制代码）
        </el-button>
      </section>

      <!-- 9. 快捷键 -->
      <section class="help__section">
        <h4>快捷键</h4>
        <div class="help__keys">
          <div v-for="key in keys" :key="key.name" class="help__key">
            <kbd>{{ key.combo }}</kbd><span>{{ key.name }}</span>
          </div>
        </div>
      </section>

      <!-- 10. 设计规范与技术文档 -->
      <section class="help__section">
        <h4>设计规范与技术文档</h4>
        <p class="help__p">
          界面颜色、字号、间距都来自 <code>styles/tokens.css</code> 的设计令牌；
          规范页直接读取真实变量渲染，代码改了规范自动同步。开发者文档在仓库 <code>docs/</code> 目录。
        </p>
        <el-button size="small" @click="goSpec">查看设计规范</el-button>
      </section>

      <!-- 8. 常见问题 -->
      <section class="help__section">
        <h4>常见问题</h4>
        <el-collapse>
          <el-collapse-item v-for="item in faqs" :key="item.q" :title="item.q">
            <div class="help__p" style="margin: 0">{{ item.a }}</div>
          </el-collapse-item>
        </el-collapse>
      </section>

      <div class="help__foot">
        <el-checkbox :model-value="autoHelp" @update:model-value="(v) => emit('update:autoHelp', v)">
          新建空页面时自动打开本说明
        </el-checkbox>
        <el-button size="small" text @click="emit('open-templates')">套用一个模板试试</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
/**
 * 使用说明抽屉
 * ------------------------------------------------------------
 * 功能：把「怎么用这个平台」讲清楚——上手步骤、界面分区、组件选择、数据绑定、按钮交互、
 *      保存/预览/发布的区别、快捷键、常见问题。
 * 业务：低代码工具的新用户流失，多数不是不会拖组件，而是不知道「改完为什么不生效」
 *      「为什么线上还是旧版」。所以这份说明的重点放在这些容易踩坑的概念上，
 *      并与真实按钮文案保持一致，用户能直接对号入座。
 */
defineProps({
  modelValue: { type: Boolean, default: false },
  /** 是否在下次进入设计器时自动打开，由父组件持久化到 localStorage */
  autoHelp: { type: Boolean, default: true }
})
const emit = defineEmits(['update:modelValue', 'update:autoHelp', 'open-templates', 'open-integration'])

/** 跳转到设计规范页：规范与 tokens.css 同源，供设计与开发查阅 */
function goSpec() {
  window.open(`${location.origin}${location.pathname}#/spec`, '_blank')
}

/** 插值示例：写成常量而不是直接写在模板里，避免 Vue 把双大括号当成表达式解析 */
const interpolationExample = '共 {{employees.length}} 名成员\n当前填写人：{{form.name}}'

/** 导入导出能力：与设计器「更多」菜单里的真实文案保持一致，用户能直接对号入座 */
const portabilityRows = [
  { action: '导出页面 JSON', usage: '页面结构 + 数据源的完整备份，可跨环境迁移、归档、交接' },
  { action: '导出 HTML 代码', usage: '生成可独立运行的单文件页面，直接交给开发或客户预览' },
  { action: '导入页面代码', usage: '读取上面两种导出的文件，新建页面或覆盖当前画布' }
]

const quickStart = [
  { title: '选一个模板新建页面', text: '在列表页点「新建页面」，选「信息登记表单」这类模板，创建后画布里就已经有可用的页面。' },
  { title: '改文字和字段', text: '点画布里的任意组件，右侧「属性」里改文案、字段名、占位提示。改完立刻生效，不需要保存才能看到。' },
  { title: '拖入更多组件', text: '从左侧把组件拖到画布上：拖到容器内部是放进去，拖到组件之间的细线是插入到该位置。' },
  { title: '保存 → 预览 → 发布', text: '点「保存」存草稿；点「预览」看运行效果；确认无误后点「发布」，生成可对外访问的链接。' }
]

const layoutRows = [
  { area: '左侧', usage: '组件库，按「布局 / 基础 / 表单 / 数据展示」分组。可拖拽，也可双击追加到页面末尾。' },
  { area: '中间', usage: '画布。所见即所得，点组件选中，选中后可复制、删除、上移下移。' },
  { area: '右侧', usage: '属性面板：属性（内容与配置）、样式（宽高、间距、圆角）、事件（按钮点击做什么）。' },
  {
    area: '顶栏「交互」',
    usage: '打开后画布变成可操作的真实页面（下拉能选、能输入文字），用于试用控件效果；关闭后恢复编辑。'
  }
]

const componentRows = [
  { group: '布局容器', usage: '容器做分栏与间距，卡片带标题和边框做信息分组，分割线做视觉分隔。' },
  { group: '基础组件', usage: '标题、文本用于说明；按钮触发动作；提示条用于注意事项；标签用于状态展示。' },
  { group: '表单组件', usage: '收集用户输入。字段名决定取值，提交时按字段名组装成数据。' },
  { group: '数据展示', usage: '表格展示列表数据；指标卡展示单个数字；进度条展示占比。' }
]

const actionRows = [
  { type: '弹出提示', usage: '点击后弹一条轻提示，适合演示和占位。' },
  { type: '打开链接', usage: '跳转到指定地址，可设置新窗口打开。' },
  { type: '请求接口', usage: '真正调后端，可带上整页表单数据，成功后提示并显示返回内容。' },
  { type: '重置表单', usage: '把页面上的表单字段恢复为默认值。' }
]

const publishRows = [
  { action: '保存', usage: '把当前画布写入草稿，只有你自己能看到。' },
  { action: '预览', usage: '按运行态渲染当前页面（含草稿内容），用于自己检查效果。' },
  { action: '发布', usage: '生成一份线上快照，访问者看到的是这一版，之后的修改不影响线上，直到再次发布。' }
]

const keys = [
  { combo: 'Ctrl + S', name: '保存' },
  { combo: 'Ctrl + Z', name: '撤销' },
  { combo: 'Ctrl + Shift + Z', name: '重做' },
  { combo: 'Delete', name: '删除选中组件' }
]

const faqs = [
  {
    q: '点下拉框没反应、选不中组件？',
    a: '设计态默认锁住控件交互（防止拖拽时误输入），所以点下拉/日期不会弹面板。想试用控件：打开顶栏「交互」开关，画布就变成可操作的真实页面；再关掉即可继续编辑。选组件请点击控件任意位置，选中的就是该组件本身。'
  },
  {
    q: '改了属性，为什么预览里没变化？',
    a: '先看是否已保存成功（顶栏出现「未保存」说明还没写进后端）。预览读取的是已保存内容，未保存的修改不会出现在新开的预览窗口里。'
  },
  {
    q: '发布后线上还是旧内容？',
    a: '发布生成的是快照。再次修改后需要重新点「发布」，顶栏会出现「有未发布修改」的提示。'
  },
  {
    q: '表格一直是「暂无数据」？',
    a: '检查三点：表格的「数据源」是否选了；数据源名称是否和插值/绑定里写的一致；静态 JSON 是否是合法的数组。'
  },
  {
    q: '为什么把组件拖不进另一个组件？',
    a: '只有「容器」和「卡片」可以放子组件。其他组件是叶子节点，需要先把容器拖进来，再把组件拖进容器。'
  },
  {
    q: '页面能给别人看吗？',
    a: '保存并发布后，用「预览」旁边的访问链接即可分享；撤回发布后链接会提示未发布。'
  }
]
</script>

<style scoped>
.help {
  padding: 0 4px 40px;
}

.help__section {
  margin-top: 22px;
}

.help__section h4 {
  font-size: 13px;
  margin: 0 0 10px;
  color: var(--lc-text);
}

.help__steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help__step {
  display: flex;
  gap: 10px;
}

.help__step-index {
  flex: 0 0 20px;
  width: 20px;
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

.help__step-title {
  font-size: 12.5px;
  font-weight: 600;
}

.help__step-text {
  font-size: 12px;
  color: var(--lc-text-2);
  line-height: 1.7;
  margin-top: 2px;
}

.help__p {
  font-size: 12.5px;
  color: var(--lc-gray-700);
  line-height: 1.8;
  margin: 8px 0;
}

.help__list {
  margin: 6px 0;
  padding-left: 18px;
  font-size: 12.5px;
  color: var(--lc-gray-700);
  line-height: 1.9;
}

.help__code {
  background: var(--lc-text);
  color: var(--lc-border-strong);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.7;
  overflow: auto;
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  margin: 6px 0;
}

.help__keys {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 16px;
}

.help__key {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--lc-gray-700);
}

.help__key kbd {
  background: var(--lc-bg-subtle);
  border: 1px solid var(--lc-border);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 11px;
  font-family: inherit;
  color: var(--lc-gray-800);
}

.help__foot {
  margin-top: 24px;
  padding-top: 14px;
  border-top: 1px solid var(--lc-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
