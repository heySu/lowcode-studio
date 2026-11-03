/**
 * 预置示例页面
 * ------------------------------------------------------------
 * 功能：首次启动时生成两个开箱即用的示例（表单页 + 数据看板）。
 * 业务：示例页面承担「产品说明书」的角色——用户第一眼就要看懂
 *      数据源怎么绑、按钮动作怎么配、嵌套容器怎么摆，
 *      因此示例里刻意覆盖了这些特性，改动时注意不要删掉这些演示点。
 */

let seq = 0
const uid = (prefix) => `${prefix}_${String(++seq).padStart(3, '0')}`

function node(type, props = {}, children) {
  const item = { id: uid(type.toLowerCase()), type, props, style: {} }
  if (children) item.children = children
  return item
}

const employees = [
  { name: '张伟', dept: '研发部', role: '前端工程师', joinDate: '2023-04-12', score: 92 },
  { name: '李静', dept: '产品部', role: '产品经理', joinDate: '2022-08-01', score: 88 },
  { name: '王强', dept: '研发部', role: '后端工程师', joinDate: '2021-11-23', score: 95 },
  { name: '赵敏', dept: '设计部', role: 'UI 设计师', joinDate: '2024-02-19', score: 90 },
  { name: '孙浩', dept: '市场部', role: '市场专员', joinDate: '2023-09-06', score: 84 }
]

const depts = [
  { label: '研发部', value: 'rd' },
  { label: '产品部', value: 'pd' },
  { label: '设计部', value: 'dd' },
  { label: '市场部', value: 'mk' }
]

function ds(name, data) {
  return { id: uid('ds'), name, type: 'static', url: '', method: 'GET', json: JSON.stringify(data, null, 2) }
}

export function seedPages() {
  seq = 0
  const now = new Date().toISOString()

  const formPage = {
    id: 'page_demo_form',
    name: '员工信息登记',
    description: '表单 + 数据表格示例，演示数据源绑定与按钮动作',
    status: 'draft',
    revision: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishedRevision: null,
    published: null,
    datasources: [ds('employees', employees), ds('depts', depts)],
    schema: {
      id: 'root',
      type: 'Page',
      props: {},
      style: {},
      children: [
        node('Title', { text: '员工信息登记', level: 2, align: 'left', color: '#101828', weight: 700 }),
        node('Text', {
          content: '请填写员工基础信息。文本、指标都支持 {{form.xxx}} / {{employees.length}} 这样的插值写法。',
          size: 14,
          color: '#86909c',
          align: 'left',
          weight: 400,
          lineHeight: 1.7
        }),
        node(
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
            minHeight: 0
          },
          [
            node(
              'Container',
              {
                direction: 'row',
                gap: 16,
                padding: 0,
                background: 'transparent',
                border: false,
                radius: 0,
                justify: 'flex-start',
                align: 'flex-start',
                minHeight: 0
              },
              [
                Object.assign(
                  node('Input', {
                    name: 'name',
                    label: '姓名',
                    placeholder: '请输入姓名',
                    defaultValue: '',
                    clearable: true,
                    required: true,
                    layout: 'vertical',
                    labelWidth: '96px'
                  }),
                  { style: { flex: '1' } }
                ),
                Object.assign(
                  node('Select', {
                    name: 'dept',
                    label: '部门',
                    placeholder: '请选择部门',
                    multiple: false,
                    clearable: true,
                    optionsSource: 'depts',
                    layout: 'vertical',
                    labelWidth: '96px',
                    options: [
                      { label: '研发部', value: 'rd' },
                      { label: '产品部', value: 'pd' }
                    ]
                  }),
                  { style: { flex: '1' } }
                ),
                Object.assign(
                  node('DatePicker', {
                    name: 'joinDate',
                    label: '入职日期',
                    type: 'date',
                    placeholder: '请选择日期',
                    defaultValue: '',
                    layout: 'vertical',
                    labelWidth: '96px'
                  }),
                  { style: { flex: '1' } }
                )
              ]
            ),
            node('Textarea', {
              name: 'remark',
              label: '备注',
              placeholder: '补充说明…',
              rows: 3,
              defaultValue: '',
              layout: 'vertical',
              labelWidth: '96px'
            }),
            node(
              'Container',
              {
                direction: 'row',
                gap: 12,
                padding: 0,
                background: 'transparent',
                border: false,
                radius: 0,
                justify: 'flex-start',
                align: 'center',
                minHeight: 0
              },
              [
                node('Button', {
                  text: '提交登记',
                  type: 'primary',
                  size: 'default',
                  plain: false,
                  round: false,
                  block: false,
                  action: { type: 'request', method: 'POST', url: '/api/demo/submit', includeForm: true, text: '提交成功' }
                }),
                node('Button', {
                  text: '重置',
                  type: 'default',
                  size: 'default',
                  plain: false,
                  round: false,
                  block: false,
                  action: { type: 'reset', method: 'POST', url: '', includeForm: false, text: '' }
                })
              ]
            )
          ]
        ),
        node('Table', {
          dataSource: 'employees',
          stripe: true,
          border: false,
          size: 'default',
          maxHeight: 0,
          columnTitles: 'name:姓名, dept:部门, role:岗位, joinDate:入职日期, score:评分',
          emptyText: '暂无数据'
        })
      ]
    }
  }

  const dashboard = {
    id: 'page_demo_dashboard',
    name: '团队数据看板',
    description: '指标卡 + 进度 + 表格组合示例',
    status: 'draft',
    revision: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishedRevision: null,
    published: null,
    datasources: [ds('employees', employees)],
    schema: {
      id: 'root',
      type: 'Page',
      props: {},
      style: {},
      children: [
        node('Title', { text: '团队数据看板', level: 2, align: 'left', color: '#101828', weight: 700 }),
        node('Text', {
          content: '共 {{employees.length}} 名成员 · 数据源 employees',
          size: 14,
          color: '#86909c',
          align: 'left',
          weight: 400,
          lineHeight: 1.7
        }),
        node(
          'Container',
          {
            direction: 'row',
            gap: 16,
            padding: 0,
            background: 'transparent',
            border: false,
            radius: 0,
            justify: 'flex-start',
            align: 'stretch',
            minHeight: 0
          },
          [
            Object.assign(
              node('Statistic', { title: '团队成员', value: '{{employees.length}}', prefix: '', suffix: '人', precision: 0, color: '#101828' }),
              { style: { flex: '1' } }
            ),
            Object.assign(
              node('Statistic', { title: '平均评分', value: '90', prefix: '', suffix: '分', precision: 0, color: '#101828' }),
              { style: { flex: '1' } }
            ),
            Object.assign(
              node('Statistic', { title: '部门数', value: '4', prefix: '', suffix: '个', precision: 0, color: '#101828' }),
              { style: { flex: '1' } }
            ),
            Object.assign(
              node('Statistic', { title: '本月新增', value: '2', prefix: '+', suffix: '人', precision: 0, color: '#101828' }),
              { style: { flex: '1' } }
            )
          ]
        ),
        node(
          'Container',
          {
            direction: 'row',
            gap: 16,
            padding: 0,
            background: 'transparent',
            border: false,
            radius: 0,
            justify: 'flex-start',
            align: 'stretch',
            minHeight: 0
          },
          [
            Object.assign(
              node('Card', { title: '部门人数占比', shadow: 'never', bordered: true, padding: 16 }, [
                node('Text', { content: '研发部', size: 13, color: '#4e5969', align: 'left', weight: 400, lineHeight: 1.6 }),
                node('Progress', { percentage: 40, strokeWidth: 10, status: '', showText: true }),
                node('Text', { content: '产品部', size: 13, color: '#4e5969', align: 'left', weight: 400, lineHeight: 1.6 }),
                node('Progress', { percentage: 20, strokeWidth: 10, status: '', showText: true }),
                node('Text', { content: '设计部', size: 13, color: '#4e5969', align: 'left', weight: 400, lineHeight: 1.6 }),
                node('Progress', { percentage: 20, strokeWidth: 10, status: '', showText: true }),
                node('Text', { content: '市场部', size: 13, color: '#4e5969', align: 'left', weight: 400, lineHeight: 1.6 }),
                node('Progress', { percentage: 20, strokeWidth: 10, status: '', showText: true })
              ]),
              { style: { flex: '1' } }
            ),
            Object.assign(
              node('Card', { title: '成员明细', shadow: 'never', bordered: true, padding: 16 }, [
                node('Table', {
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
          ]
        )
      ]
    }
  }

  return [formPage, dashboard]
}
