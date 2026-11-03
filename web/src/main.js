/**
 * 应用入口
 * ------------------------------------------------------------
 * 功能：装配 Pinia / Router / Element Plus，注册全局错误处理。
 * 业务：线上不能出现「点了没反应、页面空白」这种无声故障。
 *      任何未被业务代码捕获的异常都会在这里被记录并提示用户，
 *      同时标记 data-mounted 让 index.html 的启动兜底逻辑知道应用已正常运行。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import './styles/global.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

/** Vue 运行时异常：打印完整堆栈，并给用户可读提示 */
app.config.errorHandler = (err, instance, info) => {
  console.error('[vue-error]', err, info)
  ElMessage.error(`页面出现异常：${err?.message || '未知错误'}`)
}

/** 未捕获的 Promise 异常：接口层已做提示的错误不重复打扰用户 */
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  if (reason?.code === 'NETWORK' || reason?.code === 'TIMEOUT') return
  console.error('[unhandled-rejection]', reason)
})

app.mount('#app')

// 标记挂载完成，关闭 index.html 的启动兜底提示
document.getElementById('app')?.setAttribute('data-mounted', '1')
clearTimeout(window.__bootTimer)
