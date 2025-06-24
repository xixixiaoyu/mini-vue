# 渲染器实现详解

## 📖 概述

渲染器是 Vue 框架的核心组件，负责将虚拟 DOM 转换为真实 DOM，并处理更新、事件绑定等操作。本文档详细解析 Mini Vue 中渲染器的实现原理。

## 🎯 核心概念

### 1. 渲染器的职责
- **挂载**: 将 VNode 转换为真实 DOM 并插入到页面
- **更新**: 比较新旧 VNode，最小化 DOM 操作
- **卸载**: 清理 DOM 节点和相关资源
- **事件处理**: 绑定和解绑事件监听器

### 2. 平台无关性
渲染器通过抽象接口实现平台无关，可以渲染到：
- DOM (浏览器)
- Canvas
- 原生应用
- 服务端

## 🏗️ 渲染器架构

### RendererOptions 接口

```typescript
export interface RendererOptions {
  // DOM 操作
  createElement(tag: string): Element
  createText(text: string): Text
  setText(node: Text, text: string): void
  setElementText(el: Element, text: string): void
  insert(child: Node, parent: Element, anchor?: Node | null): void
  remove(child: Node): void
  
  // 属性操作
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
}
```

### 创建渲染器

```typescript
export function createRenderer(options: RendererOptions) {
  const {
    createElement,
    createText,
    setText,
    setElementText,
    insert,
    remove,
    patchProp,
  } = options

  // 渲染函数
  function render(vnode: VNode | null, container: Element) {
    if (vnode == null) {
      // 卸载
      if (container._vnode) {
        unmount(container._vnode)
      }
    } else {
      // 挂载或更新
      patch(container._vnode || null, vnode, container)
    }
    container._vnode = vnode
  }

  return {
    render,
    createApp: createAppAPI(render)
  }
}
```

## 🔧 Patch 算法实现

### 核心 patch 函数

```typescript
function patch(
  n1: VNode | null,  // 旧节点
  n2: VNode,         // 新节点
  container: Element,
  anchor?: Node | null
) {
  // 相同节点，无需处理
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

### 文本节点处理

```typescript
function processText(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor?: Node | null
) {
  if (n1 == null) {
    // 挂载文本节点
    n2.el = createText(n2.children as string)
    insert(n2.el, container, anchor)
  } else {
    // 更新文本内容
    const el = (n2.el = n1.el!)
    if (n2.children !== n1.children) {
      setText(el as Text, n2.children as string)
    }
  }
}
```

### 片段节点处理

```typescript
function processFragment(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor?: Node | null
) {
  if (n1 == null) {
    // 挂载片段
    mountChildren(n2.children as VNode[], container, anchor)
  } else {
    // 更新片段
    patchChildren(n1, n2, container, anchor)
  }
}
```

## 🎨 元素节点处理

### 挂载元素

```typescript
function mountElement(vnode: VNode, container: Element, anchor?: Node | null) {
  // 1. 创建元素
  const el = (vnode.el = createElement(vnode.type as string))

  // 2. 处理子节点
  const { children, shapeFlag } = vnode
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    setElementText(el, children as string)
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children as VNode[], el)
  }

  // 3. 处理属性
  if (vnode.props) {
    for (const key in vnode.props) {
      patchProp(el, key, null, vnode.props[key])
    }
  }

  // 4. 插入到容器
  insert(el, container, anchor)
}

function mountChildren(children: VNode[], container: Element, anchor?: Node | null) {
  for (let i = 0; i < children.length; i++) {
    patch(null, children[i], container, anchor)
  }
}
```

### 更新元素

```typescript
function patchElement(n1: VNode, n2: VNode) {
  const el = (n2.el = n1.el!)

  // 1. 更新属性
  const oldProps = n1.props || {}
  const newProps = n2.props || {}
  patchProps(el, oldProps, newProps)

  // 2. 更新子节点
  patchChildren(n1, n2, el)
}

function patchProps(el: Element, oldProps: any, newProps: any) {
  // 更新新属性
  for (const key in newProps) {
    const prev = oldProps[key]
    const next = newProps[key]
    if (prev !== next) {
      patchProp(el, key, prev, next)
    }
  }

  // 删除旧属性
  for (const key in oldProps) {
    if (!(key in newProps)) {
      patchProp(el, key, oldProps[key], null)
    }
  }
}
```

### 子节点更新

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
      unmountChildren(c1 as VNode[])
    }
    if (c2 !== c1) {
      setElementText(container, c2 as string)
    }
  } else {
    // 新子节点是数组
    if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      setElementText(container, '')
      mountChildren(c2 as VNode[], container)
    } else {
      // 数组 vs 数组
      patchKeyedChildren(c1 as VNode[], c2 as VNode[], container, anchor)
    }
  }
}
```

## 🧩 组件处理

### 处理组件

```typescript
function processComponent(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor?: Node | null
) {
  if (n1 == null) {
    // 挂载组件
    mountComponent(n2, container, anchor)
  } else {
    // 更新组件
    updateComponent(n1, n2)
  }
}
```

### 挂载组件

```typescript
function mountComponent(vnode: VNode, container: Element, anchor?: Node | null) {
  // 1. 创建组件实例
  const instance = (vnode.component = createComponentInstance(vnode))

  // 2. 设置组件
  setupComponent(instance)

  // 3. 设置渲染效果
  setupRenderEffect(instance, vnode, container, anchor)
}

function setupRenderEffect(
  instance: ComponentInstance,
  vnode: VNode,
  container: Element,
  anchor?: Node | null
) {
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      // 初始挂载
      callHook(instance, LifecycleHooks.BEFORE_MOUNT)

      const subTree = (instance.subTree = instance.render!.call(instance.ctx))
      patch(null, subTree, container, anchor)

      instance.isMounted = true
      vnode.el = subTree.el

      callHook(instance, LifecycleHooks.MOUNTED)
    } else {
      // 更新
      callHook(instance, LifecycleHooks.BEFORE_UPDATE)

      const nextTree = instance.render!.call(instance.ctx)
      const prevTree = instance.subTree
      instance.subTree = nextTree

      patch(prevTree, nextTree, container, anchor)
      vnode.el = nextTree.el

      callHook(instance, LifecycleHooks.UPDATED)
    }
  }

  // 创建响应式 effect
  const update = (instance.update = effect(componentUpdateFn, {
    scheduler() {
      queueJob(update)
    },
  }))
}
```

## 🗑️ 卸载处理

### 卸载节点

```typescript
function unmount(vnode: VNode) {
  const { type, shapeFlag } = vnode

  if (type === Fragment) {
    unmountChildren(vnode.children as VNode[])
    return
  }

  if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    unmountComponent(vnode)
  } else {
    remove(vnode.el!)
  }
}

function unmountChildren(children: VNode[]) {
  for (let i = 0; i < children.length; i++) {
    unmount(children[i])
  }
}

function unmountComponent(vnode: VNode) {
  const instance = vnode.component!
  
  // 调用卸载钩子
  callHook(instance, LifecycleHooks.BEFORE_UNMOUNT)
  
  // 卸载子树
  if (instance.subTree) {
    unmount(instance.subTree)
  }
  
  // 停止响应式效果
  if (instance.update) {
    instance.update.effect.stop()
  }
  
  callHook(instance, LifecycleHooks.UNMOUNTED)
}
```

## 🎯 DOM 平台实现

### DOM 操作实现

```typescript
const rendererOptions: RendererOptions = {
  createElement(tag: string): Element {
    return document.createElement(tag)
  },

  createText(text: string): Text {
    return document.createTextNode(text)
  },

  setText(node: Text, text: string): void {
    node.nodeValue = text
  },

  setElementText(el: Element, text: string): void {
    el.textContent = text
  },

  insert(child: Node, parent: Element, anchor?: Node | null): void {
    parent.insertBefore(child, anchor || null)
  },

  remove(child: Node): void {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void {
    if (key.startsWith('on')) {
      // 事件处理
      const eventName = key.slice(2).toLowerCase()
      if (prevValue) {
        el.removeEventListener(eventName, prevValue)
      }
      if (nextValue) {
        el.addEventListener(eventName, nextValue)
      }
    } else if (key === 'class') {
      el.className = nextValue || ''
    } else if (key === 'style') {
      patchStyle(el as HTMLElement, prevValue, nextValue)
    } else {
      // 普通属性
      if (nextValue == null || nextValue === false) {
        el.removeAttribute(key)
      } else {
        el.setAttribute(key, nextValue)
      }
    }
  }
}
```

### 样式处理

```typescript
function patchStyle(el: HTMLElement, prev: any, next: any) {
  const style = el.style

  if (typeof next === 'string') {
    style.cssText = next
  } else if (typeof next === 'object') {
    // 设置新样式
    for (const key in next) {
      style[key as any] = next[key]
    }
    
    // 清理旧样式
    if (prev && typeof prev === 'object') {
      for (const key in prev) {
        if (!(key in next)) {
          style[key as any] = ''
        }
      }
    }
  }
}
```

## 🚀 性能优化

### 1. 异步更新队列

```typescript
const queue: Function[] = []
let isFlushing = false

function queueJob(job: Function) {
  if (!queue.includes(job)) {
    queue.push(job)
  }
  
  if (!isFlushing) {
    isFlushing = true
    Promise.resolve().then(flushJobs)
  }
}

function flushJobs() {
  try {
    for (let i = 0; i < queue.length; i++) {
      queue[i]()
    }
  } finally {
    queue.length = 0
    isFlushing = false
  }
}
```

### 2. 静态标记

```typescript
// 标记静态节点
const enum PatchFlags {
  TEXT = 1,           // 动态文本
  CLASS = 1 << 1,     // 动态 class
  STYLE = 1 << 2,     // 动态 style
  PROPS = 1 << 3,     // 动态属性
  FULL_PROPS = 1 << 4, // 完整属性
  HYDRATE_EVENTS = 1 << 5, // 事件监听器
  STABLE_FRAGMENT = 1 << 6, // 稳定片段
  KEYED_FRAGMENT = 1 << 7,  // 带 key 片段
  UNKEYED_FRAGMENT = 1 << 8, // 不带 key 片段
  NEED_PATCH = 1 << 9,      // 需要 patch
  DYNAMIC_SLOTS = 1 << 10,   // 动态插槽
  HOISTED = -1,             // 静态提升
  BAIL = -2                 // 优化失败
}
```

### 3. 块级优化

```typescript
// 收集动态子节点
function collectDynamicChildren(children: VNode[]): VNode[] {
  const dynamicChildren: VNode[] = []
  
  for (const child of children) {
    if (child.patchFlag && child.patchFlag > 0) {
      dynamicChildren.push(child)
    }
  }
  
  return dynamicChildren
}
```

## 🔍 使用示例

### 基础渲染

```typescript
import { createRenderer } from './renderer'
import { h } from './vnode'

// 创建 DOM 渲染器
const renderer = createRenderer(rendererOptions)

// 渲染简单元素
const vnode = h('div', { id: 'app' }, 'Hello World')
renderer.render(vnode, document.getElementById('root')!)

// 更新
const newVnode = h('div', { id: 'app' }, 'Hello Vue!')
renderer.render(newVnode, document.getElementById('root')!)
```

### 自定义渲染器

```typescript
// Canvas 渲染器示例
const canvasRenderer = createRenderer({
  createElement(type) {
    return { type, children: [] }
  },
  
  insert(child, parent) {
    parent.children.push(child)
  },
  
  patchProp(el, key, prev, next) {
    el[key] = next
  },
  
  // ... 其他方法
})
```

## 📚 相关文档

- [实现指南](./implementation-guide.md)
- [虚拟 DOM](./virtual-dom.md)
- [组件系统](./component-system.md)
- [生命周期](./lifecycle.md)
