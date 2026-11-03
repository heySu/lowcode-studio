import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 路由表
 * ------------------------------------------------------------
 * 功能：页面列表 / 设计器 / 运行态三块，配合 404 兜底。
 * 业务：使用 hash 模式，静态托管（Nginx / 对象存储 / 内网文件服务）时无需额外配置 rewrite，
 *      减少上线时的运维沟通成本；如果改用 history 模式，需在服务器配置 fallback 到 index.html。
 */
const routes = [
  { path: '/', name: 'pages', component: () => import('@/views/PageList.vue') },
  { path: '/designer/:id', name: 'designer', component: () => import('@/views/Designer.vue') },
  { path: '/view/:id', name: 'viewer', component: () => import('@/views/Viewer.vue') },
  // 接入指南：讲清怎么把页面嵌入/跳转/交付到其它系统，并给出可复制的代码
  { path: '/integration', name: 'integration', component: () => import('@/views/Integration.vue') },
  // 设计规范：把 tokens.css 的设计令牌渲染成活文档，规范与实现同源
  { path: '/spec', name: 'design-spec', component: () => import('@/views/DesignSpec.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFound.vue') }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // 切换页面回到顶部，避免从长页面进入设计器时停在半空
  scrollBehavior: () => ({ top: 0 })
})

export default router
