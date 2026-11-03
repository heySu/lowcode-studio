<template>
  <div class="center-scroll" @click.self="selectRoot">
    <div
      class="canvas-sheet"
      :class="{ 'lc-design': !store.interactive }"
      :style="rootTarget ? { boxShadow: 'inset 0 0 0 2px var(--lc-primary)' } : null"
      @dragover.prevent="onDragOver"
      @drop.prevent="onDrop"
      @click.capture="onCanvasClick"
      @click.self="selectRoot"
    >
      <!-- 交互预览提示：让用户明确「现在点控件是在试用，不是编辑」 -->
      <div v-if="store.interactive" class="canvas-interactive-tip">
        <el-icon><Mouse /></el-icon>
        交互预览中：控件可正常操作。关闭顶部「交互」开关可继续编辑
      </div>
      <div ref="rootRef" class="lc-root">
        <!-- 错误边界：单个组件配置异常时只坏这一块，设计器仍可继续编辑 -->
        <ErrorBoundary :reset-key="`${store.historyIndex}-${store.selectedId}`" show-edit @edit="store.select('root')">
          <NodeRenderer v-for="child in store.schema.children" :key="child.id" :node="child" />

          <!-- 空画布引导：新建页面后如果只有一句「拖入组件」，新用户会卡住。
               这里给三条可执行的路径（套模板 / 自己拖 / 看说明），并保留拖拽能力 -->
          <div v-if="!store.schema.children.length" class="canvas-guide">
            <div class="canvas-guide__icon"><el-icon><Grid /></el-icon></div>
            <div class="canvas-guide__title">这个页面还是空的</div>
            <div class="canvas-guide__desc">三种开始方式，选一个最顺手的：</div>

            <div class="canvas-guide__ways">
              <div class="canvas-guide__way">
                <span class="canvas-guide__way-index">1</span>
                <div>
                  <div class="canvas-guide__way-title">套用现成模板</div>
                  <div class="canvas-guide__way-text">表单、列表、看板、详情页，改改文字就能用</div>
                  <el-button type="primary" size="small" style="margin-top: 8px" @click.stop="emit('open-templates')">
                    选择模板
                  </el-button>
                </div>
              </div>
              <div class="canvas-guide__way">
                <span class="canvas-guide__way-index">2</span>
                <div>
                  <div class="canvas-guide__way-title">自己拖组件</div>
                  <div class="canvas-guide__way-text">
                    从左侧按住组件拖到这里，或双击组件直接追加到页面末尾
                  </div>
                </div>
              </div>
              <div class="canvas-guide__way">
                <span class="canvas-guide__way-index">3</span>
                <div>
                  <div class="canvas-guide__way-title">先看一遍使用说明</div>
                  <div class="canvas-guide__way-text">数据源怎么绑、按钮怎么配、发布是什么，都有讲解</div>
                  <el-button size="small" text type="primary" style="margin-top: 6px; padding-left: 0" @click.stop="emit('open-help')">
                    打开使用说明 →
                  </el-button>
                </div>
              </div>
            </div>

            <div class="canvas-guide__foot">快捷键：Ctrl+Z 撤销 · Ctrl+S 保存 · 选中组件后 Delete 删除</div>
          </div>
        </ErrorBoundary>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 画布
 * ------------------------------------------------------------
 * 功能：承载页面根节点，接收拖拽落点（空白区域 = 追加到页面末尾）；
 *      页面为空时展示上手引导，而不是只留一句提示。
 * 业务：空画布是新用户的第一屏，也是流失点。这里给出三条可执行路径：
 *      套模板（最快出效果）、自己拖（自由度最高）、看说明（解决「不知道怎么配」）。
 *      引导块本身仍在画布内，拖拽组件到它上面依然能正常落树，不会挡住操作。
 * 说明：所有节点级拖拽落点由 NodeRenderer 自行处理并阻止冒泡，
 *      因此这里收到的事件只可能来自「组件之间的空隙」或空画布。
 *      空隙落点不是简单追加到末尾——按指针位置找最近的插入边界，
 *      否则用户无法把组件插到页面中间两个组件之间，只能靠上下边缘微操。
 */
import { computed, ref } from 'vue'
import { useDesignerStore } from '@/stores/designer'
import NodeRenderer from '@/components/NodeRenderer.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

const emit = defineEmits(['open-templates', 'open-help'])

const store = useDesignerStore()
const rootRef = ref(null)

const rootTarget = computed(() => store.dropTarget?.id === 'root')

function selectRoot() {
  if (store.interactive) return
  store.select('root')
}

/**
 * 捕获阶段选中
 * ------------------------------------------------------------
 * 业务：设计态控件被 CSS 禁用交互（pointer-events:none），点击会「穿透」到
 *      容器等父级元素上；如果只依赖 lc-node 的冒泡处理，会出现
 *      「点字段却选中了父容器」「某些控件内部 stopPropagation 导致选不中」。
 *      这里在捕获阶段用 closest 找命中的最近节点，不依赖冒泡，保证点击哪里选中哪里。
 */
function onCanvasClick(event) {
  // 交互预览模式：点击是「试用控件」，不改变选中
  if (store.interactive) return
  // 徽标上的复制/删除按钮自己处理，不在这里抢选中
  if (event.target.closest?.('.lc-node__badge')) return
  const hit = event.target.closest?.('.lc-node')
  if (hit?.dataset.nodeId) {
    if (store.selectedId !== hit.dataset.nodeId) store.select(hit.dataset.nodeId)
    return
  }
  // 点击画布空白 = 选中页面根（右侧显示页面设置）
  if (event.target === event.currentTarget) selectRoot()
}

/** 空隙落点：按指针 y 找最近的根级组件边界。
 * 只看根级直属子节点（.lc-root 直子层），嵌套层由 NodeRenderer 自己处理。
 */
function computeGapTarget(event) {
  const rootEl = rootRef.value
  const kids = rootEl ? [...rootEl.children].filter((el) => el.classList?.contains('lc-node')) : []
  if (!kids.length) return { id: 'root', pos: 'inside' }
  for (const el of kids) {
    const rect = el.getBoundingClientRect()
    if (event.clientY < rect.top + rect.height / 2) {
      return { id: el.dataset.nodeId, pos: 'before' }
    }
  }
  return { id: kids[kids.length - 1].dataset.nodeId, pos: 'after' }
}

function onDragOver(event) {
  if (!store.drag || store.interactive) return
  store.setDropTarget(computeGapTarget(event))
}

function onDrop() {
  if (store.interactive) return
  // dragover 已经算好精确落点，drop 直接复用；兜底 root
  const target = store.dropTarget ? { ...store.dropTarget } : { id: 'root', pos: 'inside' }
  const result = store.commitDrop(target)
  if (result && result.ok === false) {
    // 由 NodeRenderer 统一提示，这里只兜底
  }
}
</script>

<style scoped>
.canvas-guide {
  border: 1px dashed var(--lc-border-strong);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--lc-surface-2) 0%, var(--lc-surface-2) 100%);
  padding: 30px 26px 18px;
  text-align: center;
}

.canvas-guide__icon {
  width: 46px;
  height: 46px;
  margin: 0 auto 10px;
  border-radius: 12px;
  background: var(--lc-primary-soft);
  color: var(--lc-primary);
  display: grid;
  place-items: center;
  font-size: 21px;
}

.canvas-guide__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lc-text);
}

.canvas-guide__desc {
  font-size: 12.5px;
  color: var(--lc-text-2);
  margin-top: 5px;
}

.canvas-guide__ways {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
  text-align: left;
}

.canvas-guide__way {
  display: flex;
  gap: 9px;
  background: var(--lc-surface);
  border: 1px solid var(--lc-border-subtle);
  border-radius: 10px;
  padding: 14px;
}

.canvas-guide__way-index {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--lc-primary-soft);
  color: var(--lc-primary);
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  margin-top: 1px;
}

.canvas-guide__way-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--lc-text);
}

.canvas-guide__way-text {
  font-size: 12px;
  color: var(--lc-text-2);
  line-height: 1.6;
  margin-top: 3px;
}

.canvas-guide__foot {
  margin-top: 18px;
  font-size: 11.5px;
  color: var(--lc-text-3);
}
</style>
