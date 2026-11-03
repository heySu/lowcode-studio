/**
 * 组件注册表
 * ------------------------------------------------------------
 * 功能：一份配置同时驱动四个地方——
 *      1. 左侧组件面板（label/icon/分组）
 *      2. 右侧属性面板（fields 定义控件类型与默认值）
 *      3. 运行时渲染（NodeRenderer 按 type 分发）
 *      4. 服务端校验（server/src/validate.js 的类型白名单）
 * 业务：新增组件只需三步：本文件加定义 → NodeRenderer 加渲染分支 → validate.js 白名单加类型。
 *      千万不要绕过注册表在页面里硬编码组件，否则设计器/校验/渲染会互相脱节。
 * fields 控件类型：input | textarea | number | switch | select | color | slider | options | datasource | action
 */
import { newId } from '@/utils/tree'

const layoutFields = [
  {
    key: 'layout',
    label: '标签布局',
    type: 'select',
    options: [
      { label: '上下排列', value: 'vertical' },
      { label: '左右排列', value: 'horizontal' }
    ]
  },
  { key: 'labelWidth', label: '标签宽度', type: 'input', placeholder: '96px' }
]

const formBase = (extra = []) => [
  { key: 'name', label: '字段名', type: 'input', tip: '用于取值，如 {{form.字段名}}' },
  { key: 'label', label: '标签文字', type: 'input' },
  ...extra,
  ...layoutFields,
  { key: 'required', label: '显示必填星号', type: 'switch' }
]

const alignOptions = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' }
]

const colorOptions = [
  { label: '主要', value: 'primary' },
  { label: '成功', value: 'success' },
  { label: '警告', value: 'warning' },
  { label: '危险', value: 'danger' },
  { label: '信息', value: 'info' }
]

/**
 * 组件面板分组
 * ------------------------------------------------------------
 * items 支持两种写法：
 *   - 'Container'：字符串，直接取注册表定义；
 *   - { type, label, icon, presetProps }：同一组件的「预设变体」，
 *     例如横向容器 = Container + direction:'row'。
 * 业务：把「一行放多个组件」这个高频诉求做成一等公民——
 *      用户不需要先拖容器再手动改方向，面板里直接有横向容器可拖。
 */
export const groups = [
  {
    title: '布局容器',
    items: [
      'Container',
      {
        type: 'Container',
        label: '横向容器',
        icon: 'Rank',
        presetProps: { direction: 'row', border: false, background: 'transparent', padding: 0, gap: 12 }
      },
      'Card',
      'Divider'
    ]
  },
  { title: '基础组件', items: ['Title', 'Text', 'Button', 'Image', 'Alert', 'Tag'] },
  {
    title: '表单组件',
    items: ['Input', 'Textarea', 'Number', 'Select', 'Radio', 'Checkbox', 'Switch', 'DatePicker', 'Slider', 'Rate']
  },
  { title: '数据展示', items: ['Table', 'Statistic', 'Progress'] }
]

export const registry = {
  Container: {
    label: '容器',
    icon: 'Grid',
    acceptsChildren: true,
    /**
     * 默认属性必须是「布局中立」的：无内边距、无边框、透明背景。
     * 业务：容器是纯布局工具，用户往一行里加容器再放控件时，
     *      视觉上应该和直接放在行里的控件完全一致；
     *      之前默认带 16px 内边距 + 边框 + 白底，新加元素后整行立刻错位。
     *      需要「卡片」外观时用「卡片」组件，或在此处手动开边框/加背景。
     */
    props: () => ({
      direction: 'column',
      gap: 12,
      padding: 0,
      background: 'transparent',
      border: false,
      radius: 8,
      justify: 'flex-start',
      align: 'stretch',
      wrap: false,
      minHeight: 0
    }),
    fields: [
      {
        key: 'direction',
        label: '排列方向',
        type: 'select',
        tip: '选「横向」可让多个组件并排一行',
        options: [
          { label: '纵向', value: 'column' },
          { label: '横向', value: 'row' }
        ]
      },
      { key: 'wrap', label: '超出自动换行', type: 'switch', tip: '横向排列且一行放不下时换行' },
      { key: 'gap', label: '间距', type: 'number', min: 0, max: 80 },
      { key: 'padding', label: '内边距', type: 'number', min: 0, max: 80 },
      { key: 'background', label: '背景色', type: 'color' },
      { key: 'border', label: '显示边框', type: 'switch' },
      { key: 'radius', label: '圆角', type: 'number', min: 0, max: 40 },
      {
        key: 'justify',
        label: '主轴对齐',
        type: 'select',
        options: [
          { label: '起始', value: 'flex-start' },
          { label: '居中', value: 'center' },
          { label: '末尾', value: 'flex-end' },
          { label: '两端分布', value: 'space-between' }
        ]
      },
      {
        key: 'align',
        label: '交叉轴对齐',
        type: 'select',
        options: [
          { label: '拉伸', value: 'stretch' },
          { label: '居中', value: 'center' },
          { label: '起始', value: 'flex-start' },
          { label: '末尾', value: 'flex-end' }
        ]
      },
      { key: 'minHeight', label: '最小高度', type: 'number', min: 0, max: 600 }
    ]
  },

  Card: {
    label: '卡片',
    icon: 'Postcard',
    acceptsChildren: true,
    props: () => ({ title: '卡片标题', shadow: 'never', bordered: true, padding: 16 }),
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      {
        key: 'shadow',
        label: '阴影',
        type: 'select',
        options: [
          { label: '无', value: 'never' },
          { label: '悬浮', value: 'hover' },
          { label: '常驻', value: 'always' }
        ]
      },
      { key: 'bordered', label: '显示边框', type: 'switch' },
      { key: 'padding', label: '内边距', type: 'number', min: 0, max: 48 }
    ]
  },

  Divider: {
    label: '分割线',
    icon: 'Minus',
    props: () => ({ text: '', position: 'center' }),
    fields: [
      { key: 'text', label: '文字', type: 'input' },
      {
        key: 'position',
        label: '文字位置',
        type: 'select',
        options: [
          { label: '左', value: 'left' },
          { label: '中', value: 'center' },
          { label: '右', value: 'right' }
        ]
      }
    ]
  },

  Title: {
    label: '标题',
    icon: 'Reading',
    props: () => ({ text: '这是一个标题', level: 2, align: 'left', color: '#101828', weight: 700 }),
    fields: [
      { key: 'text', label: '文本内容', type: 'textarea', tip: '支持 {{form.xxx}} 插值' },
      {
        key: 'level',
        label: '标题级别',
        type: 'select',
        options: [
          { label: 'H1', value: 1 },
          { label: 'H2', value: 2 },
          { label: 'H3', value: 3 },
          { label: 'H4', value: 4 },
          { label: 'H5', value: 5 }
        ]
      },
      { key: 'align', label: '对齐', type: 'select', options: alignOptions },
      { key: 'color', label: '颜色', type: 'color' },
      { key: 'weight', label: '字重', type: 'number', min: 300, max: 900, step: 100 }
    ]
  },

  Text: {
    label: '文本',
    icon: 'Document',
    props: () => ({ content: '这是一段说明文字', size: 14, color: '#4e5969', align: 'left', weight: 400, lineHeight: 1.7 }),
    fields: [
      { key: 'content', label: '文本内容', type: 'textarea', tip: '支持 {{employees.length}} 插值' },
      { key: 'size', label: '字号', type: 'number', min: 10, max: 40 },
      { key: 'color', label: '颜色', type: 'color' },
      { key: 'align', label: '对齐', type: 'select', options: alignOptions },
      { key: 'weight', label: '字重', type: 'number', min: 300, max: 900, step: 100 },
      { key: 'lineHeight', label: '行高', type: 'number', min: 1, max: 3, step: 0.1 }
    ]
  },

  Button: {
    label: '按钮',
    icon: 'Pointer',
    props: () => ({
      text: '按钮',
      type: 'primary',
      size: 'default',
      plain: false,
      round: false,
      block: false,
      action: { type: 'message', method: 'POST', url: '', includeForm: false, text: '操作成功' }
    }),
    fields: [
      { key: 'text', label: '按钮文字', type: 'input' },
      { key: 'type', label: '类型', type: 'select', options: [{ label: '默认', value: 'default' }, ...colorOptions] },
      {
        key: 'size',
        label: '尺寸',
        type: 'select',
        options: [
          { label: '大', value: 'large' },
          { label: '默认', value: 'default' },
          { label: '小', value: 'small' }
        ]
      },
      { key: 'plain', label: '朴素按钮', type: 'switch' },
      { key: 'round', label: '圆角按钮', type: 'switch' },
      { key: 'block', label: '撑满宽度', type: 'switch' }
    ]
  },

  Image: {
    label: '图片',
    icon: 'Picture',
    props: () => ({
      src: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80',
      height: 200,
      fit: 'cover',
      radius: 8
    }),
    fields: [
      { key: 'src', label: '图片地址', type: 'input' },
      { key: 'height', label: '高度', type: 'number', min: 40, max: 800 },
      {
        key: 'fit',
        label: '填充方式',
        type: 'select',
        options: [
          { label: '裁切铺满', value: 'cover' },
          { label: '完整显示', value: 'contain' },
          { label: '拉伸', value: 'fill' }
        ]
      },
      { key: 'radius', label: '圆角', type: 'number', min: 0, max: 40 }
    ]
  },

  Alert: {
    label: '提示',
    icon: 'InfoFilled',
    props: () => ({ title: '提示信息', type: 'info', description: '', closable: false, showIcon: true }),
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      { key: 'description', label: '描述', type: 'textarea' },
      { key: 'type', label: '类型', type: 'select', options: colorOptions },
      { key: 'closable', label: '可关闭', type: 'switch' },
      { key: 'showIcon', label: '显示图标', type: 'switch' }
    ]
  },

  Tag: {
    label: '标签',
    icon: 'PriceTag',
    props: () => ({ text: '标签', type: 'primary', size: 'default', effect: 'light' }),
    fields: [
      { key: 'text', label: '文字', type: 'input' },
      { key: 'type', label: '类型', type: 'select', options: colorOptions },
      {
        key: 'effect',
        label: '风格',
        type: 'select',
        options: [
          { label: '浅色', value: 'light' },
          { label: '深色', value: 'dark' },
          { label: '朴素', value: 'plain' }
        ]
      },
      {
        key: 'size',
        label: '尺寸',
        type: 'select',
        options: [
          { label: '大', value: 'large' },
          { label: '默认', value: 'default' },
          { label: '小', value: 'small' }
        ]
      }
    ]
  },

  Input: {
    label: '单行输入',
    icon: 'EditPen',
    props: () => ({
      name: 'input',
      label: '输入框',
      placeholder: '请输入',
      defaultValue: '',
      clearable: true,
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'placeholder', label: '占位提示', type: 'input' },
      { key: 'defaultValue', label: '默认值', type: 'input' },
      { key: 'clearable', label: '可清空', type: 'switch' }
    ])
  },

  Textarea: {
    label: '多行文本',
    icon: 'Memo',
    props: () => ({
      name: 'textarea',
      label: '多行文本',
      placeholder: '请输入内容',
      defaultValue: '',
      rows: 3,
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'placeholder', label: '占位提示', type: 'input' },
      { key: 'defaultValue', label: '默认值', type: 'input' },
      { key: 'rows', label: '显示行数', type: 'number', min: 2, max: 12 }
    ])
  },

  Number: {
    label: '数字输入',
    icon: 'Odometer',
    props: () => ({
      name: 'number',
      label: '数字',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 0,
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'min', label: '最小值', type: 'number' },
      { key: 'max', label: '最大值', type: 'number' },
      { key: 'step', label: '步长', type: 'number' },
      { key: 'defaultValue', label: '默认值', type: 'number' }
    ])
  },

  Select: {
    label: '下拉选择',
    icon: 'Select',
    props: () => ({
      name: 'select',
      label: '下拉选择',
      placeholder: '请选择',
      multiple: false,
      clearable: true,
      optionsSource: '',
      options: [
        { label: '选项一', value: '1' },
        { label: '选项二', value: '2' }
      ],
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'placeholder', label: '占位提示', type: 'input' },
      { key: 'optionsSource', label: '选项数据源', type: 'datasource', tip: '留空则使用下方静态选项' },
      { key: 'options', label: '静态选项', type: 'options' },
      { key: 'multiple', label: '允许多选', type: 'switch' },
      { key: 'clearable', label: '可清空', type: 'switch' }
    ])
  },

  Radio: {
    label: '单选组',
    icon: 'CircleCheck',
    props: () => ({
      name: 'radio',
      label: '单选',
      defaultValue: '',
      optionsSource: '',
      options: [
        { label: '选项一', value: '1' },
        { label: '选项二', value: '2' }
      ],
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'optionsSource', label: '选项数据源', type: 'datasource' },
      { key: 'options', label: '静态选项', type: 'options' },
      { key: 'defaultValue', label: '默认值', type: 'input' }
    ])
  },

  Checkbox: {
    label: '多选组',
    icon: 'Finished',
    props: () => ({
      name: 'checkbox',
      label: '多选',
      optionsSource: '',
      options: [
        { label: '选项一', value: '1' },
        { label: '选项二', value: '2' }
      ],
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'optionsSource', label: '选项数据源', type: 'datasource' },
      { key: 'options', label: '静态选项', type: 'options' }
    ])
  },

  Switch: {
    label: '开关',
    icon: 'SwitchButton',
    props: () => ({
      name: 'switch',
      label: '开关',
      activeText: '开',
      inactiveText: '关',
      defaultValue: false,
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'activeText', label: '开启文字', type: 'input' },
      { key: 'inactiveText', label: '关闭文字', type: 'input' }
    ])
  },

  DatePicker: {
    label: '日期选择',
    icon: 'Calendar',
    props: () => ({
      name: 'date',
      label: '日期',
      type: 'date',
      placeholder: '请选择日期',
      defaultValue: '',
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      {
        key: 'type',
        label: '选择类型',
        type: 'select',
        options: [
          { label: '日期', value: 'date' },
          { label: '日期时间', value: 'datetime' },
          { label: '月份', value: 'month' },
          { label: '周', value: 'week' }
        ]
      },
      { key: 'placeholder', label: '占位提示', type: 'input' }
    ])
  },

  Slider: {
    label: '滑块',
    icon: 'Operation',
    props: () => ({
      name: 'slider',
      label: '滑块',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 30,
      showInput: false,
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'min', label: '最小值', type: 'number' },
      { key: 'max', label: '最大值', type: 'number' },
      { key: 'step', label: '步长', type: 'number' },
      { key: 'defaultValue', label: '默认值', type: 'number' },
      { key: 'showInput', label: '显示输入框', type: 'switch' }
    ])
  },

  Rate: {
    label: '评分',
    icon: 'Star',
    props: () => ({
      name: 'rate',
      label: '评分',
      max: 5,
      defaultValue: 3,
      allowHalf: false,
      layout: 'vertical',
      labelWidth: '96px',
      required: false
    }),
    fields: formBase([
      { key: 'max', label: '最高分', type: 'number', min: 3, max: 10 },
      { key: 'defaultValue', label: '默认分', type: 'number' },
      { key: 'allowHalf', label: '允许半星', type: 'switch' }
    ])
  },

  Table: {
    label: '数据表格',
    icon: 'Menu',
    props: () => ({
      dataSource: '',
      columnTitles: '',
      stripe: true,
      border: false,
      size: 'default',
      maxHeight: 0,
      emptyText: '暂无数据'
    }),
    fields: [
      { key: 'dataSource', label: '数据源', type: 'datasource', tip: '在顶部「数据源」中配置' },
      { key: 'columnTitles', label: '列标题', type: 'input', tip: '格式：字段名:标题，逗号分隔，留空自动取字段名' },
      {
        key: 'size',
        label: '尺寸',
        type: 'select',
        options: [
          { label: '大', value: 'large' },
          { label: '默认', value: 'default' },
          { label: '小', value: 'small' }
        ]
      },
      { key: 'stripe', label: '斑马纹', type: 'switch' },
      { key: 'border', label: '显示边框', type: 'switch' },
      { key: 'maxHeight', label: '最大高度', type: 'number', min: 0, max: 800, tip: '0 表示不限制' },
      { key: 'emptyText', label: '空数据文案', type: 'input' }
    ]
  },

  Statistic: {
    label: '指标卡',
    icon: 'TrendCharts',
    props: () => ({
      title: '指标名称',
      value: '1,280',
      prefix: '',
      suffix: '',
      precision: 0,
      color: '#101828',
      background: '#ffffff',
      border: true
    }),
    fields: [
      { key: 'title', label: '指标名称', type: 'input' },
      { key: 'value', label: '指标值', type: 'input', tip: '支持 {{employees.length}} 插值' },
      { key: 'prefix', label: '前缀', type: 'input' },
      { key: 'suffix', label: '后缀', type: 'input' },
      { key: 'precision', label: '小数位', type: 'number', min: 0, max: 4 },
      { key: 'color', label: '数值颜色', type: 'color' },
      { key: 'background', label: '背景色', type: 'color' },
      { key: 'border', label: '显示边框', type: 'switch' }
    ]
  },

  Progress: {
    label: '进度条',
    icon: 'DataLine',
    props: () => ({ percentage: 60, strokeWidth: 10, status: '', showText: true, color: '#3b6ef6' }),
    fields: [
      { key: 'percentage', label: '百分比', type: 'slider', min: 0, max: 100 },
      { key: 'strokeWidth', label: '线宽', type: 'number', min: 2, max: 30 },
      {
        key: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '默认', value: '' },
          { label: '成功', value: 'success' },
          { label: '警告', value: 'warning' },
          { label: '异常', value: 'exception' }
        ]
      },
      { key: 'showText', label: '显示文字', type: 'switch' },
      { key: 'color', label: '颜色', type: 'color' }
    ]
  }
}

export function getMeta(type) {
  return registry[type] || { label: type, icon: 'Document', fields: [], props: () => ({}) }
}

/**
 * 创建节点
 * @param {string} type 组件类型
 * @param {object} presetProps 预设属性（面板变体用），覆盖默认值
 */
export function createNode(type, presetProps = {}) {
  const meta = registry[type]
  if (!meta) return null
  const node = {
    id: newId(type.toLowerCase()),
    type,
    props: { ...meta.props(), ...(presetProps || {}) },
    style: {}
  }
  if (meta.acceptsChildren) node.children = []
  return node
}
