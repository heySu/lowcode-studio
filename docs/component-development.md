# 组件开发指南

组件由注册表驱动：**一份配置同时驱动四个地方**，缺一处就会互相脱节。

| 消费方 | 读取内容 |
| --- | --- |
| 左侧组件面板（ComponentPanel） | `label` / `icon` / 分组 |
| 右侧属性面板（PropPanel → PropField） | `fields` 定义的可配置项与默认值 |
| 运行时渲染（NodeRenderer / pageCode.js 导出渲染器） | 按 `type` 分发的渲染分支 |
| 服务端校验（server/src/validate.js） | `ALLOWED_TYPES` 类型白名单 |

## 新增组件六步

以下用新增 `ColorPicker`（表单组件）举例。

### 1. 注册表加定义（web/src/registry/index.js）

```js
ColorPicker: {
  label: '颜色选择',
  icon: 'Brush',
  acceptsChildren: false,
  // 默认属性必须是「布局中立」的：无内边距、无边框、透明背景。
  // 容器类组件尤其如此——默认带卡片外观是历史上造成「新增元素后错位」的根因。
  props: () => ({ name: 'color', label: '颜色', defaultValue: '', showAlpha: false }),
  fields: [
    { key: 'name', label: '字段名', type: 'input', tip: '表单提交与插值引用的键' },
    { key: 'label', label: '标签', type: 'input' },
    { key: 'defaultValue', label: '默认值', type: 'input' },
    { key: 'showAlpha', label: '支持透明度', type: 'switch' }
  ]
}
```

`fields` 的 `type` 可选：`input | textarea | number | switch | select | color | slider | options | datasource | action`。

若需要出现在面板里，把 `'ColorPicker'` 加进 `groups` 对应分组；表单组件加入 `formTypes` 相关列表（面板与 form 模型构建共用）。

### 2. 渲染分支（web/src/components/NodeRenderer.vue）

在 `renderProps`/模板的 type 分支中增加：

```js
case 'ColorPicker':
  return h(ElColorPicker, { modelValue: formModel[node.props.name], 'onUpdate:modelValue': (v) => (formModel[node.props.name] = v), showAlpha: node.props.showAlpha })
```

表单组件必须：
- 以 `props.name` 读写 `formModel`（缺失 name 时只展示、不入模）；
- 支持 `defaultValue` 初始化（由 `buildFormModel` 统一处理，无需组件内逻辑）；
- 设计态（`interactive=false`）下控件禁交互、由捕获阶段选中接管（全局样式已统一处理 `pointer-events:none`，无需单独写）。

### 3. 服务端白名单（server/src/validate.js）

把 `'ColorPicker'` 加入 `ALLOWED_TYPES`。**漏了这一步，含新组件的页面无法保存/导入（400）**——这是三处里最容易忘的。

### 4. 导出代码渲染器同步（web/src/utils/pageCode.js）

导出的单文件 HTML 内嵌一份独立渲染器，不经过 NodeRenderer。必须按第 2 步同样的行为补一个分支，并跑 `npm run test:e2e`（io-test 会校验导出 HTML 可渲染）。渲染器与 NodeRenderer 的行为清单：容器弹性布局、行内均分、表单 model 绑定、数据源加载、插值、按钮动作、嵌入消息——修改其中任何一处都要两边同步。

### 5. 表单模型与插值（如适用）

- 表单组件：`web/src/composables/usePageRuntime.js` 的 `buildFormModel` 已按 `fields` 泛化处理，通常无需改动；仅当组件有特殊值结构（如 Range）时补充。
- 展示组件需要插值支持：在 `renderTemplate` 的求值作用域里确认取值路径。

### 6. 文档与测试

- 执行 `npm run gen:props` 更新 `docs/page-schema.md` 属性附录（脚本从注册表源码生成，禁止手改）。
- 在 `scripts/e2e.mjs` 或对应专项测试中加用例：拖入 → 属性修改 → 保存 → 预览渲染 → 导出 HTML 渲染。
- 若组件有默认样式，确认满足「布局中立」原则（见 design-system.md）。

## 一致性自查清单

- [ ] 注册表 label/icon/fields 齐全，注释说明每个字段的业务含义
- [ ] NodeRenderer 渲染分支 + pageCode.js 导出渲染器行为一致
- [ ] validate.js 白名单已加类型
- [ ] 设计态禁交互（不额外写 pointer-events，交给全局规则）
- [ ] `npm run gen:props` 已执行，`npm run test:e2e` 全绿

## 常见坑

1. **只改了 NodeRenderer 没改 pageCode.js**：设计器正常、导出的 HTML 缺组件。
2. **只改了前端没加白名单**：保存时 400「不支持的组件类型」。
3. **容器类组件默认带 padding/边框**：用户往行里放就错位；默认必须布局中立。
4. **props 里放函数或复杂对象**：props 必须可 JSON 序列化（要落库、要 postMessage、要导出）。
