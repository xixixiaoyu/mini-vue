# 与 Vue 3 源码对比

## 📖 概述

本文档详细对比了 Mini Vue 与 Vue 3 源码的实现差异，帮助理解简化实现与完整框架之间的区别，以及 Vue 3 的高级特性和优化策略。

## 🏗️ 整体架构对比

### Mini Vue 架构
```
mini-vue/
├── reactivity/     # 响应式系统
├── runtime-core/   # 运行时核心
├── runtime-dom/    # DOM 运行时
└── index.ts       # 统一导出
```

### Vue 3 架构
```
vue/packages/
├── reactivity/           # 响应式系统
├── runtime-core/         # 运行时核心
├── runtime-dom/          # DOM 运行时
├── compiler-core/        # 编译器核心
├── compiler-dom/         # DOM 编译器
├── compiler-sfc/         # 单文件组件编译器
├── compiler-ssr/         # 服务端渲染编译器
├── server-renderer/      # 服务端渲染
├── shared/              # 共享工具
└── vue/                 # 完整构建
```

**主要差异：**
- Vue 3 包含完整的编译器系统
- 支持服务端渲染
- 更细粒度的模块划分
- 丰富的共享工具库

## 🔧 响应式系统对比

### 依赖收集机制

**Mini Vue**:
```typescript
// 简化的依赖收集
const targetMap = new WeakMap<object, Map<any, Set<ReactiveEffect>>>()

export function track(target: object, key: unknown) {
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

**Vue 3**:
```typescript
// 更复杂的依赖收集，支持多种触发类型
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    const eventInfo = __DEV__
      ? { effect: activeEffect, target, type, key }
      : undefined

    trackEffects(dep, eventInfo)
  }
}

// 支持不同的追踪类型
export const enum TrackOpTypes {
  GET = 'get',
  HAS = 'has',
  ITERATE = 'iterate'
}
```

### 触发更新机制

**Mini Vue**:
```typescript
// 简单的触发机制
export function trigger(target: object, key: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)
  if (!dep) return

  const effects = new Set(dep)
  effects.forEach((effect) => {
    if (effect !== activeEffect) {
      if (effect.scheduler) {
        effect.scheduler(effect)
      } else {
        effect.run()
      }
    }
  })
}
```

**Vue 3**:
```typescript
// 复杂的触发机制，支持多种触发类型和优化
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }

  let deps: (Dep | undefined)[] = []
  
  if (type === TriggerOpTypes.CLEAR) {
    deps = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    // 数组长度变化的特殊处理
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue as number)) {
        deps.push(dep)
      }
    })
  } else {
    // 其他情况的处理
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }
    
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          deps.push(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  const eventInfo = __DEV__
    ? { target, type, key, newValue, oldValue, oldTarget }
    : undefined

  if (deps.length === 1) {
    if (deps[0]) {
      if (__DEV__) {
        triggerEffects(deps[0], eventInfo)
      } else {
        triggerEffects(deps[0])
      }
    }
  } else {
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    if (__DEV__) {
      triggerEffects(createDep(effects), eventInfo)
    } else {
      triggerEffects(createDep(effects))
    }
  }
}
```

## 🎨 虚拟 DOM 对比

### VNode 结构

**Mini Vue**:
```typescript
export interface VNode {
  type: string | symbol | object | Function
  props: Record<string, any> | null
  children: string | VNode[] | null
  shapeFlag: number
  el: Element | Text | null
  key: string | number | symbol | null
  component: any
}
```

**Vue 3**:
```typescript
export interface VNode<
  HostNode = RendererNode,
  HostElement = RendererElement,
  ExtraProps = { [key: string]: any }
> {
  __v_isVNode: true
  __v_skip: true
  type: VNodeTypes
  props: (VNodeProps & ExtraProps) | null
  key: string | number | symbol | null
  ref: VNodeNormalizedRef | null
  scopeId: string | null
  slotScopeIds: string[] | null
  children: VNodeNormalizedChildren
  component: ComponentInternalInstance | null
  dirs: DirectiveBinding[] | null
  transition: TransitionHooks<HostElement> | null
  
  // DOM
  el: HostNode | null
  anchor: HostNode | null
  target: HostElement | null
  targetAnchor: HostNode | null
  staticCount: number

  // suspense
  suspense: SuspenseBoundary | null
  ssContent: VNode | null
  ssFallback: VNode | null

  // optimization only
  shapeFlag: ShapeFlags
  patchFlag: PatchFlags
  dynamicProps: string[] | null
  dynamicChildren: VNode[] | null

  // application root node only
  appContext: AppContext | null

  // HMR only
  hmrId?: string
  
  // v-memo cache
  memo?: any[]
  isCompatRoot?: true
  ce?: (instance: ComponentInternalInstance) => void
}
```

**主要差异：**
- Vue 3 的 VNode 包含更多优化信息
- 支持指令、过渡动画、Suspense 等高级特性
- 包含开发时的调试信息
- 支持热模块替换 (HMR)

### Diff 算法优化

**Mini Vue**:
```typescript
// 简化的 diff 算法
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

  // 3. 处理新增和删除
  // ... 简化处理
}
```

**Vue 3**:
```typescript
// 高度优化的 diff 算法
const patchKeyedChildren = (
  c1: VNode[],
  c2: VNodeArrayChildren,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  let i = 0
  const l2 = c2.length
  let e1 = c1.length - 1
  let e2 = l2 - 1

  // 1. sync from start
  while (i <= e1 && i <= e2) {
    const n1 = c1[i]
    const n2 = (c2[i] = optimized
      ? cloneIfMounted(c2[i] as VNode)
      : normalizeVNode(c2[i]))
    if (isSameVNodeType(n1, n2)) {
      patch(
        n1,
        n2,
        container,
        null,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      )
    } else {
      break
    }
    i++
  }

  // 2. sync from end
  while (i <= e1 && i <= e2) {
    const n1 = c1[e1]
    const n2 = (c2[e2] = optimized
      ? cloneIfMounted(c2[e2] as VNode)
      : normalizeVNode(c2[e2]))
    if (isSameVNodeType(n1, n2)) {
      patch(
        n1,
        n2,
        container,
        null,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      )
    } else {
      break
    }
    e1--
    e2--
  }

  // 3. common sequence + mount
  if (i > e1) {
    if (i <= e2) {
      const nextPos = e2 + 1
      const anchor = nextPos < l2 ? (c2[nextPos] as VNode).el : parentAnchor
      while (i <= e2) {
        patch(
          null,
          (c2[i] = optimized
            ? cloneIfMounted(c2[i] as VNode)
            : normalizeVNode(c2[i])),
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        )
        i++
      }
    }
  }

  // 4. common sequence + unmount
  else if (i > e2) {
    while (i <= e1) {
      unmount(c1[i], parentComponent, parentSuspense, true)
      i++
    }
  }

  // 5. unknown sequence
  else {
    const s1 = i
    const s2 = i

    // 5.1 build key:index map for newChildren
    const keyToNewIndexMap: Map<string | number | symbol, number> = new Map()
    for (i = s2; i <= e2; i++) {
      const nextChild = (c2[i] = optimized
        ? cloneIfMounted(c2[i] as VNode)
        : normalizeVNode(c2[i]))
      if (nextChild.key != null) {
        if (__DEV__ && keyToNewIndexMap.has(nextChild.key)) {
          warn(
            `Duplicate keys found during update:`,
            JSON.stringify(nextChild.key),
            `Make sure keys are unique.`
          )
        }
        keyToNewIndexMap.set(nextChild.key, i)
      }
    }

    // 5.2 loop through old children left to be patched and try to patch
    // matching nodes & remove nodes that are no longer present
    let j
    let patched = 0
    const toBePatched = e2 - s2 + 1
    let moved = false
    let maxNewIndexSoFar = 0

    // used to track whether any node has moved
    const newIndexToOldIndexMap = new Array(toBePatched)
    for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

    for (i = s1; i <= e1; i++) {
      const prevChild = c1[i]
      if (patched >= toBePatched) {
        // all new children have been patched so this can only be a removal
        unmount(prevChild, parentComponent, parentSuspense, true)
        continue
      }
      let newIndex
      if (prevChild.key != null) {
        newIndex = keyToNewIndexMap.get(prevChild.key)
      } else {
        // key-less node, try to locate a key-less node of the same type
        for (j = s2; j <= e2; j++) {
          if (
            newIndexToOldIndexMap[j - s2] === 0 &&
            isSameVNodeType(prevChild, c2[j] as VNode)
          ) {
            newIndex = j
            break
          }
        }
      }
      if (newIndex === undefined) {
        unmount(prevChild, parentComponent, parentSuspense, true)
      } else {
        newIndexToOldIndexMap[newIndex - s2] = i + 1
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex
        } else {
          moved = true
        }
        patch(
          prevChild,
          c2[newIndex] as VNode,
          container,
          null,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        )
        patched++
      }
    }

    // 5.3 move and mount
    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : EMPTY_ARR
    j = increasingNewIndexSequence.length - 1
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i
      const nextChild = c2[nextIndex] as VNode
      const anchor =
        nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor
      if (newIndexToOldIndexMap[i] === 0) {
        // mount new
        patch(
          null,
          nextChild,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        )
      } else if (moved) {
        // move if:
        // There is no stable subsequence (e.g. a reverse)
        // OR current node is not among the stable sequence
        if (j < 0 || i !== increasingNewIndexSequence[j]) {
          move(nextChild, container, anchor, MoveType.REORDER)
        } else {
          j--
        }
      }
    }
  }
}
```

## 🧩 组件系统对比

### 组件实例

**Mini Vue**:
```typescript
export interface ComponentInstance {
  vnode: VNode
  type: any
  props: Record<string, any>
  attrs: Record<string, any>
  slots: Record<string, any>
  setupState: Record<string, any>
  ctx: Record<string, any>
  render: Function | null
  subTree: VNode | null
  isMounted: boolean
  update: Function | null
  emit: (event: string, ...args: any[]) => void
}
```

**Vue 3**:
```typescript
export interface ComponentInternalInstance {
  uid: number
  type: ConcreteComponent
  parent: ComponentInternalInstance | null
  root: ComponentInternalInstance
  appContext: AppContext
  vnode: VNode
  next: VNode | null
  subTree: VNode
  effect: ReactiveEffect
  update: SchedulerJob
  render: InternalRenderFunction | null
  
  // state
  ctx: Data
  data: Data
  props: Data
  attrs: Data
  slots: InternalSlots
  refs: Data
  emit: EmitFn
  emitted: Record<string, boolean> | null
  propsOptions: NormalizedPropsOptions
  emitsOptions: ObjectEmitsOptions | null
  
  // lifecycle
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  bc: LifecycleHook[] | null // beforeCreate
  c: LifecycleHook[] | null  // created
  bm: LifecycleHook[] | null // beforeMount
  m: LifecycleHook[] | null  // mounted
  bu: LifecycleHook[] | null // beforeUpdate
  u: LifecycleHook[] | null  // updated
  bum: LifecycleHook[] | null // beforeUnmount
  um: LifecycleHook[] | null  // unmounted
  da: LifecycleHook[] | null  // deactivated
  a: LifecycleHook[] | null   // activated
  rtg: LifecycleHook[] | null // renderTriggered
  rtc: LifecycleHook[] | null // renderTracked
  ec: LifecycleHook[] | null  // errorCaptured
  sp: LifecycleHook[] | null  // serverPrefetch
  
  // suspense related
  suspense: SuspenseBoundary | null
  suspenseId: number
  asyncDep: Promise<any> | null
  asyncResolved: boolean
  
  // provide/inject
  provides: Data
  
  // ssr
  ssrContext?: SSRContext
  
  // hmr marker (dev only)
  hmrId?: string
  
  // v-model cache
  comps?: Record<string, Component>
  
  // dev only
  renderContext: Data
}
```

## 🚀 性能优化对比

### 编译时优化

**Mini Vue**: 
- 仅支持运行时
- 无编译时优化

**Vue 3**:
- 静态提升 (Static Hoisting)
- 补丁标记 (Patch Flags)
- 块级优化 (Block Tree)
- 内联组件 Props (Inline Component Props)

```typescript
// Vue 3 编译时优化示例
function render() {
  return (openBlock(), createElementBlock("div", null, [
    createElementVNode("h1", null, "Static Title"), // 静态节点
    createElementVNode("p", null, toDisplayString(_ctx.message), 1 /* TEXT */), // 动态文本
    createElementVNode("button", {
      onClick: _ctx.handleClick
    }, "Click", 8 /* PROPS */, ["onClick"]) // 动态属性
  ]))
}
```

### 运行时优化

**Mini Vue**:
- 基础的异步更新队列
- 简单的依赖收集

**Vue 3**:
- 高度优化的调度器
- 组件级别的更新
- 编译时和运行时协同优化

## 📊 功能对比表

| 功能特性 | Mini Vue | Vue 3 |
|---------|----------|-------|
| 响应式系统 | ✅ 基础实现 | ✅ 完整实现 |
| 虚拟 DOM | ✅ 基础实现 | ✅ 高度优化 |
| 组件系统 | ✅ 基础实现 | ✅ 完整实现 |
| 模板编译 | ❌ 不支持 | ✅ 完整支持 |
| 指令系统 | ❌ 不支持 | ✅ 完整支持 |
| 插槽系统 | ⚠️ 基础支持 | ✅ 完整支持 |
| 生命周期 | ✅ 基础实现 | ✅ 完整实现 |
| 异步组件 | ❌ 不支持 | ✅ 支持 |
| Suspense | ❌ 不支持 | ✅ 支持 |
| Teleport | ❌ 不支持 | ✅ 支持 |
| 服务端渲染 | ❌ 不支持 | ✅ 支持 |
| TypeScript | ✅ 基础支持 | ✅ 完整支持 |
| 开发工具 | ❌ 不支持 | ✅ 支持 |
| 热模块替换 | ❌ 不支持 | ✅ 支持 |

## 🎯 学习价值

### Mini Vue 的价值
1. **理解核心原理**: 去除复杂性，专注核心概念
2. **学习成本低**: 代码量少，易于理解
3. **实践导向**: 通过实现加深理解
4. **基础扎实**: 为深入学习 Vue 3 打基础

### Vue 3 的优势
1. **生产就绪**: 经过大量测试和优化
2. **功能完整**: 支持所有现代前端开发需求
3. **性能优异**: 编译时和运行时双重优化
4. **生态丰富**: 完整的工具链和社区支持

## 📚 进一步学习

1. **Vue 3 源码阅读**: 基于 Mini Vue 的理解，深入研究 Vue 3 源码
2. **编译器学习**: 了解模板编译和优化原理
3. **性能优化**: 学习 Vue 3 的各种性能优化技巧
4. **工程实践**: 在实际项目中应用 Vue 3 的高级特性

通过对比学习，你将更深入地理解现代前端框架的设计思路和实现细节！
