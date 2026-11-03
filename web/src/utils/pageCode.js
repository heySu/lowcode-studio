/**
 * 页面代码导入导出
 * ------------------------------------------------------------
 * 功能：
 *   1. buildPagePackage：把当前画布打成「标准导出包」（带 format/version/导出时间），
 *      用于跨环境迁移、版本归档、交接备份；
 *   2. generateHtmlCode：把页面导出成**可直接打开运行的单文件 HTML**——
 *      内嵌 schema、数据源和一份运行态渲染器，双击即用，不依赖本平台；
 *   3. parseImportText：导入前在浏览器侧做结构与格式识别，给出可读的错误提示；
 *   4. 下载与文件名清洗。
 * 业务约定（改代码前务必确认）：
 *   - 导出包是「对外契约」：字段（format/version/page/schema/datasources）一旦发布不能随意改名，
 *     否则用户历史导出的文件将无法导入；新增字段只能追加；
 *   - 导出的 HTML 必须与设计器渲染一致：容器弹性规则、行内均分、表单字段、数据源绑定、
 *     {{form.x}} 插值、按钮动作这六项最容易走偏，改动时需同步 NodeRenderer.vue 与下方 RUNTIME；
 *   - HTML 仅通过 CDN 依赖 Vue3 与 Element Plus（离线环境需自行替换为本地文件），
 *     加载失败时页面会给出明确提示而不是白屏。
 */
export const EXPORT_FORMAT = 'lowcode-page'
export const EXPORT_VERSION = 1

/** 导出包格式的展示名，导入弹窗用来告诉用户「这是哪种文件」 */
export const FORMAT_LABELS = {
  'lowcode-page': '标准导出包',
  'legacy-json': '旧版导出文件',
  'raw-schema': '页面结构（裸 schema）'
}

const clone = (value) => JSON.parse(JSON.stringify(value ?? null))

/** 统计组件数量（与 utils/tree.countNodes 规则一致，避免为了一个计数引入依赖） */
export function countPackageNodes(node) {
  if (!node) return 0
  const self = node.type === 'Page' ? 0 : 1
  return (node.children || []).reduce((sum, child) => sum + countPackageNodes(child), self)
}

/**
 * 构造标准导出包
 * 业务：page 里只放「描述性信息」，运行所需的 schema / datasources 平铺在顶层，
 *      这样导入方不需要理解平台内部结构也能读懂文件。
 */
export function buildPagePackage({ name, description = '', schema, datasources = [] }) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    page: {
      name: name || '未命名页面',
      description: description || ''
    },
    datasources: clone(datasources) || [],
    schema: clone(schema) || { id: 'root', type: 'Page', props: {}, style: {}, children: [] }
  }
}

// ---------------------------------------------------------------- 导入解析

/**
 * 解析导入文本
 * 业务：这里只做「能不能认出这是页面文件」的判断——组件白名单、嵌套深度、体积
 *      等硬性校验由服务端 /api/pages/import 负责，前端不重复实现一套规则，
 *      否则两端规则一旦不一致，就会出现「前端说没问题、保存却失败」的割裂体验。
 */
export function parseImportText(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('内容为空，请选择文件或粘贴页面 JSON 后再试')

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`不是合法的 JSON：${err.message}`)
  }

  const isPage = (value) => Boolean(value) && typeof value === 'object' && value.type === 'Page'

  let pkg
  if (isPage(parsed)) {
    // 裸 schema：用户可能只复制了组件树
    pkg = {
      format: 'raw-schema',
      version: 1,
      page: { name: '导入的页面', description: '' },
      schema: parsed,
      datasources: []
    }
  } else if (isPage(parsed.schema)) {
    pkg = {
      format: typeof parsed.format === 'string' && parsed.format ? parsed.format : 'legacy-json',
      version: Number(parsed.version) || 1,
      page: {
        name: parsed.page?.name || parsed.name || '导入的页面',
        description: parsed.page?.description || parsed.description || ''
      },
      schema: parsed.schema,
      datasources: Array.isArray(parsed.datasources) ? parsed.datasources : []
    }
  } else {
    throw new Error('文件里没有找到页面结构：schema 根节点必须是 Page 类型')
  }

  return { pkg, summary: summarizePackage(pkg) }
}

/** 导入摘要：文件名、组件数、数据源数、导出时间，供确认前预览 */
export function summarizePackage(pkg) {
  return {
    name: pkg.page?.name || '导入的页面',
    description: pkg.page?.description || '',
    nodes: countPackageNodes(pkg.schema),
    datasourceCount: (pkg.datasources || []).length,
    format: pkg.format,
    formatLabel: FORMAT_LABELS[pkg.format] || pkg.format,
    version: pkg.version || 1,
    exportedAt: pkg.exportedAt || ''
  }
}

// ---------------------------------------------------------------- 下载

/** 去掉 Windows/macOS 文件名非法字符，避免下载失败或文件名乱码 */
export function sanitizeFileName(name, fallback = 'page') {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|\n\r\t]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return cleaned || fallback
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // 立即 revoke 在部分浏览器会打断下载，延后释放更稳
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadPageJson(pkg) {
  const name = sanitizeFileName(pkg.page?.name, 'page')
  downloadText(`${name}.page.json`, JSON.stringify(pkg, null, 2), 'application/json;charset=utf-8')
}

export function downloadPageHtml(pkg) {
  const name = sanitizeFileName(pkg.page?.name, 'page')
  downloadText(`${name}.html`, generateHtmlCode(pkg), 'text/html;charset=utf-8')
}

// ---------------------------------------------------------------- HTML 代码导出

const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * 把 JSON 安全地嵌进 <script>：
 * 直接 JSON.stringify 可能因为字符串里含 </script> 提前闭合标签，导致整页代码被截断。
 * 这里把 < 转成 \u003c（JSON 解析后仍是原文），是最省心的做法。
 */
function jsonForScript(value) {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c')
}

/** 导出页面的基础样式：只放运行态需要的排版，设计器的选中框/徽标一律不带出去 */
const EXPORT_CSS = `
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #f5f6f8;
  color: #101828;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.lc-page { max-width: 960px; margin: 0 auto; padding: 28px 22px 48px; }
.lc-node { min-width: 0; }
.lc-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.lc-field--horizontal { flex-direction: row; align-items: center; gap: 10px; }
.lc-field--horizontal .lc-field__label { flex: 0 0 auto; text-align: right; }
.lc-field__label { font-size: 13px; color: #344054; line-height: 1.5; }
.lc-req { color: #f04438; margin-left: 2px; }
.lc-field__control { min-width: 0; }
.lc-card__title { font-size: 14px; font-weight: 600; color: #101828; }
.lc-stat { border-radius: 10px; padding: 16px 18px; }
.lc-stat__title { font-size: 12px; color: #667085; margin-bottom: 6px; }
.lc-stat__value { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2; }
.lc-stat__affix { font-size: 13px; font-weight: 500; color: #667085; }
.lc-unknown { padding: 8px 12px; border: 1px dashed #f04438; color: #b42318; font-size: 12px; border-radius: 6px; }
.lc-boot { padding: 60px 24px; text-align: center; color: #667085; font-size: 14px; }
.lc-boot--error { max-width: 620px; margin: 40px auto; text-align: left; background: #fff; border: 1px solid #fecdca; border-radius: 10px; padding: 24px; }
.lc-boot--error h2 { margin: 0 0 10px; font-size: 16px; color: #b42318; }
.lc-boot__hint { color: #667085; font-size: 13px; line-height: 1.7; }
body.lc-isolated .el-input__wrapper,
body.lc-isolated .el-select__wrapper { width: 100%; }
`

/**
 * 运行态渲染器（导出到 HTML 内的脚本）
 * ------------------------------------------------------------
 * 与 web/src/components/NodeRenderer.vue 一一对应，差异只有两处：
 *   1. 没有设计态逻辑（选中、拖拽、徽标），只保留真实渲染；
 *   2. 用 h() 函数而不是模板字符串，避免导出文件依赖 Vue 的模板编译器。
 * 注意：这里刻意只用字符串拼接、不使用模板字符串与 ${}，整段会被原样写进导出文件。
 */
const RUNTIME = String.raw`
(function () {
  var PAGE = window.__LC_PAGE__ || { schema: null, datasources: [] };
  var mount = document.getElementById('app');
  var booted = false;

  function fail(message) {
    if (booted) return;
    booted = true;
    mount.innerHTML =
      '<div class="lc-boot lc-boot--error">' +
      '<h2>页面无法运行</h2>' +
      '<p>' + String(message || '未知错误') + '</p>' +
      '<p class="lc-boot__hint">本文件通过 CDN 加载 Vue 3 与 Element Plus：请确认网络可访问 unpkg.com，' +
      '或把这两个库下载到本地后修改文件末尾的 script 地址。</p>' +
      '</div>';
  }

  if (!window.Vue || !window.ElementPlus) {
    fail('依赖脚本加载失败（Vue 或 Element Plus 未就绪）。');
    return;
  }

  var Vue = window.Vue;
  var EP = window.ElementPlus;
  var h = Vue.h;
  var reactive = Vue.reactive;

  var INLINE_TYPES = ['Button', 'Tag', 'Title', 'Text', 'Divider'];
  var FORM_TYPES = ['Input', 'Textarea', 'Number', 'Select', 'Radio', 'Checkbox', 'Switch', 'DatePicker', 'Slider', 'Rate'];
  var PX_KEYS = ['width', 'height', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'padding', 'borderRadius'];

  var form = reactive({});
  var data = reactive({});

  function ctx() {
    return Object.assign({ form: form }, data);
  }

  function pick(path, source) {
    return String(path).split('.').reduce(function (acc, key) {
      return acc == null ? acc : acc[key];
    }, source);
  }

  function tpl(value, source) {
    if (typeof value !== 'string' || value.indexOf('{{') < 0) return value;
    return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, function (raw, expr) {
      var val = pick(expr.trim(), source);
      if (val == null) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
  }

  function text(value) {
    return tpl(value, ctx());
  }

  function css(style) {
    var out = {};
    Object.keys(style || {}).forEach(function (key) {
      var value = style[key];
      if (value === '' || value == null) return;
      if (PX_KEYS.indexOf(key) >= 0) {
        out[key] = (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) ? value + 'px' : value;
      } else if (key === 'opacity') {
        out[key] = Number(value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  function wrapperStyle(node, dir) {
    var style = css(node.style);
    if (dir === 'row' && !style.flex && !style.width) {
      if (INLINE_TYPES.indexOf(node.type) >= 0) {
        style.flex = '0 0 auto';
      } else {
        style.flex = '1 1 0%';
      }
      style.minWidth = 0;
    }
    return style;
  }

  function containerStyle(p) {
    return {
      display: 'flex',
      flexDirection: p.direction === 'row' ? 'row' : 'column',
      flexWrap: p.wrap ? 'wrap' : 'nowrap',
      gap: (p.gap == null ? 12 : p.gap) + 'px',
      padding: (p.padding == null ? 0 : p.padding) + 'px',
      background: p.background || 'transparent',
      border: p.border ? '1px solid #eaecf0' : '1px solid transparent',
      borderRadius: (p.radius == null ? 8 : p.radius) + 'px',
      justifyContent: p.justify || 'flex-start',
      alignItems: p.align || 'stretch',
      minHeight: p.minHeight ? p.minHeight + 'px' : '0px',
      width: '100%'
    };
  }

  function optionsOf(p) {
    if (p.optionsSource && Array.isArray(data[p.optionsSource])) {
      return data[p.optionsSource].map(function (item) {
        if (item && typeof item === 'object') {
          var label = item.label != null ? item.label : (item.name != null ? item.name : String(item.value == null ? '' : item.value));
          return { label: label, value: item.value != null ? item.value : (item.id != null ? item.id : label) };
        }
        return { label: String(item), value: item };
      });
    }
    return Array.isArray(p.options) ? p.options : [];
  }

  function initForm(schema) {
    (function walk(node) {
      (node.children || []).forEach(function (child) {
        var p = child.props || {};
        if (FORM_TYPES.indexOf(child.type) >= 0 && p.name) {
          form[p.name] = child.type === 'Checkbox' ? [] : (p.defaultValue !== undefined ? p.defaultValue : '');
        }
        walk(child);
      });
    })(schema || {});
  }

  function loadDatasources(list) {
    (list || []).forEach(function (ds) {
      if (!ds || !ds.name) return;
      if (ds.type === 'api' && ds.url) {
        window.fetch(ds.url, { method: ds.method || 'GET' })
          .then(function (res) { return res.json(); })
          .then(function (json) {
            data[ds.name] = Array.isArray(json) ? json : (json && Array.isArray(json.data) ? json.data : []);
          })
          .catch(function () { data[ds.name] = []; });
      } else {
        try {
          data[ds.name] = JSON.parse(ds.json || '[]');
        } catch (e) {
          data[ds.name] = [];
        }
      }
    });
  }

  function runAction(node) {
    var action = (node.props || {}).action || {};
    if (action.type === 'message') {
      EP.ElMessage.success(action.text || '操作成功');
    } else if (action.type === 'link') {
      if (action.url) window.open(action.url, '_blank');
      else EP.ElMessage.warning('未配置跳转地址');
    } else if (action.type === 'reset') {
      Object.keys(form).forEach(function (key) { delete form[key]; });
      EP.ElMessage.info('表单已重置');
    } else if (action.type === 'request') {
      if (!action.url) { EP.ElMessage.warning('未配置请求地址'); return; }
      var isGet = (action.method || 'POST') === 'GET';
      window.fetch(action.url, {
        method: action.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isGet ? undefined : JSON.stringify(action.includeForm ? Object.assign({}, form) : {})
      }).then(function (res) {
        return res.json().catch(function () { return {}; });
      }).then(function (payload) {
        var msg = (payload && payload.data && payload.data.message) || action.text || '请求成功';
        EP.ElMessage.success(msg);
      }).catch(function (err) {
        EP.ElMessage.error('请求失败：' + err.message);
      });
    }
  }

  function control(node) {
    var p = node.props || {};
    var name = p.name || '';
    var model = {
      modelValue: form[name],
      'onUpdate:modelValue': function (value) { form[name] = value; }
    };
    switch (node.type) {
      case 'Input':
        return h(EP.ElInput, Object.assign({ placeholder: p.placeholder, clearable: !!p.clearable }, model));
      case 'Textarea':
        return h(EP.ElInput, Object.assign({ type: 'textarea', rows: p.rows || 3, placeholder: p.placeholder }, model));
      case 'Number':
        return h(EP.ElInputNumber, Object.assign({ min: p.min, max: p.max, step: p.step, controlsPosition: 'right', style: { width: '100%' } }, model));
      case 'Select':
        return h(EP.ElSelect, Object.assign({
          placeholder: p.placeholder,
          multiple: !!p.multiple,
          clearable: !!p.clearable,
          style: { width: '100%' }
        }, model), function () {
          return optionsOf(p).map(function (opt) {
            return h(EP.ElOption, { key: String(opt.value), label: opt.label, value: opt.value });
          });
        });
      case 'Radio':
        return h(EP.ElRadioGroup, model, function () {
          return optionsOf(p).map(function (opt) {
            return h(EP.ElRadio, { key: String(opt.value), value: opt.value }, function () { return opt.label; });
          });
        });
      case 'Checkbox':
        return h(EP.ElCheckboxGroup, model, function () {
          return optionsOf(p).map(function (opt) {
            return h(EP.ElCheckbox, { key: String(opt.value), value: opt.value }, function () { return opt.label; });
          });
        });
      case 'Switch':
        return h(EP.ElSwitch, Object.assign({ activeText: p.activeText, inactiveText: p.inactiveText }, model));
      case 'DatePicker':
        return h(EP.ElDatePicker, Object.assign({
          type: p.type || 'date',
          placeholder: p.placeholder,
          style: { width: '100%' },
          valueFormat: 'YYYY-MM-DD'
        }, model));
      case 'Slider':
        return h(EP.ElSlider, Object.assign({ min: p.min, max: p.max, step: p.step, showInput: !!p.showInput }, model));
      case 'Rate':
        return h(EP.ElRate, Object.assign({ max: p.max || 5, allowHalf: !!p.allowHalf }, model));
      default:
        return null;
    }
  }

  function formField(node) {
    var p = node.props || {};
    var label = p.label ? h('label', {
      class: 'lc-field__label',
      style: p.layout === 'horizontal' ? { width: p.labelWidth || '96px' } : null
    }, [
      text(p.label),
      p.required ? h('span', { class: 'lc-req' }, '*') : null
    ]) : null;
    return h('div', { class: 'lc-field lc-field--' + (p.layout || 'vertical') }, [
      label,
      h('div', { class: 'lc-field__control' }, [control(node)])
    ]);
  }

  function tableNode(node) {
    var p = node.props || {};
    var rows = p.dataSource && Array.isArray(data[p.dataSource]) ? data[p.dataSource] : [];
    if (!rows.length) {
      return h(EP.ElEmpty, { description: p.emptyText || '暂无数据', imageSize: 60 });
    }
    var titles = {};
    String(p.columnTitles || '').split(',').forEach(function (pair) {
      var kv = pair.split(':');
      if (kv[0] && kv[0].trim()) titles[kv[0].trim()] = (kv[1] || kv[0]).trim();
    });
    var sample = rows[0];
    var cols = (sample && typeof sample === 'object' && !Array.isArray(sample))
      ? Object.keys(sample)
      : ['value'];
    return h('div', null, [
      h(EP.ElTable, {
        data: rows,
        stripe: !!p.stripe,
        border: !!p.border,
        size: p.size || 'default',
        maxHeight: p.maxHeight || undefined,
        style: { width: '100%' },
        emptyText: ''
      }, function () {
        return cols.map(function (col) {
          return h(EP.ElTableColumn, {
            key: col,
            prop: col,
            label: titles[col] || (col === 'value' ? '数据' : col),
            showOverflowTooltip: true,
            minWidth: 120
          });
        });
      })
    ]);
  }

  function statisticNode(node) {
    var p = node.props || {};
    var raw = text(p.value);
    var precision = Number(p.precision || 0);
    var numeric = Number(raw);
    var shown = (!isNaN(numeric) && precision > 0) ? numeric.toFixed(precision) : raw;
    return h('div', {
      class: 'lc-stat',
      style: {
        background: p.background || '#fff',
        border: p.border ? '1px solid #eaecf0' : '1px solid transparent',
        borderRadius: '10px',
        padding: '16px 18px'
      }
    }, [
      h('div', { class: 'lc-stat__title' }, text(p.title)),
      h('div', { class: 'lc-stat__value', style: { color: p.color || '#101828' } }, [
        p.prefix ? h('span', { class: 'lc-stat__affix' }, p.prefix) : null,
        shown,
        p.suffix ? h('span', { class: 'lc-stat__affix' }, p.suffix) : null
      ])
    ]);
  }

  function renderNode(node, dir) {
    if (!node || !node.type) return null;
    var p = node.props || {};
    var body = null;

    if (node.type === 'Container') {
      body = h('div', {
        class: 'lc-flex',
        style: containerStyle(p)
      }, children(node, p.direction === 'row' ? 'row' : 'column'));
    } else if (node.type === 'Card') {
      body = h(EP.ElCard, {
        shadow: p.shadow || 'never',
        bodyStyle: { padding: (p.padding == null ? 16 : p.padding) + 'px' }
      }, {
        default: function () { return children(node, 'column'); },
        header: p.title ? function () { return h('span', { class: 'lc-card__title' }, text(p.title)); } : undefined
      });
    } else if (node.type === 'Divider') {
      body = h(EP.ElDivider, { contentPosition: p.position || 'center' }, function () {
        return p.text ? text(p.text) : '';
      });
    } else if (node.type === 'Title') {
      body = h('h' + (p.level || 2), {
        style: {
          margin: 0,
          textAlign: p.align,
          color: p.color,
          fontWeight: p.weight || 700,
          fontSize: [30, 24, 20, 17, 15][(p.level || 2) - 1] + 'px',
          lineHeight: 1.4
        }
      }, text(p.text));
    } else if (node.type === 'Text') {
      body = h('p', {
        style: {
          margin: 0,
          textAlign: p.align,
          color: p.color,
          fontWeight: p.weight || 400,
          fontSize: (p.size || 14) + 'px',
          lineHeight: p.lineHeight || 1.7
        }
      }, text(p.content));
    } else if (node.type === 'Button') {
      body = h(EP.ElButton, {
        type: p.type,
        size: p.size,
        plain: !!p.plain,
        round: !!p.round,
        style: p.block ? { width: '100%' } : null,
        onClick: function () { runAction(node); }
      }, function () { return text(p.text); });
    } else if (node.type === 'Image') {
      body = h('img', {
        src: p.src,
        alt: '',
        style: {
          width: '100%',
          height: (p.height || 200) + 'px',
          objectFit: p.fit || 'cover',
          borderRadius: (p.radius || 0) + 'px',
          display: 'block'
        }
      });
    } else if (node.type === 'Alert') {
      body = h(EP.ElAlert, {
        title: text(p.title),
        type: p.type || 'info',
        description: text(p.description),
        closable: !!p.closable,
        showIcon: p.showIcon !== false
      });
    } else if (node.type === 'Tag') {
      body = h(EP.ElTag, { type: p.type, size: p.size, effect: p.effect }, function () { return text(p.text); });
    } else if (node.type === 'Table') {
      body = tableNode(node);
    } else if (node.type === 'Statistic') {
      body = statisticNode(node);
    } else if (node.type === 'Progress') {
      body = h(EP.ElProgress, {
        percentage: Number(p.percentage) || 0,
        strokeWidth: p.strokeWidth || 10,
        status: p.status || undefined,
        color: p.color,
        showText: p.showText !== false
      });
    } else if (FORM_TYPES.indexOf(node.type) >= 0) {
      body = formField(node);
    } else {
      body = h('div', { class: 'lc-unknown' }, '未知组件：' + node.type);
    }

    return h('div', { class: 'lc-node', style: wrapperStyle(node, dir) }, [body]);
  }

  function children(node, dir) {
    return (node.children || []).map(function (child) {
      return h(LcNode, { key: child.id, node: child, dir: dir });
    });
  }

  var LcNode = {
    name: 'LcNode',
    props: {
      node: { type: Object, required: true },
      dir: { type: String, default: 'column' }
    },
    setup: function (props) {
      return function () { return renderNode(props.node, props.dir); };
    }
  };

  var App = {
    setup: function () {
      return function () {
        return h('div', { class: 'lc-page' }, children(PAGE.schema || {}, 'column'));
      };
    }
  };

  try {
    initForm(PAGE.schema);
    loadDatasources(PAGE.datasources);
    booted = true;
    Vue.createApp(App).use(EP).mount('#app');
  } catch (err) {
    booted = false;
    fail((err && err.message) || String(err));
  }
})();
`

/**
 * 生成可运行的单文件 HTML
 * 业务：所有资源都内联，只依赖两个 CDN 脚本；文件可以被随便转发，
 *      对方不需要安装任何环境、也不需要访问本平台。
 */
export function generateHtmlCode(pkg) {
  const title = escapeHtml(pkg.page?.name || '页面')
  const description = escapeHtml(pkg.page?.description || '')
  const payload = jsonForScript({ schema: pkg.schema, datasources: pkg.datasources || [] })

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="generator" content="LowCode Studio 页面代码导出" />
<link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />
<style>${EXPORT_CSS}</style>
</head>
<body>
<div id="app"><div class="lc-boot">页面加载中…</div></div>
<noscript><div class="lc-boot lc-boot--error"><h2>需要启用 JavaScript</h2><p>这是一个前端页面，请启用浏览器 JavaScript 后重新打开。</p></div></noscript>

<!-- 页面结构与数据源（由 LowCode Studio 导出，可直接修改） -->
<script>
window.__LC_PAGE__ = ${payload};
</script>

<!-- 运行时依赖：如需离线使用，把这两个文件下载到本地并改写下面的地址 -->
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://unpkg.com/element-plus/dist/index.full.min.js"></script>
<script>${RUNTIME}</script>
</body>
</html>
`
}
