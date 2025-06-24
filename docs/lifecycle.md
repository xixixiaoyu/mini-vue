# 生命周期钩子详解

## 📖 概述

生命周期钩子是 Vue 组件在不同阶段执行的函数，允许开发者在组件的特定时刻执行代码。本文档详细解析 Mini Vue 中生命周期系统的实现原理。

## 🎯 生命周期阶段

### 组件生命周期流程

```
创建阶段
├── beforeCreate (Vue 2)
├── created (Vue 2)
└── setup() (Vue 3)

挂载阶段
├── beforeMount
├── render()
├── mounted

更新阶段
├── beforeUpdate
├── render()
└── updated

卸载阶段
├── beforeUnmount
└── unmounted
```

## 🏗️ 生命周期实现

### LifecycleHooks 枚举

```typescript
export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um'
}

export type LifecycleHook = () => void
```

### 钩子注册机制

```typescript
function injectHook(
  type: LifecycleHooks,
  hook: LifecycleHook,
  target?: ComponentInstance | null
) {
  // 获取当前组件实例
  const instance = target || getCurrentInstance()
  
  if (instance) {
    // 获取或创建钩子数组
    const hooks = instance[type] || (instance[type] = [])
    
    // 包装钩子函数，添加错误处理
    const wrappedHook = () => {
      try {
        hook()
      } catch (err) {
        console.error(`Error in ${type} hook:`, err)
      }
    }
    
    hooks.push(wrappedHook)
  } else {
    console.warn(
      `${type} hook can only be called during setup() or in a component context.`
    )
  }
}
```

### 钩子调用机制

```typescript
export function callHook(instance: ComponentInstance, type: LifecycleHooks) {
  const hooks = instance[type]
  if (hooks) {
    hooks.forEach((hook: LifecycleHook) => {
      hook()
    })
  }
}
```

## 🎪 各生命周期钩子详解

### onBeforeMount

```typescript
export function onBeforeMount(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.BEFORE_MOUNT, hook, target)
}
```

**调用时机**: 组件挂载之前
**用途**: 
- 最后的数据准备
- 发起异步请求
- 设置定时器

**示例**:
```typescript
const MyComponent = {
  setup() {
    onBeforeMount(() => {
      console.log('组件即将挂载')
      // 可以访问响应式数据，但还不能访问 DOM
    })
  }
}
```

### onMounted

```typescript
export function onMounted(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.MOUNTED, hook, target)
}
```

**调用时机**: 组件挂载完成后
**用途**:
- DOM 操作
- 初始化第三方库
- 发起网络请求

**示例**:
```typescript
const MyComponent = {
  setup() {
    const elementRef = ref(null)
    
    onMounted(() => {
      console.log('组件已挂载')
      // 可以安全地访问 DOM
      console.log(elementRef.value)
    })
    
    return { elementRef }
  },
  render() {
    return h('div', { ref: 'elementRef' }, 'Hello')
  }
}
```

### onBeforeUpdate

```typescript
export function onBeforeUpdate(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.BEFORE_UPDATE, hook, target)
}
```

**调用时机**: 组件更新之前
**用途**:
- 获取更新前的 DOM 状态
- 准备更新相关的数据

**示例**:
```typescript
const MyComponent = {
  setup() {
    const count = ref(0)
    
    onBeforeUpdate(() => {
      console.log('组件即将更新，当前 count:', count.value)
    })
    
    return { count }
  }
}
```

### onUpdated

```typescript
export function onUpdated(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.UPDATED, hook, target)
}
```

**调用时机**: 组件更新完成后
**用途**:
- 访问更新后的 DOM
- 执行依赖于 DOM 的操作

**示例**:
```typescript
const MyComponent = {
  setup() {
    const count = ref(0)
    
    onUpdated(() => {
      console.log('组件已更新，新的 count:', count.value)
      // DOM 已经更新，可以安全访问
    })
    
    return { count }
  }
}
```

### onBeforeUnmount

```typescript
export function onBeforeUnmount(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.BEFORE_UNMOUNT, hook, target)
}
```

**调用时机**: 组件卸载之前
**用途**:
- 清理定时器
- 取消网络请求
- 移除事件监听器

**示例**:
```typescript
const MyComponent = {
  setup() {
    let timer: number
    
    onMounted(() => {
      timer = setInterval(() => {
        console.log('定时器执行')
      }, 1000)
    })
    
    onBeforeUnmount(() => {
      console.log('组件即将卸载')
      if (timer) {
        clearInterval(timer)
      }
    })
  }
}
```

### onUnmounted

```typescript
export function onUnmounted(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.UNMOUNTED, hook, target)
}
```

**调用时机**: 组件卸载完成后
**用途**:
- 最终的清理工作
- 释放资源

**示例**:
```typescript
const MyComponent = {
  setup() {
    onUnmounted(() => {
      console.log('组件已卸载')
      // 执行最终清理
    })
  }
}
```

## 🔄 生命周期在渲染器中的调用

### 组件挂载时的钩子调用

```typescript
function setupRenderEffect(
  instance: ComponentInstance,
  vnode: VNode,
  container: Element,
  anchor?: Node | null
) {
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      // 挂载阶段
      callHook(instance, LifecycleHooks.BEFORE_MOUNT)
      
      const subTree = (instance.subTree = instance.render!.call(instance.ctx))
      patch(null, subTree, container, anchor)
      
      instance.isMounted = true
      vnode.el = subTree.el
      
      callHook(instance, LifecycleHooks.MOUNTED)
    } else {
      // 更新阶段
      callHook(instance, LifecycleHooks.BEFORE_UPDATE)
      
      const nextTree = instance.render!.call(instance.ctx)
      const prevTree = instance.subTree
      instance.subTree = nextTree
      
      patch(prevTree, nextTree, container, anchor)
      vnode.el = nextTree.el
      
      callHook(instance, LifecycleHooks.UPDATED)
    }
  }

  const update = (instance.update = effect(componentUpdateFn, {
    scheduler() {
      queueJob(update)
    },
  }))
}
```

### 组件卸载时的钩子调用

```typescript
function unmountComponent(vnode: VNode) {
  const instance = vnode.component!
  
  // 调用卸载前钩子
  callHook(instance, LifecycleHooks.BEFORE_UNMOUNT)
  
  // 卸载子树
  if (instance.subTree) {
    unmount(instance.subTree)
  }
  
  // 停止响应式效果
  if (instance.update) {
    instance.update.effect.stop()
  }
  
  // 调用卸载后钩子
  callHook(instance, LifecycleHooks.UNMOUNTED)
}
```

## 🎯 实际使用示例

### 计数器组件

```typescript
const Counter = {
  setup() {
    const count = ref(0)
    const timer = ref<number | null>(null)
    
    // 挂载时启动定时器
    onMounted(() => {
      console.log('Counter 组件已挂载')
      timer.value = setInterval(() => {
        count.value++
      }, 1000)
    })
    
    // 更新时记录日志
    onUpdated(() => {
      console.log(`计数器更新为: ${count.value}`)
    })
    
    // 卸载前清理定时器
    onBeforeUnmount(() => {
      console.log('Counter 组件即将卸载')
      if (timer.value) {
        clearInterval(timer.value)
        timer.value = null
      }
    })
    
    return {
      count
    }
  },
  
  render() {
    return h('div', [
      h('p', `计数: ${this.count}`),
      h('button', { 
        onClick: () => this.count++ 
      }, '增加')
    ])
  }
}
```

### 数据获取组件

```typescript
const DataFetcher = {
  setup() {
    const data = ref(null)
    const loading = ref(false)
    const error = ref(null)
    
    const fetchData = async () => {
      loading.value = true
      error.value = null
      
      try {
        const response = await fetch('/api/data')
        data.value = await response.json()
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }
    
    // 组件挂载后获取数据
    onMounted(() => {
      console.log('开始获取数据')
      fetchData()
    })
    
    // 组件卸载前取消请求（简化示例）
    onBeforeUnmount(() => {
      console.log('组件卸载，清理资源')
      // 实际应用中可能需要取消正在进行的请求
    })
    
    return {
      data,
      loading,
      error,
      fetchData
    }
  },
  
  render() {
    if (this.loading) {
      return h('div', '加载中...')
    }
    
    if (this.error) {
      return h('div', `错误: ${this.error}`)
    }
    
    return h('div', [
      h('h3', '数据:'),
      h('pre', JSON.stringify(this.data, null, 2)),
      h('button', { onClick: this.fetchData }, '重新获取')
    ])
  }
}
```

## 🚀 高级用法

### 条件钩子注册

```typescript
const ConditionalComponent = {
  setup(props) {
    // 根据条件注册不同的钩子
    if (props.enableLogging) {
      onMounted(() => {
        console.log('启用日志的组件已挂载')
      })
      
      onUpdated(() => {
        console.log('启用日志的组件已更新')
      })
    }
    
    // 通用钩子
    onBeforeUnmount(() => {
      console.log('组件即将卸载')
    })
  }
}
```

### 钩子组合

```typescript
function useLifecycleLogger(componentName: string) {
  onBeforeMount(() => {
    console.log(`[${componentName}] beforeMount`)
  })
  
  onMounted(() => {
    console.log(`[${componentName}] mounted`)
  })
  
  onBeforeUpdate(() => {
    console.log(`[${componentName}] beforeUpdate`)
  })
  
  onUpdated(() => {
    console.log(`[${componentName}] updated`)
  })
  
  onBeforeUnmount(() => {
    console.log(`[${componentName}] beforeUnmount`)
  })
  
  onUnmounted(() => {
    console.log(`[${componentName}] unmounted`)
  })
}

// 使用
const MyComponent = {
  setup() {
    useLifecycleLogger('MyComponent')
    
    // 其他逻辑...
  }
}
```

## ⚠️ 注意事项

### 1. 钩子调用时机
- 钩子只能在 `setup()` 函数中或其他组合式函数中调用
- 不能在条件语句或循环中调用钩子

### 2. 错误处理
```typescript
onMounted(() => {
  try {
    // 可能出错的代码
    riskyOperation()
  } catch (error) {
    console.error('挂载时发生错误:', error)
  }
})
```

### 3. 异步操作
```typescript
onMounted(async () => {
  // 异步钩子是允许的
  const data = await fetchData()
  // 处理数据
})
```

## 🔍 与 Vue 3 的差异

| 特性 | Mini Vue | Vue 3 |
|------|----------|-------|
| 基础钩子 | ✅ 支持 | ✅ 支持 |
| 错误处理 | ⚠️ 基础支持 | ✅ 完整支持 |
| 服务端渲染钩子 | ❌ 不支持 | ✅ 支持 |
| 调试钩子 | ❌ 不支持 | ✅ 支持 |
| 异步组件钩子 | ❌ 不支持 | ✅ 支持 |

## 📚 相关文档

- [实现指南](./implementation-guide.md)
- [组件系统](./component-system.md)
- [渲染器实现](./renderer.md)
- [响应式系统](./reactivity-system.md)
