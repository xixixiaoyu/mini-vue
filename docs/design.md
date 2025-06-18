# Mini Vue 设计思路和实现原理

## 📖 概述

Mini Vue 是一个用于学习的 Vue 3 最小化实现，包含了 Vue 3 的核心功能：响应式系统、虚拟 DOM、组件系统和渲染器。通过实现这些核心功能，我们可以深入理解 Vue 3 的工作原理。

## 🏗️ 整体架构

Mini Vue 采用模块化设计，主要分为以下几个模块：

```
mini-vue/
├── reactivity/     # 响应式系统
├── runtime-core/   # 运行时核心（平台无关）
├── runtime-dom/    # DOM 运行时（浏览器平台）
└── compiler/       # 编译器（可选）
```

### 架构设计原则

1. **分层设计**：将平台无关的核心逻辑与平台相关的实现分离
2. **模块化**：每个模块职责单一，便于理解和维护
3. **类型安全**：使用 TypeScript 确保类型安全
4. **可扩展性**：设计时考虑未来的扩展需求

## 🔄 响应式系统

### 设计思路

响应式系统是 Vue 3 的核心，它基于 ES6 的 Proxy 实现，相比 Vue 2 的 Object.defineProperty 有以下优势：

- 可以监听对象属性的添加和删除
- 可以监听数组的变化
- 性能更好，不需要递归遍历所有属性

### 核心概念

#### 1. Effect（副作用函数）

Effect 是响应式系统的基础，它代表一个会读取响应式数据的函数。当响应式数据发生变化时，相关的 effect 会重新执行。

```typescript
// 简化的 effect 实现
class ReactiveEffect {
  constructor(fn, options) {
    this._fn = fn
    this.scheduler = options?.scheduler
  }
  
  run() {
    // 设置当前活跃的 effect
    activeEffect = this
    // 执行函数，触发依赖收集
    return this._fn()
  }
}
```

#### 2. Track（依赖收集）

当响应式对象的属性被读取时，会触发依赖收集，建立属性与 effect 的关系。

```typescript
function track(target, key) {
  if (!activeEffect) return
  
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  
  dep.add(activeEffect)
  activeEffect.deps.push(dep)
}
```

#### 3. Trigger（触发更新）

当响应式对象的属性被修改时，会触发相关 effect 的重新执行。

```typescript
function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  const dep = depsMap.get(key)
  if (!dep) return
  
  dep.forEach(effect => {
    if (effect.scheduler) {
      effect.scheduler(effect)
    } else {
      effect.run()
    }
  })
}
```

### 响应式 API 实现

#### reactive()

使用 Proxy 创建响应式对象：

```typescript
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)
      // 依赖收集
      track(target, key)
      // 递归处理嵌套对象
      return isObject(result) ? reactive(result) : result
    },
    
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)
      // 触发更新
      if (oldValue !== value) {
        trigger(target, key)
      }
      return result
    }
  })
}
```

#### ref()

ref 用于创建基本类型的响应式引用：

```typescript
class RefImpl {
  constructor(value) {
    this._value = convert(value) // 如果是对象则用 reactive 包装
  }
  
  get value() {
    track(this, 'value')
    return this._value
  }
  
  set value(newValue) {
    if (newValue !== this._value) {
      this._value = convert(newValue)
      trigger(this, 'value')
    }
  }
}
```

#### computed()

计算属性基于 effect 实现，具有缓存特性：

```typescript
class ComputedRefImpl {
  constructor(getter) {
    this._dirty = true // 脏检查标记
    this._effect = new ReactiveEffect(getter, {
      lazy: true,
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true
          trigger(this, 'value')
        }
      }
    })
  }
  
  get value() {
    track(this, 'value')
    if (this._dirty) {
      this._value = this._effect.run()
      this._dirty = false
    }
    return this._value
  }
}
```

## 🌳 虚拟 DOM 系统

### 设计思路

虚拟 DOM 是对真实 DOM 的 JavaScript 抽象表示，它具有以下优势：

1. **性能优化**：通过 diff 算法最小化 DOM 操作
2. **跨平台**：可以渲染到不同的平台（浏览器、移动端、服务端）
3. **开发体验**：提供声明式的编程模型

### VNode 结构

```typescript
interface VNode {
  type: string | symbol | object | Function  // 节点类型
  props: Record<string, any> | null          // 属性
  children: string | VNode[] | null          // 子节点
  shapeFlag: number                          // 形状标记
  el: Element | Text | null                 // 对应的真实 DOM
  key: string | number | symbol | null      // 唯一标识
  component: ComponentInstance | null       // 组件实例
}
```

### ShapeFlags 优化

使用位运算优化节点类型判断：

```typescript
const enum ShapeFlags {
  ELEMENT = 1,                    // 0001
  STATEFUL_COMPONENT = 1 << 1,    // 0010
  TEXT_CHILDREN = 1 << 2,         // 0100
  ARRAY_CHILDREN = 1 << 3,        // 1000
}

// 使用示例
if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
  // 处理元素节点
}
```

## 🎨 渲染器设计

### 核心思想

渲染器负责将虚拟 DOM 转换为真实 DOM，它采用了以下设计模式：

1. **策略模式**：通过 RendererOptions 抽象平台相关操作
2. **模板方法模式**：定义渲染流程，具体步骤由子类实现

### 渲染流程

```typescript
function render(vnode, container) {
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
```

### Patch 算法

patch 函数是渲染器的核心，它比较新旧 VNode 并更新 DOM：

```typescript
function patch(n1, n2, container, anchor) {
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

## 🧩 组件系统

### 组件实例

每个组件都有一个对应的实例，包含组件的状态和方法：

```typescript
interface ComponentInstance {
  vnode: VNode              // 组件 VNode
  type: any                 // 组件定义
  props: Record<string, any> // 属性
  setupState: Record<string, any> // setup 返回的状态
  render: Function | null   // 渲染函数
  subTree: VNode | null     // 子树
  isMounted: boolean        // 是否已挂载
  update: Function | null   // 更新函数
  emit: Function            // 事件发射器
}
```

### 组件渲染

组件的渲染通过 effect 实现响应式更新：

```typescript
function setupRenderEffect(instance, vnode, container, anchor) {
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      // 挂载
      const subTree = instance.render()
      instance.subTree = subTree
      patch(null, subTree, container, anchor)
      instance.isMounted = true
    } else {
      // 更新
      const nextTree = instance.render()
      const prevTree = instance.subTree
      instance.subTree = nextTree
      patch(prevTree, nextTree, container, anchor)
    }
  }
  
  // 创建响应式 effect
  instance.update = effect(componentUpdateFn, {
    scheduler() {
      queueJob(instance.update)
    }
  })
}
```

## 🔄 生命周期系统

### 设计原理

生命周期钩子通过依赖注入的方式实现，在组件的不同阶段调用相应的钩子函数。

### 实现方式

```typescript
function onMounted(hook, target) {
  const instance = target || getCurrentInstance()
  if (instance) {
    const hooks = instance[LifecycleHooks.MOUNTED] || 
                  (instance[LifecycleHooks.MOUNTED] = [])
    hooks.push(hook)
  }
}

function callHook(instance, type) {
  const hooks = instance[type]
  if (hooks) {
    hooks.forEach(hook => hook())
  }
}
```

## 🎯 总结

Mini Vue 的设计体现了现代前端框架的核心思想：

1. **响应式驱动**：数据变化自动更新视图
2. **虚拟 DOM**：提供高效的更新机制
3. **组件化**：提供可复用的 UI 单元
4. **声明式**：关注"是什么"而不是"怎么做"

通过实现这个 Mini Vue，我们可以深入理解 Vue 3 的工作原理，为进一步学习和使用 Vue 3 打下坚实的基础。
