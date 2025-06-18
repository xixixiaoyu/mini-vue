// VNode 类型枚举
export const enum ShapeFlags {
  ELEMENT = 1, // 元素节点
  STATEFUL_COMPONENT = 1 << 1, // 有状态组件
  TEXT_CHILDREN = 1 << 2, // 文本子节点
  ARRAY_CHILDREN = 1 << 3, // 数组子节点
  SLOTS_CHILDREN = 1 << 4, // 插槽子节点
}

// VNode 接口定义
export interface VNode {
  type: string | symbol | object | Function
  props: Record<string, any> | null
  children: string | VNode[] | null
  shapeFlag: number
  el: Element | Text | null // 对应的真实 DOM 节点
  key: string | number | symbol | null
  component: any // 组件实例
}

// 文本节点的 symbol 标识
export const Text = Symbol('Text')
export const Fragment = Symbol('Fragment')

/**
 * 创建 VNode
 */
export function createVNode(
  type: string | symbol | object | Function,
  props?: Record<string, any> | null,
  children?: string | VNode[] | null
): VNode {
  const vnode: VNode = {
    type,
    props: props || null,
    children: children || null,
    shapeFlag: getShapeFlag(type),
    el: null,
    key: props?.key || null,
    component: null,
  }

  // 根据 children 的类型设置 shapeFlag
  if (typeof children === 'string') {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN
  } else if (Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN
  }

  return vnode
}

/**
 * 根据 type 获取 shapeFlag
 */
function getShapeFlag(type: any): number {
  if (typeof type === 'string') {
    return ShapeFlags.ELEMENT
  } else if (typeof type === 'object') {
    return ShapeFlags.STATEFUL_COMPONENT
  }
  return 0
}

/**
 * 创建文本 VNode
 */
export function createTextVNode(text: string): VNode {
  return createVNode(Text, null, text)
}

/**
 * 创建元素 VNode 的便捷函数
 */
export function h(
  type: string | symbol | object | Function,
  propsOrChildren?: Record<string, any> | string | VNode[] | null,
  children?: string | VNode[] | null
): VNode {
  const l = arguments.length

  if (l === 2) {
    if (typeof propsOrChildren === 'object' && !Array.isArray(propsOrChildren)) {
      // h('div', { id: 'app' })
      return createVNode(type, propsOrChildren)
    } else {
      // h('div', 'hello') 或 h('div', [child1, child2])
      return createVNode(type, null, propsOrChildren as any)
    }
  } else {
    // h('div', { id: 'app' }, 'hello') 或 h('div', { id: 'app' }, [child1, child2])
    return createVNode(type, propsOrChildren as any, children)
  }
}

/**
 * 判断两个 VNode 是否为同一类型
 */
export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}

/**
 * 标准化子节点
 */
export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  const { shapeFlag } = vnode

  if (children == null) {
    children = null
  } else if (Array.isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    // 处理插槽
    type = ShapeFlags.SLOTS_CHILDREN
  } else if (typeof children === 'string') {
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }

  vnode.children = children as any
  vnode.shapeFlag = shapeFlag | type
}
