/**
 * 组件树操作工具
 * ------------------------------------------------------------
 * 功能：schema 是一棵以 root 为根的组件树，这里提供统一的查找/插入/删除/克隆。
 * 业务：树操作最常见的 bug 是「id 冲突」——复制出的节点与源节点共用 id，
 *      会导致选中原节点时副本也高亮、撤销串位。所以 cloneWithNewIds 强制重发 id，
 *      上层不应依赖 clone 后保留原 id 的行为。
 */

/** 在树中递归定位节点，返回节点本身、其父节点以及在父级 children 中的下标 */
export function locate(node, id, parent = null) {
  if (!node) return null
  if (node.id === id) {
    return { node, parent, list: parent ? parent.children : node.children, index: parent ? parent.children.indexOf(node) : -1 }
  }
  for (const child of node.children || []) {
    const found = locate(child, id, node)
    if (found) return found
  }
  return null
}

export function findNode(root, id) {
  return locate(root, id)?.node || null
}

export function containsNode(root, ancestorId, targetId) {
  const found = locate(root, ancestorId)
  if (!found) return false
  if (ancestorId === targetId) return true
  let hit = false
  const walk = (n) => {
    if (hit || !n) return
    if (n.id === targetId) {
      hit = true
      return
    }
    ;(n.children || []).forEach(walk)
  }
  ;(found.node.children || []).forEach(walk)
  return hit
}

export function countNodes(node) {
  if (!node) return 0
  const self = node.type === 'Page' ? 0 : 1
  return (node.children || []).reduce((sum, c) => sum + countNodes(c), self)
}

export function removeNode(root, id) {
  const loc = locate(root, id)
  if (!loc || !loc.parent) return null
  loc.parent.children.splice(loc.index, 1)
  return loc.node
}

export function insertNode(root, parentId, index, node) {
  const loc = locate(root, parentId)
  if (!loc) return false
  if (!loc.node.children) loc.node.children = []
  const i = Math.max(0, Math.min(index, loc.node.children.length))
  loc.node.children.splice(i, 0, node)
  return true
}

let uidSeq = 0
export function newId(prefix = 'n') {
  uidSeq += 1
  return `${prefix}_${Date.now().toString(36)}${uidSeq.toString(36)}`
}

/** 深拷贝并重新生成 id，避免复制后 id 冲突 */
export function cloneWithNewIds(node) {
  const copy = JSON.parse(JSON.stringify(node))
  const reid = (n) => {
    n.id = newId(n.type?.toLowerCase() || 'n')
    ;(n.children || []).forEach(reid)
  }
  reid(copy)
  return copy
}

export function flatten(root) {
  const list = []
  const walk = (n) => {
    if (!n) return
    if (n.type !== 'Page') list.push(n)
    ;(n.children || []).forEach(walk)
  }
  walk(root)
  return list
}
