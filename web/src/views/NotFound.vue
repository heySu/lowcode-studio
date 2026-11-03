<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="brand__logo">LC</span>
        LowCode Studio
      </div>
      <span class="grow" />
      <el-button size="small" @click="goHome">返回页面列表</el-button>
    </header>
    <div class="list-page">
      <div class="list-inner">
        <el-result icon="info" title="页面不存在" sub-title="链接可能已失效，或该页面已被删除。">
          <template #extra>
            <el-button type="primary" @click="goHome">回到首页</el-button>
          </template>
        </el-result>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 404 页面
 * 功能：兜底未匹配的路由。
 * 业务：用户可能访问了旧的分享链接或手误输错地址，必须给出明确出口，
 *      不能白屏或者停在加载态。
 */
import { useRouter } from 'vue-router'

const router = useRouter()
const goHome = () => router.push('/')
</script>
