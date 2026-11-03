<template>
  <div class="panel-search">
    <el-input v-model="keyword" placeholder="搜索组件" size="small" clearable>
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>
    <!-- 添加方式说明：很多新用户不知道「双击也能加」，一句话说明成本最低 -->
    <div class="hint" style="margin-top: 6px">拖拽到画布，或双击追加到页面末尾</div>
  </div>

  <div class="comp-groups">
    <template v-for="group in filteredGroups" :key="group.title">
      <div class="comp-group__title">{{ group.title }}</div>
      <div class="comp-grid">
        <div
          v-for="item in group.items"
          :key="panelKey(item)"
          class="comp-item"
          draggable="true"
          :title="`拖拽到画布，或双击追加到页面底部`"
          @dragstart="onDragStart($event, item)"
          @dragend="store.endDrag()"
          @dblclick="onDblClick(item)"
        >
          <span class="comp-item__icon"><el-icon><component :is="itemMeta(item).icon" /></el-icon></span>
          <span class="comp-item__label">{{ itemMeta(item).label }}</span>
        </div>
      </div>
    </template>
    <el-empty v-if="!filteredGroups.length" description="没有匹配的组件" :image-size="60" />
  </div>
</template>

<script setup>
/**
 * 左侧组件面板
 * ------------------------------------------------------------
 * 功能：按分组展示可用组件，支持搜索过滤。
 * 业务：两种添加方式——拖拽（可精确控制落点）与双击（追加到当前选中节点末尾）。
 *      双击是给「不想拖拽」的用户留的快捷路径，目标节点取当前选中项，
 *      没有选中则加到页面根部，保证任何情况下双击都有确定的行为。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useDesignerStore } from '@/stores/designer'
import { groups, registry } from '@/registry'

const store = useDesignerStore()
const keyword = ref('')

/**
 * 面板条目归一化：字符串 = 直接取注册表；对象 = 同一组件的预设变体（如横向容器）。
 * 变体拖进画布后就是普通 Container，属性随意再改，不产生新类型（服务端白名单不变）。
 */
function itemMeta(item) {
  if (typeof item === 'string') return { type: item, label: registry[item].label, icon: registry[item].icon }
  return { type: item.type, label: item.label, icon: item.icon, presetProps: item.presetProps }
}

function panelKey(item) {
  return typeof item === 'string' ? item : `${item.type}:${item.label}`
}

/** 搜索过滤：变体按自己的显示名匹配 */
const filteredGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return groups
  return groups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => {
        const meta = itemMeta(item)
        return meta.label.includes(kw) || meta.type.toLowerCase().includes(kw) || meta.label.toLowerCase().includes(kw)
      })
    }))
    .filter((group) => group.items.length)
})

function onDragStart(event, item) {
  const meta = itemMeta(item)
  store.startDrag({ kind: 'new', type: meta.type, presetProps: meta.presetProps })
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/plain', meta.type)
  }
}

function onDblClick(item) {
  const meta = itemMeta(item)
  const target = store.selectedId === 'root' ? 'root' : store.selectedId
  store.addNode(meta.type, target, 'inside', meta.presetProps)
  ElMessage.success(`已添加「${meta.label}」`)
}
</script>
