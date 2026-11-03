<template>
  <router-view />
</template>

<script setup>
/**
 * 应用根组件
 * ------------------------------------------------------------
 * 功能：承载路由 + 启动自检。
 * 业务：低代码平台所有页面都依赖后端接口，如果后端没起来，
 *      路由页面只会各自报错，用户看不出根因。这里在启动时做一次健康检查，
 *      统一给出「后端未连接」的明确提示，避免用户以为页面坏了。
 */
import { onMounted } from 'vue'
import { ElNotification } from 'element-plus'
import { pageApi } from '@/api'

onMounted(async () => {
  try {
    await pageApi.health()
  } catch (err) {
    ElNotification({
      title: '后端服务未连接',
      message: `${err.message}。请先在项目根目录执行 npm run dev，再刷新页面。`,
      type: 'error',
      duration: 0,
      showClose: true
    })
  }
})
</script>
