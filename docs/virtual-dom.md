# 虚拟 DOM 系统详解

## 📖 概述

虚拟 DOM (Virtual DOM) 是现代前端框架的核心技术之一，它通过 JavaScript 对象来描述真实的 DOM 结构，并通过 diff 算法实现高效的 DOM 更新。

## 🎯 核心概念

### 1. 什么是虚拟 DOM
虚拟 DOM 是真实 DOM 的 JavaScript 表示，它具有以下特点：
- **轻量级**: JavaScript 对象比 DOM 节点更轻量
- **可预测**: 纯 JavaScript 对象，状态可预测
- **高效**: 通过 diff 算法减少 DOM 操作

### 2. 为什么需要虚拟 DOM
- **性能优化**: 减少直接 DOM 操作
- **批量更新**: 将多次更新合并为一次
- **跨平台**: 可以渲染到不同平台

## 🏗️ VNode 数据结构

### VNode 接口定义

```typescript
export interface VNode {
  type: string | symbol | object | Function  // 节点类型
  props: Record<string, any> | null          // 属性
  children: string | VNode[] | null          // 子节点
  shapeFlag: number                          // 形状标记
  el: Element | Text | null                 // 对应的真实 DOM
  key: string | number | symbol | null      // 唯一标识
  component: any                             // 组件实例
}
```

### ShapeFlags 枚举

```typescript
export const enum ShapeFlags {
  ELEMENT = 1,                    // 0001 - 元素节点
  STATEFUL_COMPONENT = 1 << 1,    // 0010 - 有状态组件
  TEXT_CHILDREN = 1 << 2,         // 0100 - 文本子节点
  ARRAY_CHILDREN = 1 << 3,        // 1000 - 数组子节点
  SLOTS_CHILDREN = 1 << 4,        // 10000 - 插槽子节点
}
```

**位运算的优势：**
- 高效的类型检查
- 可以组合多个标记
- 内存占用小

### 特殊节点类型

```typescript
export const Text = Symbol('Text')        // 文本节点
export const Fragment = Symbol('Fragment') // 片段节点
```

## 🔧 VNode 创建

### createVNode 函数

```typescript
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

  // 根据 children 类型设置 shapeFlag
  if (typeof children === 'string') {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN
  } else if (Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN
  }

  return vnode
}

function getShapeFlag(type: any): number {
  if (typeof type === 'string') {
    return ShapeFlags.ELEMENT
  } else if (typeof type === 'object') {
    return ShapeFlags.STATEFUL_COMPONENT
  }
  return 0
}
```

### h 函数 - 创建 VNode 的便捷方法

```typescript
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
    // h('div', { id: 'app' }, 'hello')
    return createVNode(type, propsOrChildren as any, children)
  }
}
```

**h 函数的重载支持：**
```typescript
// 不同的调用方式
h('div')                           // 只有标签
h('div', 'hello')                  // 标签 + 文本
h('div', { id: 'app' })           // 标签 + 属性
h('div', { id: 'app' }, 'hello')  // 标签 + 属性 + 文本
h('div', [child1, child2])        // 标签 + 子节点数组
```

### 创建特殊节点

```typescript
// 创建文本节点
export function createTextVNode(text: string): VNode {
  return createVNode(Text, null, text)
}

// 创建片段节点
export function createFragment(children: VNode[]): VNode {
  return createVNode(Fragment, null, children)
}
```

## 🔄 Diff 算法

### 核心思想

Diff 算法的目标是找出新旧 VNode 树的差异，并以最小的代价更新 DOM。

### isSameVNodeType 函数

```typescript
export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}
```

### Patch 过程

```typescript
function patch(
  n1: VNode | null,  // 旧节点
  n2: VNode,         // 新节点
  container: Element,
  anchor?: Node | null
) {
  // 相同节点，无需更新
  if (n1 === n2) return

  // 类型不同，直接替换
  if (n1 && !isSameVNodeType(n1, n2)) {
    unmount(n1)
    n1 = null
  }

  const { type, shapeFlag } = n2

  switch (type) {
    case Text:
      processText(n1, n2, container, anchor)
      break
    case Fragment:
      processFragment(n1, n2, container, anchor)
      break
    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        processElement(n1, n2, container, anchor)
      } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
        processComponent(n1, n2, container, anchor)
      }
  }
}
```

### 元素节点处理

```typescript
function processElement(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor?: Node | null
) {
  if (n1 == null) {
    // 挂载新元素
    mountElement(n2, container, anchor)
  } else {
    // 更新现有元素
    patchElement(n1, n2)
  }
}

function mountElement(vnode: VNode, container: Element, anchor?: Node | null) {
  // 创建元素
  const el = (vnode.el = createElement(vnode.type as string))

  // 处理子节点
  const { children, shapeFlag } = vnode
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    setElementText(el, children as string)
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children as VNode[], el)
  }

  // 处理属性
  if (vnode.props) {
    for (const key in vnode.props) {
      patchProp(el, key, null, vnode.props[key])
    }
  }

  // 插入到容器
  insert(el, container, anchor)
}
```

### 子节点 Diff

```typescript
function patchChildren(
  n1: VNode,
  n2: VNode,
  container: Element,
  anchor?: Node | null
) {
  const c1 = n1.children
  const c2 = n2.children
  const prevShapeFlag = n1.shapeFlag
  const shapeFlag = n2.shapeFlag

  // 新子节点是文本
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 卸载旧的数组子节点
      unmountChildren(c1 as VNode[])
    }
    if (c2 !== c1) {
      // 设置新的文本内容
      setElementText(container, c2 as string)
    }
  } else {
    // 新子节点是数组
    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 清空旧的文本内容
      setElementText(container, '')
      // 挂载新的数组子节点
      mountChildren(c2 as VNode[], container)
    } else {
      // 数组 vs 数组，进行详细 diff
      patchKeyedChildren(c1 as VNode[], c2 as VNode[], container, anchor)
    }
  }
}
```

### 带 key 的子节点 Diff

```typescript
function patchKeyedChildren(
  c1: VNode[],
  c2: VNode[],
  container: Element,
  anchor?: Node | null
) {
  let i = 0
  const l2 = c2.length
  let e1 = c1.length - 1
  let e2 = l2 - 1

  // 1. 从头开始比较
  while (i <= e1 && i <= e2) {
    const n1 = c1[i]
    const n2 = c2[i]
    if (isSameVNodeType(n1, n2)) {
      patch(n1, n2, container, anchor)
    } else {
      break
    }
    i++
  }

  // 2. 从尾开始比较
  while (i <= e1 && i <= e2) {
    const n1 = c1[e1]
    const n2 = c2[e2]
    if (isSameVNodeType(n1, n2)) {
      patch(n1, n2, container, anchor)
    } else {
      break
    }
    e1--
    e2--
  }

  // 3. 处理新增节点
  if (i > e1) {
    if (i <= e2) {
      const nextPos = e2 + 1
      const anchor = nextPos < l2 ? c2[nextPos].el : null
      while (i <= e2) {
        patch(null, c2[i], container, anchor)
        i++
      }
    }
  }
  // 4. 处理删除节点
  else if (i > e2) {
    while (i <= e1) {
      unmount(c1[i])
      i++
    }
  }
  // 5. 处理复杂情况（移动、新增、删除混合）
  else {
    patchComplexChildren(c1, c2, i, e1, e2, container, anchor)
  }
}
```

## 🎨 使用示例

### 基础用法

```typescript
import { h, createVNode, createTextVNode } from './vnode'

// 创建简单元素
const div = h('div', { id: 'app' }, 'Hello World')

// 创建复杂结构
const app = h('div', { class: 'container' }, [
  h('h1', 'Title'),
  h('p', 'Content'),
  h('ul', [
    h('li', 'Item 1'),
    h('li', 'Item 2'),
    h('li', 'Item 3')
  ])
])

// 创建文本节点
const text = createTextVNode('Pure text')
```

### 动态内容

```typescript
function createList(items: string[]) {
  return h('ul', 
    items.map((item, index) => 
      h('li', { key: index }, item)
    )
  )
}

// 使用
const list1 = createList(['A', 'B', 'C'])
const list2 = createList(['A', 'C', 'D']) // B 被删除，D 被添加
```

## 🚀 性能优化

### 1. Key 的重要性

```typescript
// 不好的做法 - 没有 key
items.map(item => h('li', item.text))

// 好的做法 - 使用唯一 key
items.map(item => h('li', { key: item.id }, item.text))
```

### 2. ShapeFlags 优化

使用位运算快速判断节点类型：

```typescript
// 检查是否有子节点
if (vnode.shapeFlag & (ShapeFlags.TEXT_CHILDREN | ShapeFlags.ARRAY_CHILDREN)) {
  // 处理子节点
}

// 检查是否为元素节点
if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
  // 处理元素
}
```

### 3. 静态提升

对于静态内容，可以提升到渲染函数外部：

```typescript
// 静态节点
const staticNode = h('div', { class: 'static' }, 'Static content')

function render(dynamic: string) {
  return h('div', [
    staticNode,  // 复用静态节点
    h('p', dynamic)
  ])
}
```

## 🔍 与真实 DOM 的对比

| 操作 | 真实 DOM | 虚拟 DOM |
|------|----------|----------|
| 创建节点 | 昂贵 | 便宜 |
| 修改属性 | 昂贵 | 便宜 |
| 查找节点 | 昂贵 | 便宜 |
| 批量操作 | 多次重排重绘 | 一次性更新 |
| 内存占用 | 大 | 小 |

## 📚 相关文档

- [实现指南](./implementation-guide.md)
- [响应式系统](./reactivity-system.md)
- [渲染器实现](./renderer.md)
- [组件系统](./component-system.md)
