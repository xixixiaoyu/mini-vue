# 组件系统详解

## 📖 概述

组件系统是 Vue 的核心特性之一，它允许我们将 UI 拆分成独立、可复用的部分。本文档详细解析 Mini Vue 中组件系统的实现原理。

## 🎯 核心概念

### 1. 组件的本质
组件本质上是一个包含特定选项的对象：
- **setup**: 组合式 API 的入口
- **render**: 渲染函数
- **props**: 组件属性定义
- **emits**: 事件定义

### 2. 组件实例
每个组件在运行时都会创建一个实例，包含：
- 组件状态
- 渲染上下文
- 生命周期钩子
- 子树 VNode

## 🏗️ 组件实例结构

### ComponentInstance 接口

```typescript
export interface ComponentInstance {
  vnode: VNode                    // 组件的 VNode
  type: any                       // 组件定义对象
  props: Record<string, any>      // 组件属性
  attrs: Record<string, any>      // 非 prop 属性
  slots: Record<string, any>      // 插槽
  setupState: Record<string, any> // setup 返回的状态
  ctx: Record<string, any>        // 渲染上下文
  render: Function | null         // 渲染函数
  subTree: VNode | null          // 子树
  isMounted: boolean             // 是否已挂载
  update: Function | null        // 更新函数
  emit: (event: string, ...args: any[]) => void // 事件发射器
}
```

### 创建组件实例

```typescript
export function createComponentInstance(vnode: VNode): ComponentInstance {
  const type = vnode.type as any

  const instance: ComponentInstance = {
    vnode,
    type,
    props: {},
    attrs: {},
    slots: {},
    setupState: {},
    ctx: {},
    render: null,
    subTree: null,
    isMounted: false,
    update: null,
    emit: () => {},
  }

  // 设置 emit 函数
  instance.emit = emit.bind(null, instance)
  
  // 初始化上下文
  instance.ctx = { _: instance }

  return instance
}
```

## 🔧 组件设置过程

### setupComponent 函数

```typescript
export function setupComponent(instance: ComponentInstance) {
  // 1. 初始化 props 和 slots
  initProps(instance, instance.vnode.props)
  initSlots(instance, instance.vnode.children)

  // 2. 设置有状态组件
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance: ComponentInstance) {
  const Component = instance.type

  // 创建渲染上下文代理
  instance.ctx = createRenderContext(instance)

  // 调用 setup 函数
  if (Component.setup) {
    setCurrentInstance(instance)

    const setupResult = Component.setup(instance.props, {
      emit: instance.emit,
      slots: instance.slots,
      attrs: instance.attrs,
    })

    setCurrentInstance(null)
    handleSetupResult(instance, setupResult)
  } else {
    finishComponentSetup(instance)
  }
}
```

### 处理 setup 返回值

```typescript
function handleSetupResult(instance: ComponentInstance, setupResult: any) {
  if (typeof setupResult === 'function') {
    // setup 返回渲染函数
    instance.render = setupResult
  } else if (setupResult && typeof setupResult === 'object') {
    // setup 返回状态对象，使用 proxyRefs 自动解包 ref
    instance.setupState = proxyRefs(setupResult)
  }

  finishComponentSetup(instance)
}

function finishComponentSetup(instance: ComponentInstance) {
  const Component = instance.type

  // 如果没有 render 函数，使用组件的 render 选项
  if (!instance.render) {
    instance.render = Component.render
  }

  // 确保有 render 函数
  if (!instance.render) {
    console.warn('Component is missing render function.')
  }
}
```

## 🎭 渲染上下文代理

### createRenderContext 函数

```typescript
function createRenderContext(instance: ComponentInstance) {
  return new Proxy(instance.ctx, {
    get(_target, key) {
      const { setupState, props } = instance

      // 只处理字符串和数字键
      if (typeof key !== 'string' && typeof key !== 'number') {
        return undefined
      }

      // 优先级：setupState > props > instance
      if (setupState && key in setupState) {
        return setupState[key as string]
      } else if (props && key in props) {
        return props[key as string]
      } else if (key in instance) {
        return (instance as any)[key]
      }
    },

    set(_target, key, value) {
      const { setupState } = instance

      if (typeof key !== 'string' && typeof key !== 'number') {
        return false
      }

      if (setupState && key in setupState) {
        setupState[key as string] = value
        return true
      }

      return false
    },
  })
}
```

**渲染上下文的作用：**
- 统一访问组件状态
- 处理属性优先级
- 提供 this 绑定

## 📦 Props 系统

### 初始化 Props

```typescript
export function initProps(
  instance: ComponentInstance, 
  rawProps: Record<string, any> | null
) {
  const props: Record<string, any> = {}
  const attrs: Record<string, any> = {}

  if (rawProps) {
    for (const key in rawProps) {
      // 简化处理：所有属性都作为 props
      // 实际 Vue 中会根据组件定义的 props 选项进行过滤
      props[key] = rawProps[key]
    }
  }

  instance.props = props
  instance.attrs = attrs
}
```

### Props 验证（简化版）

```typescript
function validateProps(instance: ComponentInstance, rawProps: any) {
  const { type } = instance
  const propsOptions = type.props

  if (!propsOptions) return

  for (const key in propsOptions) {
    const opt = propsOptions[key]
    const value = rawProps[key]

    // 类型检查
    if (opt.type && typeof value !== opt.type.name.toLowerCase()) {
      console.warn(`Invalid prop type: ${key}`)
    }

    // 必需检查
    if (opt.required && value === undefined) {
      console.warn(`Missing required prop: ${key}`)
    }

    // 默认值
    if (value === undefined && opt.default !== undefined) {
      rawProps[key] = typeof opt.default === 'function' 
        ? opt.default() 
        : opt.default
    }
  }
}
```

## 🎪 插槽系统

### 初始化插槽

```typescript
function initSlots(instance: ComponentInstance, children: any) {
  // 简化处理：将 children 作为默认插槽
  if (children) {
    if (typeof children === 'object' && !Array.isArray(children)) {
      // 具名插槽
      instance.slots = children
    } else {
      // 默认插槽
      instance.slots = {
        default: () => children,
      }
    }
  }
}
```

### 渲染插槽

```typescript
function renderSlot(slots: any, name: string, props?: any) {
  const slot = slots[name]
  
  if (slot) {
    if (typeof slot === 'function') {
      return slot(props)
    } else {
      return slot
    }
  }
  
  return null
}
```

## 📡 事件系统

### emit 实现

```typescript
function emit(instance: ComponentInstance, event: string, ...args: any[]) {
  const { props } = instance

  // 将事件名转换为 props 中的处理函数名
  // 例如：'update' -> 'onUpdate'
  const handlerName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`
  const handler = props[handlerName]

  if (handler && typeof handler === 'function') {
    handler(...args)
  }
}
```

### 事件命名转换

```typescript
function toHandlerKey(str: string): string {
  return str ? `on${capitalize(str)}` : ''
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// 示例
// 'click' -> 'onClick'
// 'update:modelValue' -> 'onUpdate:modelValue'
```

## 🔄 组件更新机制

### 组件更新函数

```typescript
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
      // 异步更新队列
      queueJob(update)
    },
  }))
}
```

## 🎯 组件使用示例

### 基础组件

```typescript
// 定义组件
const MyComponent = {
  props: ['message', 'count'],
  setup(props, { emit }) {
    const handleClick = () => {
      emit('click', 'Hello from component')
    }

    return {
      handleClick
    }
  },
  render() {
    return h('div', [
      h('p', this.message),
      h('p', `Count: ${this.count}`),
      h('button', { onClick: this.handleClick }, 'Click me')
    ])
  }
}

// 使用组件
const app = h(MyComponent, {
  message: 'Hello World',
  count: 42,
  onClick: (msg) => console.log(msg)
})
```

### 组合式 API 组件

```typescript
const Counter = {
  setup() {
    const count = ref(0)
    const doubleCount = computed(() => count.value * 2)

    const increment = () => {
      count.value++
    }

    onMounted(() => {
      console.log('Counter mounted')
    })

    return {
      count,
      doubleCount,
      increment
    }
  },
  render() {
    return h('div', [
      h('p', `Count: ${this.count}`),
      h('p', `Double: ${this.doubleCount}`),
      h('button', { onClick: this.increment }, '+1')
    ])
  }
}
```

### 插槽组件

```typescript
const Layout = {
  setup(props, { slots }) {
    return () => h('div', { class: 'layout' }, [
      h('header', slots.header?.()),
      h('main', slots.default?.()),
      h('footer', slots.footer?.())
    ])
  }
}

// 使用
const app = h(Layout, {}, {
  header: () => h('h1', 'Header'),
  default: () => h('p', 'Content'),
  footer: () => h('p', 'Footer')
})
```

## 🚀 性能优化

### 1. 组件缓存
```typescript
const componentCache = new WeakMap()

function getCachedComponent(type: any) {
  if (componentCache.has(type)) {
    return componentCache.get(type)
  }
  
  const component = normalizeComponent(type)
  componentCache.set(type, component)
  return component
}
```

### 2. Props 优化
```typescript
// 浅比较 props 是否变化
function hasPropsChanged(prevProps: any, nextProps: any): boolean {
  const nextKeys = Object.keys(nextProps)
  const prevKeys = Object.keys(prevProps)
  
  if (nextKeys.length !== prevKeys.length) {
    return true
  }
  
  for (const key of nextKeys) {
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }
  
  return false
}
```

### 3. 异步组件
```typescript
function defineAsyncComponent(loader: () => Promise<any>) {
  return {
    setup() {
      const loaded = ref(false)
      const component = ref(null)
      
      loader().then(comp => {
        component.value = comp
        loaded.value = true
      })
      
      return () => {
        return loaded.value 
          ? h(component.value) 
          : h('div', 'Loading...')
      }
    }
  }
}
```

## 🔍 与 Vue 3 的差异

| 特性 | Mini Vue | Vue 3 |
|------|----------|-------|
| 基础组件 | ✅ 支持 | ✅ 支持 |
| Props 验证 | ⚠️ 简化版 | ✅ 完整支持 |
| 插槽系统 | ⚠️ 基础支持 | ✅ 完整支持 |
| 异步组件 | ❌ 不支持 | ✅ 支持 |
| 函数式组件 | ❌ 不支持 | ✅ 支持 |
| 动态组件 | ❌ 不支持 | ✅ 支持 |
| KeepAlive | ❌ 不支持 | ✅ 支持 |

## 📚 相关文档

- [实现指南](./implementation-guide.md)
- [响应式系统](./reactivity-system.md)
- [虚拟 DOM](./virtual-dom.md)
- [生命周期](./lifecycle.md)
