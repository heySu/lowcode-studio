/**
 * 页面模板库
 * ------------------------------------------------------------
 * 功能：为「新建页面」提供可直接使用的参考模板，并输出模板说明（适用场景 + 改造步骤）。
 * 业务：低代码平台最大的流失点不是功能不够，而是「新建出来一片空白，不知道怎么下手」。
 *      所以模板承担三件事：
 *        1. 给结构：常见业务的页面骨架（登记表单 / 查询列表 / 数据看板 / 详情页 / 反馈收集），
 *           用户改文案和字段就能用，不必从零拖组件；
 *        2. 给示范：每个模板都刻意用上了数据源、插值、按钮动作等特性，本身就是说明书；
 *        3. 给指引：guide 字段说明「这个页面由什么组成、要改成自己的业务该改哪几处」，
 *           前端在新建弹窗和设计器空画布上直接展示，用户不需要另翻文档。
 * 说明：模板里的节点 id 只是模板内部占位，创建页面时会统一重新生成（见 buildTemplate），
 *      避免不同模板、多次创建的 id 撞车导致选中/撤销串味。
 */
import { randomBytes } from 'node:crypto'
import { validateSchema } from './validate.js'

/** 模板内部占位 id：只需在模板内唯一 */
let seq = 0
const n = (type, props = {}, children) => {
  const node = { id: `tpl_${type.toLowerCase()}_${++seq}`, type, props, style: {} }
  if (children) node.children = children
  return node
}

/** 静态数据源：模板自带演示数据，创建后可整体替换成自己的接口 */
const ds = (name, data) => ({
  id: `tpl_ds_${name}`,
  name,
  type: 'static',
  url: '',
  method: 'GET',
  json: JSON.stringify(data, null, 2)
})

// ---------------------------------------------------------------- 模板内复用的示例数据

const employees = [
  { name: '张伟', dept: '研发部', role: '前端工程师', joinDate: '2023-04-12', score: 92 },
  { name: '李静', dept: '产品部', role: '产品经理', joinDate: '2022-08-01', score: 88 },
  { name: '王强', dept: '研发部', role: '后端工程师', joinDate: '2021-11-23', score: 95 },
  { name: '赵敏', dept: '设计部', role: 'UI 设计师', joinDate: '2024-02-19', score: 90 }
]

const depts = [
  { label: '研发部', value: 'rd' },
  { label: '产品部', value: 'pd' },
  { label: '设计部', value: 'dd' },
  { label: '市场部', value: 'mk' }
]

/**
 * 行容器
 * 用法：row(16)([子组件]) 或 row(12)([子组件], 'flex-start')
 * 之所以返回函数，是为了让「一行多列」的模板写法保持紧凑可读。
 */
const row = (gap = 16) => (children = [], align = 'stretch') => {
  const node = n('Container', {
    direction: 'row',
    gap,
    padding: 0,
    background: 'transparent',
    border: false,
    radius: 0,
    justify: 'flex-start',
    align,
    minHeight: 0
  })
  node.children = children
  return node
}

/** 列容器：用于卡片内「小标题 + 内容」的纵向堆叠 */
const col = (children = []) => {
  const node = n('Container', {
    direction: 'column',
    gap: 8,
    padding: 0,
    background: 'transparent',
    border: false,
    radius: 0,
    justify: 'flex-start',
    align: 'stretch',
    minHeight: 0
  })
  node.children = children
  return node
}

/** 卡片式纵向容器（白底 + 圆角 + 内边距） */
const panel = (children, extra = {}) =>
  n(
    'Container',
    {
      direction: 'column',
      gap: 16,
      padding: 20,
      background: '#ffffff',
      border: true,
      radius: 12,
      justify: 'flex-start',
      align: 'stretch',
      minHeight: 0,
      ...extra
    },
    children
  )

const title = (textValue, level = 2) =>
  n('Title', { text: textValue, level, align: 'left', color: '#101828', weight: 700 })

const text = (content, extra = {}) =>
  n('Text', {
    content,
    size: 14,
    color: '#4e5969',
    align: 'left',
    weight: 400,
    lineHeight: 1.7,
    ...extra
  })

/** 表单字段：统一上下布局 + 统一标签宽度，多列时视觉更整齐；flex 用于横向占位 */
const field = (type, props, flex) => {
  const node = n(type, { layout: 'vertical', labelWidth: '96px', required: false, ...props })
  if (flex) node.style = { flex }
  return node
}

const button = (textValue, type, action) =>
  n('Button', { text: textValue, type, size: 'default', plain: false, round: false, block: false, action })

/** 按钮动作预设：模板里直接演示三种最常见配置 */
const MESSAGE_ACTION = { type: 'message', method: 'POST', url: '', includeForm: false, text: '操作成功' }
const SUBMIT_ACTION = { type: 'request', method: 'POST', url: '/api/demo/submit', includeForm: true, text: '提交成功' }
const RESET_ACTION = { type: 'reset', method: 'POST', url: '', includeForm: false, text: '' }

/** 指标卡（看板模板用） */
const stat = (titleValue, value, suffix, color = '#101828') =>
  Object.assign(
    n('Statistic', { title: titleValue, value, prefix: '', suffix, precision: 0, color }),
    { style: { flex: '1' } }
  )

// ---------------------------------------------------------------- 模板定义

const templates = [
  {
    id: 'blank',
    name: '空白页面',
    category: '基础',
    icon: 'Document',
    tagline: '从零开始，自己拖组件',
    summary: '只有一张白纸，适合已经想清楚结构、想完全自己搭的用户。',
    scenes: ['自由搭建', '探索学习'],
    highlights: ['空画布', '无预置数据源'],
    guide: [
      { title: '先放骨架', text: '从左侧「布局容器」拖一个容器到画布，页面结构用它来分区。' },
      { title: '再填内容', text: '把标题、文本、表单控件拖进容器；容器内可以再套容器做多列布局。' },
      { title: '最后连数据', text: '点顶部「数据源」加一份静态 JSON 或接口地址，表格和下拉框即可绑定。' }
    ],
    schema: { id: 'root', type: 'Page', props: {}, style: {}, children: [] },
    datasources: []
  },

  {
    id: 'form',
    name: '信息登记表单',
    category: '表单',
    icon: 'EditPen',
    tagline: '两列表单 + 提交/重置',
    summary: '最常用的录入页：姓名、手机号、部门、日期、备注，提交按钮已接好后端示例接口。',
    scenes: ['员工入职登记', '客户建档', '报名信息收集', '供应商录入'],
    highlights: ['两列表单布局', '下拉框绑定数据源 depts', '提交按钮已接 /api/demo/submit', '必填星号'],
    guide: [
      {
        title: '① 改字段',
        text: '选中任意表单控件，右侧「属性」里改「字段名」和「标签文字」。字段名决定取值，如 {{form.phone}}。'
      },
      { title: '② 增删控件', text: '从左侧「表单组件」再拖控件进表单；不需要的选中后按 Delete 删除。' },
      { title: '③ 换选项', text: '「所属部门」绑定数据源 depts，点顶部「数据源」把 JSON 换成你自己的部门列表。' },
      {
        title: '④ 换提交地址',
        text: '选中「提交登记」按钮 →「事件」里改成你后端的真实地址，并保持「提交时带上表单数据」开启。'
      }
    ],
    datasources: [ds('depts', depts)],
    schema: {
      id: 'root',
      type: 'Page',
      props: {},
      style: {},
      children: [
        title('信息登记'),
        text('请填写下面的信息并提交。字段值可用 {{form.字段名}} 在文本里引用。'),
        panel([
          row(16)([
            field('Input', { name: 'name', label: '姓名', placeholder: '请输入姓名', defaultValue: '', clearable: true, required: true }, '1'),
            field('Input', { name: 'phone', label: '手机号', placeholder: '请输入手机号', defaultValue: '', clearable: true }, '1')
          ]),
          row(16)([
            field(
              'Select',
              {
                name: 'dept',
                label: '所属部门',
                placeholder: '请选择部门',
                multiple: false,
                clearable: true,
                optionsSource: 'depts',
                options: [
                  { label: '研发部', value: 'rd' },
                  { label: '产品部', value: 'pd' }
                ]
              },
              '1'
            ),
            field('DatePicker', { name: 'joinDate', label: '入职日期', type: 'date', placeholder: '请选择日期', defaultValue: '' }, '1')
          ]),
          field('Textarea', { name: 'remark', label: '备注', placeholder: '补充说明…', rows: 3, defaultValue: '' }),
          row(12)([button('提交登记', 'primary', SUBMIT_ACTION), button('重置', 'default', RESET_ACTION)], 'flex-start')
        ])
      ]
    }
  },

  {
    id: 'query',
    name: '数据查询列表',
    category: '数据',
    icon: 'Menu',
    tagline: '筛选条件 + 数据表格',
    summary: '列表页标准结构：上方筛选行，下方表格，表格已绑定示例数据源。',
    scenes: ['订单列表', '客户列表', '工单查询', '库存台账'],
    highlights: ['筛选行 + 表格', '表格绑定 employees', '列标题可配置'],
    guide: [
      { title: '① 换数据', text: '点顶部「数据源」把 employees 换成你的列表数据；真实项目建议选「接口 API」并填后端地址。' },
      { title: '② 改列', text: '选中表格，在「列标题」按「字段名:标题」格式配置，如 orderNo:订单号, amount:金额。' },
      { title: '③ 让筛选生效', text: '筛选控件目前只是界面占位；接真实接口时把字段作为查询参数传给后端，或在按钮「事件」里配置请求。' },
      { title: '④ 扩展', text: '需要分页/批量操作时，在表格下方加一行容器放按钮，按业务补充。' }
    ],
    datasources: [ds('employees', employees)],
    schema: {
      id: 'root',
      type: 'Page',
      props: {},
      style: {},
      children: [
        title('成员列表'),
        text('共 {{employees.length}} 条数据 · 换数据源即可变成你自己的业务列表'),
        panel([
          row(12)([
            field(
              'Input',
              { name: 'keyword', label: '关键词', placeholder: '姓名 / 岗位', defaultValue: '', clearable: true, layout: 'horizontal', labelWidth: '72px' },
              '2'
            ),
            field(
              'Select',
              {
                name: 'dept',
                label: '部门',
                placeholder: '全部',
                multiple: false,
                clearable: true,
                optionsSource: 'depts',
                options: [{ label: '研发部', value: 'rd' }],
                layout: 'horizontal',
                labelWidth: '72px'
              },
              '1'
            ),
            n('Button', { text: '查询', type: 'primary', size: 'default', plain: false, round: false, block: false, action: MESSAGE_ACTION })
          ]),
          n('Table', {
            dataSource: 'employees',
            stripe: true,
            border: false,
            size: 'default',
            maxHeight: 0,
            columnTitles: 'name:姓名, dept:部门, role:岗位, joinDate:入职日期, score:评分',
            emptyText: '暂无数据'
          })
        ])
      ]
    }
  },

  {
    id: 'dashboard',
    name: '数据看板',
    category: '数据',
    icon: 'TrendCharts',
    tagline: '指标卡 + 进度 + 明细表',
    summary: '汇报型页面：顶部四张指标卡，下面是占比进度和明细表格。',
    scenes: ['团队看板', '经营日报', '项目进度总览', '运营监控'],
    highlights: ['4 张指标卡（含 {{}} 插值）', '进度条占比', '明细表格'],
    guide: [
      { title: '① 指标怎么算', text: '指标卡的「指标值」支持插值，如 {{employees.length}} 会实时取数据源条数；固定数值直接填。' },
      { title: '② 加指标', text: '选中指标卡改名称/后缀/颜色；要加一张就右键复制（选中后点复制图标）。' },
      { title: '③ 进度条', text: '百分比目前在「属性」里手填，接入接口后可改为按数据计算。' },
      { title: '④ 换数据源', text: '指标和明细表都读 employees，换一次数据源两者会一起变。' }
    ],
    datasources: [ds('employees', employees)],
    schema: {
      id: 'root',
      type: 'Page',
      props: {},
      style: {},
      children: [
        title('团队数据看板'),
        text('数据源 employees · 共 {{employees.length}} 名成员'),
        row(16)([
          stat('团队成员', '{{employees.length}}', '人'),
          stat('平均评分', '91', '分'),
          stat('覆盖部门', '4', '个'),
          stat('本月新增', '2', '人', '#12b76a')
        ]),
        row(16)([
          Object.assign(
            n('Card', { title: '部门人数占比', shadow: 'never', bordered: true, padding: 16 }, [
              text('研发部', { size: 13, color: '#4e5969' }),
              n('Progress', { percentage: 50, strokeWidth: 10, status: '', showText: true }),
              text('产品部', { size: 13, color: '#4e5969' }),
              n('Progress', { percentage: 25, strokeWidth: 10, status: '', showText: true }),
              text('设计部', { size: 13, color: '#4e5969' }),
              n('Progress', { percentage: 25, strokeWidth: 10, status: '', showText: true })
            ]),
            { style: { flex: '1' } }
          ),
          Object.assign(
            n('Card', { title: '成员明细', shadow: 'never', bordered: true, padding: 16 }, [
              n('Table', {
                dataSource: 'employees',
                stripe: true,
                border: false,
                size: 'small',
                maxHeight: 0,
                columnTitles: 'name:姓名, dept:部门, role:岗位',
                emptyText: '暂无数据'
              })
            ]),
            { style: { flex: '2' } }
          )
        ])
      ]
    }
  },

  {
    id: 'detail',
    name: '详情展示页',
    category: '展示',
    icon: 'Postcard',
    tagline: '分组卡片 + 字段说明',
    summary: '只读展示型页面：标题、状态标签、分组信息卡，适合工单/订单详情。',
    scenes: ['工单详情', '订单详情', '客户档案', '公告详情'],
    highlights: ['状态标签', '分组信息卡', '三列信息排布'],
    guide: [
      { title: '① 改标题与状态', text: '顶部标题和「进行中」标签是两个独立组件，选中后改文字与颜色即可。' },
      { title: '② 字段怎么排', text: '信息区是「小标题 + 内容」成对堆叠，外层是横向容器；增减一组就复制或删除一个列容器。' },
      { title: '③ 接真实数据', text: '把静态文字换成插值，如 {{detail.owner}}，数据源给一份对象数组即可自动取值。' },
      { title: '④ 加操作按钮', text: '底部按钮可配置「打开链接」或「请求接口」，用于审批、关闭等动作。' }
    ],
    datasources: [],
    schema: {
      id: 'root',
      type: 'Page',
      props: {},
      style: {},
      children: [
        row(12)([title('工单 #20241103-018'), n('Tag', { text: '进行中', type: 'warning', size: 'default', effect: 'light' })], 'center'),
        text('提交于 2026-11-03 10:24 · 当前处理人：张伟'),
        panel([
          text('基础信息', { size: 13, color: '#98a2b3', weight: 600 }),
          row(16)([
            Object.assign(col([text('客户名称', { size: 12, color: '#98a2b3' }), text('杭州云杉科技有限公司', { size: 14, color: '#101828', weight: 500 })]), {
              style: { flex: '1' }
            }),
            Object.assign(col([text('联系电话', { size: 12, color: '#98a2b3' }), text('0571-8888 6666', { size: 14, color: '#101828', weight: 500 })]), {
              style: { flex: '1' }
            }),
            Object.assign(col([text('问题类型', { size: 12, color: '#98a2b3' }), text('系统对接异常', { size: 14, color: '#101828', weight: 500 })]), {
              style: { flex: '1' }
            })
          ])
        ]),
        panel([
          text('问题描述', { size: 13, color: '#98a2b3', weight: 600 }),
          text('接口返回 502，重试三次仍然失败，影响线上订单同步。')
        ]),
        n('Alert', {
          title: '处理建议',
          type: 'info',
          description: '先确认网关后端服务是否存活，再检查 502 期间的网关日志。',
          closable: false,
          showIcon: true
        }),
        row(12)([button('标记已解决', 'primary', MESSAGE_ACTION), button('转交他人', 'default', MESSAGE_ACTION)], 'flex-start')
      ]
    }
  },

  {
    id: 'feedback',
    name: '反馈收集表单',
    category: '表单',
    icon: 'Star',
    tagline: '评分 + 单选 + 多选 + 建议',
    summary: '满意度调研常用组合：评分、单选、多选、补充建议，适合活动后收集意见。',
    scenes: ['满意度调研', '需求收集', '培训反馈', '产品体验打分'],
    highlights: ['评分组件', '单选 / 多选组', '多行建议 + 提交'],
    guide: [
      { title: '① 改题目', text: '每个控件的「标签文字」就是题目；需要长描述时在控件上方拖一个文本组件。' },
      { title: '② 改选项', text: '单选/多选组在「属性 → 静态选项」里增删选项。' },
      { title: '③ 必填校验', text: '「显示必填星号」目前只是视觉提示，严格校验建议在提交接口里做。' },
      { title: '④ 数据去哪', text: '把「提交反馈」按钮的接口地址改成你的收集接口，即可落库或转发到问卷系统。' }
    ],
    datasources: [],
    schema: {
      id: 'root',
      type: 'Page',
      props: {},
      style: {},
      children: [
        title('培训满意度反馈'),
        text('感谢参加本次培训，请花 1 分钟告诉我们你的真实感受。'),
        panel([
          field('Rate', { name: 'score', label: '整体满意度', max: 5, defaultValue: 4, allowHalf: true }),
          field('Radio', {
            name: 'useful',
            label: '内容对工作有帮助吗',
            defaultValue: 'yes',
            optionsSource: '',
            options: [
              { label: '很有帮助', value: 'yes' },
              { label: '一般', value: 'so-so' },
              { label: '帮助不大', value: 'no' }
            ]
          }),
          field('Checkbox', {
            name: 'topics',
            label: '希望下次讲哪些主题',
            optionsSource: '',
            options: [
              { label: '数据分析', value: 'data' },
              { label: '项目管理', value: 'pm' },
              { label: '沟通协作', value: 'comm' }
            ]
          }),
          field('Textarea', { name: 'advice', label: '其他建议', placeholder: '任何想法都可以写在这里…', rows: 3, defaultValue: '' }),
          row(12)([button('提交反馈', 'primary', SUBMIT_ACTION)], 'flex-start')
        ])
      ]
    }
  }
]

function countNodes(node) {
  if (!node) return 0
  const self = node.type === 'Page' ? 0 : 1
  return (node.children || []).reduce((sum, child) => sum + countNodes(child), self)
}

/**
 * 对外暴露的模板元信息（不含完整 schema）
 * 业务：新建弹窗只需要「名称 + 说明 + 结构缩略」，把整份 schema 塞进列表接口会让响应大出几十倍。
 */
export function listTemplates() {
  return templates.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    icon: item.icon,
    tagline: item.tagline,
    summary: item.summary,
    scenes: item.scenes,
    highlights: item.highlights,
    guide: item.guide,
    // 前端用组件类型渲染结构缩略条，图标与中文名由前端注册表补齐
    previewTypes: (item.schema.children || []).map((child) => child.type),
    nodeCount: countNodes(item.schema)
  }))
}

export function hasTemplate(id) {
  return templates.some((item) => item.id === id)
}

/** 深拷贝并重新分配节点 id，保证跨页面唯一 */
function reid(schema) {
  const copy = JSON.parse(JSON.stringify(schema))
  const assign = (item) => {
    item.id = `${item.type.toLowerCase()}_${randomBytes(3).toString('hex')}`
    ;(item.children || []).forEach(assign)
  }
  ;(copy.children || []).forEach(assign)
  return copy
}

/**
 * 按模板生成页面内容
 * 业务：创建页面时调用。这里立刻做一次结构校验——模板是写死在代码里的，
 *      一旦写错（例如把子组件挂到不支持 children 的类型上），应该在创建时就暴露，
 *      而不是等用户编辑半天、点发布时才报错。
 * @returns {{ schema: object, datasources: Array, description: string } | null}
 */
export function buildTemplate(id) {
  const tpl = templates.find((item) => item.id === id)
  if (!tpl) return null

  const schema = reid(tpl.schema)
  const datasources = (tpl.datasources || []).map((item, index) => ({
    ...JSON.parse(JSON.stringify(item)),
    id: `ds_${randomBytes(3).toString('hex')}_${index}`
  }))

  validateSchema(schema, { requireContent: false })
  return { schema, datasources, description: tpl.summary }
}
