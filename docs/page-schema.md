# 页面数据模型与 Schema 规范

## 页面对象

```json
{
  "id": "page_xxx",
  "name": "员工信息登记",
  "description": "…",
  "status": "draft | published",
  "revision": 12,
  "createdAt": "ISO 时间",
  "updatedAt": "ISO 时间",
  "publishedAt": "ISO 时间 | null",
  "publishedRevision": 12,
  "published": { "revision": 12, "schema": { }, "publishedAt": "…" },
  "datasources": [],
  "schema": { "id": "root", "type": "Page", "props": {}, "style": {}, "children": [] }
}
```

- 编辑永远作用于草稿 `schema`；`published` 是发布时刻的只读深拷贝。
- `revision` 是乐观锁版本号，每次成功保存 +1。

## 节点结构

```json
{
  "id": "input_005",
  "type": "Input",
  "props": { "name": "name", "label": "姓名", "placeholder": "请输入姓名" },
  "style": { "flex": "1" },
  "children": []
}
```

| 字段 | 约束 |
| --- | --- |
| id | 页面内唯一，服务端创建时按 `type_时间戳随机` 生成，导入时会重新分配以避免冲突 |
| type | 必须在服务端白名单内（与前端注册表保持一致） |
| props | 组件属性，键值见附录；未知键会被忽略 |
| style | 布局覆盖，常用 `flex` / `width`；空对象表示跟随容器默认 |
| children | 仅容器类（Container / Card）允许有子节点 |

硬性限制（服务端校验，超出返回 400）：树深 ≤ 8、节点数 ≤ 800、schema ≤ 1MB。

## 数据源

```json
{ "id": "ds_001", "name": "employees", "type": "static | api", "method": "GET", "url": "", "json": "[…]" }
```

- `name` 必须是合法标识符（字母开头，字母/数字/下划线），用于插值与组件绑定。
- `static`：`json` 字段存 JSON 字符串（对象数组或对象）。
- `api`：运行时 fetch `url`（GET），响应需为 JSON。
- 引用方式：表格绑定 `dataSource: "employees"`；下拉/单选/多选的 `optionsSource`；文本插值 `{{employees.length}}`；表单值插值 `{{form.name}}`。

## 按钮动作

```json
{ "type": "message | link | reset | request",
  "text": "提交成功",
  "url": "/api/demo/submit",
  "method": "POST",
  "includeForm": true }
```

- `message`：弹 `text` 提示；`link`：跳转 `url`；`reset`：清空表单。
- `request`：fetch `url`（默认 POST），`includeForm` 时 body 为整个表单模型；嵌入模式下成功/失败都会 `postMessage` 通知宿主。

## 表单值模型

- 表单类组件（Input/Textarea/Number/Select/Radio/Checkbox/Switch/DatePicker/Slider/Rate）以 `props.name` 作为字段名进入 `form` 模型；`name` 重复会导致后一个值覆盖前一个，命名需唯一。
- `defaultValue` 在运行时初始化 form；`prefill`（嵌入传参）会覆盖初始值。

## 插值语法

- 出现在 Title/Text 等文本属性中：`共 {{employees.length}} 名成员`。
- 求值作用域：`form`（表单值）+ 各数据源名。表达式由运行时安全求值，不支持任意 JS（无 `window`/`fetch` 等能力）。

<!-- PROPS-AUTO:BEGIN -->
### 附录：组件属性表（自动生成）

> 由 `scripts/gen-props-doc.mjs` 从 `web/src/registry/index.js` 生成，请勿手改。
> 组件定义变化后执行 `npm run gen:props` 重新生成。

#### 布局容器

| 组件 | type | 默认属性 | 可配置字段 |
| --- | --- | --- | --- |
| 容器 | `Container` | direction='column', gap=12, padding=0, background='transparent', border=false, radius=8, justify='flex-start', align='stretch', wrap=false, minHeight=0 | direction(select), wrap(switch), gap(number), padding(number), background(color), border(switch), radius(number), justify(select), align(select), minHeight(number) |
| 容器（预设：`{"direction":"row","border":false,"background":"transparent","padding":0,"gap":12}`） | `Container` | direction='column', gap=12, padding=0, background='transparent', border=false, radius=8, justify='flex-start', align='stretch', wrap=false, minHeight=0 | direction(select), wrap(switch), gap(number), padding(number), background(color), border(switch), radius(number), justify(select), align(select), minHeight(number) |
| 卡片 | `Card` | title='卡片标题', shadow='never', bordered=true, padding=16 | title(input), shadow(select), bordered(switch), padding(number) |
| 分割线 | `Divider` | text='', position='center' | text(input), position(select) |

#### 基础组件

| 组件 | type | 默认属性 | 可配置字段 |
| --- | --- | --- | --- |
| 标题 | `Title` | text='这是一个标题', level=2, align='left', color='#101828', weight=700 | text(textarea), level(select), align(select), color(color), weight(number) |
| 文本 | `Text` | content='这是一段说明文字', size=14, color='#4e5969', align='left', weight=400, lineHeight=1.7 | content(textarea), size(number), color(color), align(select), weight(number), lineHeight(number) |
| 按钮 | `Button` | text='按钮', type='primary', size='default', plain=false, round=false, block=false, action={"type":"message","method":"POST","url":"","includeForm":false,"text":"操作成功"} | text(input), type(select), size(select), plain(switch), round(switch), block(switch) |
| 图片 | `Image` | src='https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80', height=200, fit='cover', radius=8 | src(input), height(number), fit(select), radius(number) |
| 提示 | `Alert` | title='提示信息', type='info', description='', closable=false, showIcon=true | title(input), description(textarea), type(select), closable(switch), showIcon(switch) |
| 标签 | `Tag` | text='标签', type='primary', size='default', effect='light' | text(input), type(select), effect(select), size(select) |

#### 表单组件

| 组件 | type | 默认属性 | 可配置字段 |
| --- | --- | --- | --- |
| 单行输入 | `Input` | name='input', label='输入框', placeholder='请输入', defaultValue='', clearable=true, layout='vertical', labelWidth='96px', required=false | name(input), label(input), placeholder(input), defaultValue(input), clearable(switch), layout(select), labelWidth(input), required(switch) |
| 多行文本 | `Textarea` | name='textarea', label='多行文本', placeholder='请输入内容', defaultValue='', rows=3, layout='vertical', labelWidth='96px', required=false | name(input), label(input), placeholder(input), defaultValue(input), rows(number), layout(select), labelWidth(input), required(switch) |
| 数字输入 | `Number` | name='number', label='数字', min=0, max=100, step=1, defaultValue=0, layout='vertical', labelWidth='96px', required=false | name(input), label(input), min(number), max(number), step(number), defaultValue(number), layout(select), labelWidth(input), required(switch) |
| 下拉选择 | `Select` | name='select', label='下拉选择', placeholder='请选择', multiple=false, clearable=true, optionsSource='', options=[{"label":"选项一","value":"1"},{"label":"选项二","value":"2"}], layout='vertical', labelWidth='96px', required=false | name(input), label(input), placeholder(input), optionsSource(datasource), options(options), multiple(switch), clearable(switch), layout(select), labelWidth(input), required(switch) |
| 单选组 | `Radio` | name='radio', label='单选', defaultValue='', optionsSource='', options=[{"label":"选项一","value":"1"},{"label":"选项二","value":"2"}], layout='vertical', labelWidth='96px', required=false | name(input), label(input), optionsSource(datasource), options(options), defaultValue(input), layout(select), labelWidth(input), required(switch) |
| 多选组 | `Checkbox` | name='checkbox', label='多选', optionsSource='', options=[{"label":"选项一","value":"1"},{"label":"选项二","value":"2"}], layout='vertical', labelWidth='96px', required=false | name(input), label(input), optionsSource(datasource), options(options), layout(select), labelWidth(input), required(switch) |
| 开关 | `Switch` | name='switch', label='开关', activeText='开', inactiveText='关', defaultValue=false, layout='vertical', labelWidth='96px', required=false | name(input), label(input), activeText(input), inactiveText(input), layout(select), labelWidth(input), required(switch) |
| 日期选择 | `DatePicker` | name='date', label='日期', type='date', placeholder='请选择日期', defaultValue='', layout='vertical', labelWidth='96px', required=false | name(input), label(input), type(select), placeholder(input), layout(select), labelWidth(input), required(switch) |
| 滑块 | `Slider` | name='slider', label='滑块', min=0, max=100, step=1, defaultValue=30, showInput=false, layout='vertical', labelWidth='96px', required=false | name(input), label(input), min(number), max(number), step(number), defaultValue(number), showInput(switch), layout(select), labelWidth(input), required(switch) |
| 评分 | `Rate` | name='rate', label='评分', max=5, defaultValue=3, allowHalf=false, layout='vertical', labelWidth='96px', required=false | name(input), label(input), max(number), defaultValue(number), allowHalf(switch), layout(select), labelWidth(input), required(switch) |

#### 数据展示

| 组件 | type | 默认属性 | 可配置字段 |
| --- | --- | --- | --- |
| 数据表格 | `Table` | dataSource='', columnTitles='', stripe=true, border=false, size='default', maxHeight=0, emptyText='暂无数据' | dataSource(datasource), columnTitles(input), size(select), stripe(switch), border(switch), maxHeight(number), emptyText(input) |
| 指标卡 | `Statistic` | title='指标名称', value='1,280', prefix='', suffix='', precision=0, color='#101828', background='#ffffff', border=true | title(input), value(input), prefix(input), suffix(input), precision(number), color(color), background(color), border(switch) |
| 进度条 | `Progress` | percentage=60, strokeWidth=10, status='', showText=true, color='#3b6ef6' | percentage(slider), strokeWidth(number), status(select), showText(switch), color(color) |

<!-- PROPS-AUTO:END -->
