<template>
  <div v-if="error" class="lc-boundary">
    <div class="lc-boundary__title">内容渲染失败</div>
    <div class="lc-boundary__msg">{{ error.message || '未知错误' }}</div>
    <div class="lc-boundary__ops">
      <el-button size="small" type="primary" @click="retry">重试</el-button>
      <el-button v-if="showEdit" size="small" @click="$emit('edit')">去修改组件</el-button>
    </div>
  </div>
  <slot v-else />
</template>

<script setup>
/**
 * 渲染错误边界
 * ------------------------------------------------------------
 * 功能：拦截子树渲染期间的异常，避免一个坏组件导致整页白屏。
 * 业务：低代码平台的 schema 由用户拼装，配置错误（例如图片地址异常、超深嵌套）
 *      属于常态。线上如果整页白屏，用户既看不到导航也拿不到错误信息，
 *      只能报「页面打不开」；这里把故障收敛到局部，并保留可操作按钮。
 */
import { onErrorCaptured, ref, watch } from 'vue'

const props = defineProps({
  /** 变化时自动清除错误状态（例如切换选中的组件、撤销操作） */
  resetKey: { type: [String, Number], default: '' },
  showEdit: { type: Boolean, default: false }
})
defineEmits(['edit'])

const error = ref(null)

onErrorCaptured((err) => {
  error.value = err
  // 打印到控制台，便于线上用监控 SDK 采集（window.onerror 同样会收到）
  console.error('[render-boundary]', err)
  // 返回 false 阻止错误继续向上冒泡，避免整个应用被卸载
  return false
})

watch(
  () => props.resetKey,
  () => {
    error.value = null
  }
)

function retry() {
  error.value = null
}
</script>

<style scoped>
.lc-boundary {
  border: 1px dashed var(--lc-danger);
  background: var(--lc-surface)5f4;
  border-radius: 8px;
  padding: 14px 16px;
  margin: 6px 0;
}
.lc-boundary__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lc-danger-text);
  margin-bottom: 4px;
}
.lc-boundary__msg {
  font-size: 12px;
  color: var(--lc-danger-text);
  opacity: 0.85;
  word-break: break-all;
  margin-bottom: 10px;
}
.lc-boundary__ops {
  display: flex;
  gap: 8px;
}
</style>
