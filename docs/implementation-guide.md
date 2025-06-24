# Mini Vue 实现指南

## 📖 概述

本文档详细介绍了如何从零开始实现一个简化版的 Vue 3，包含响应式系统、虚拟 DOM、组件系统和渲染器等核心功能。

## 🎯 学习目标

通过本指南，你将学会：
- Vue 3 响应式系统的核心原理和实现
- 虚拟 DOM 的设计思路和 diff 算法
- 组件系统的架构和生命周期管理
- 渲染器的工作机制
- 现代前端框架的设计模式

## 🏗️ 项目架构

```
mini-vue/
├── src/
│   ├── reactivity/          # 响应式系统
│   │   ├── reactive.ts      # reactive 实现
│   │   ├── ref.ts          # ref 实现
│   │   ├── effect.ts       # effect 实现
│   │   ├── computed.ts     # computed 实现
│   │   └── index.ts        # 导出文件
│   ├── runtime-core/        # 运行时核心
│   │   ├── vnode.ts        # 虚拟 DOM
│   │   ├── renderer.ts     # 渲染器
│   │   ├── component.ts    # 组件系统
│   │   ├── apiLifecycle.ts # 生命周期
│   │   └── index.ts        # 导出文件
│   ├── runtime-dom/         # DOM 运行时
│   │   └── index.ts        # DOM 操作封装
│   └── index.ts            # 主入口
├── examples/               # 示例代码
├── tests/                 # 测试文件
└── docs/                  # 文档
```

## 🚀 实现步骤

### 第一步：搭建项目基础

#### 1.1 初始化项目

```bash
mkdir mini-vue
cd mini-vue
npm init -y
```

#### 1.2 安装依赖

```bash
# 开发依赖
npm install -D typescript @rollup/plugin-typescript rollup
npm install -D jest @types/jest ts-jest jest-environment-jsdom
npm install -D http-server

# 配置 TypeScript
```

#### 1.3 配置文件

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**rollup.config.js**
```javascript
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.js', format: 'cjs', exports: 'named' },
    { file: 'dist/index.esm.js', format: 'es' }
  ],
  plugins: [typescript({ tsconfig: './tsconfig.json' })],
  external: []
};
```

### 第二步：实现响应式系统

响应式系统是 Vue 的核心，基于 Proxy 实现数据劫持和依赖追踪。

#### 2.1 实现 Effect 系统

**src/reactivity/effect.ts**

Effect 系统负责依赖收集和触发更新：

```typescript
// 全局变量
let activeEffect: ReactiveEffect | undefined
const targetMap = new WeakMap<object, Map<any, Set<ReactiveEffect>>>()
const effectStack: ReactiveEffect[] = []

export class ReactiveEffect<T = any> {
  private _fn: () => T
  public deps: Set<ReactiveEffect>[] = []
  public active = true
  public scheduler?: (job: ReactiveEffect) => void

  constructor(fn: () => T, options?: ReactiveEffectOptions) {
    this._fn = fn
    if (options) {
      this.scheduler = options.scheduler
    }
  }

  run() {
    if (!this.active) {
      return this._fn()
    }

    try {
      effectStack.push(this)
      activeEffect = this
      cleanupEffect(this)
      return this._fn()
    } finally {
      effectStack.pop()
      activeEffect = effectStack[effectStack.length - 1]
    }
  }

  stop() {
    if (this.active) {
      cleanupEffect(this)
      this.active = false
    }
  }
}
```

**核心概念解析：**
- `activeEffect`: 当前正在执行的 effect
- `targetMap`: 存储依赖关系的 WeakMap
- `effectStack`: effect 执行栈，处理嵌套 effect

#### 2.2 依赖收集和触发

```typescript
// 依赖收集
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

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

// 触发更新
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

#### 2.3 实现 reactive

**src/reactivity/reactive.ts**

```typescript
const reactiveMap = new WeakMap<object, any>()

export function reactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    console.warn(`reactive() can only be called on objects`)
    return target
  }

  if (isReactive(target)) {
    return target
  }

  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      if (key === ReactiveFlags.IS_REACTIVE) {
        return true
      }

      const result = Reflect.get(target, key, receiver)
      track(target, key)

      if (isObject(result)) {
        return reactive(result)
      }

      return result
    },

    set(target, key, value, receiver) {
      const oldValue = (target as any)[key]
      const result = Reflect.set(target, key, value, receiver)

      if (oldValue !== value) {
        trigger(target, key)
      }

      return result
    }
  })

  reactiveMap.set(target, proxy)
  return proxy
}
```

**设计要点：**
- 使用 Proxy 拦截对象操作
- 在 get 中进行依赖收集
- 在 set 中触发更新
- 递归处理嵌套对象
- 使用 WeakMap 缓存代理对象

### 第三步：实现 ref 系统

**src/reactivity/ref.ts**

```typescript
class RefImpl<T> {
  private _value: T
  public readonly __v_isRef = true

  constructor(value: T) {
    this._value = convert(value)
  }

  get value() {
    track(this, 'value')
    return this._value
  }

  set value(newValue: T) {
    if (newValue === this._value) return
    
    this._value = convert(newValue)
    trigger(this, 'value')
  }
}

export function ref<T>(value: T): Ref<T> {
  return new RefImpl(value) as any
}

function convert<T>(value: T): T {
  return isObject(value) ? reactive(value as any) : value
}
```

### 第四步：实现计算属性

**src/reactivity/computed.ts**

```typescript
class ComputedRefImpl<T> {
  private _value!: T
  private _dirty = true
  private _effect: ReactiveEffect<T>
  public readonly __v_isRef = true

  constructor(getter: () => T, private readonly _setter?: (value: T) => void) {
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
      this._value = this._effect.run()!
      this._dirty = false
    }
    
    return this._value
  }
}
```

**计算属性特点：**
- 懒计算：只有在访问时才计算
- 缓存：依赖不变时返回缓存值
- 响应式：依赖变化时重新计算

## 📚 更多文档

- [响应式系统详解](./reactivity-system.md)
- [虚拟 DOM 系统详解](./virtual-dom.md)
- [组件系统详解](./component-system.md)
- [渲染器实现详解](./renderer.md)
- [生命周期钩子详解](./lifecycle.md)
- [实战示例](./examples.md)

### 第五步：实现虚拟 DOM

虚拟 DOM 是 Vue 高效更新的基础，通过 JavaScript 对象描述 DOM 结构。

#### 5.1 VNode 数据结构

**src/runtime-core/vnode.ts**

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

export const enum ShapeFlags {
  ELEMENT = 1,                    // 元素节点
  STATEFUL_COMPONENT = 1 << 1,    // 有状态组件
  TEXT_CHILDREN = 1 << 2,         // 文本子节点
  ARRAY_CHILDREN = 1 << 3,        // 数组子节点
  SLOTS_CHILDREN = 1 << 4,        // 插槽子节点
}
```

#### 5.2 创建 VNode

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

// h 函数：创建 VNode 的便捷方法
export function h(
  type: string | symbol | object | Function,
  propsOrChildren?: Record<string, any> | string | VNode[] | null,
  children?: string | VNode[] | null
): VNode {
  const l = arguments.length

  if (l === 2) {
    if (typeof propsOrChildren === 'object' && !Array.isArray(propsOrChildren)) {
      return createVNode(type, propsOrChildren)
    } else {
      return createVNode(type, null, propsOrChildren as any)
    }
  } else {
    return createVNode(type, propsOrChildren as any, children)
  }
}
```

### 第六步：实现渲染器

渲染器负责将 VNode 转换为真实 DOM，并处理更新逻辑。

#### 6.1 渲染器架构

**src/runtime-core/renderer.ts**

```typescript
export interface RendererOptions {
  createElement(tag: string): Element
  createText(text: string): Text
  setText(node: Text, text: string): void
  setElementText(el: Element, text: string): void
  insert(child: Node, parent: Element, anchor?: Node | null): void
  remove(child: Node): void
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
}

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

  return { render }
}
```

#### 6.2 Patch 算法

```typescript
function patch(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor?: Node | null
) {
  if (n1 === n2) return

  // 如果新旧节点类型不同，直接替换
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

#### 6.3 元素处理

```typescript
function processElement(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor?: Node | null
) {
  if (n1 == null) {
    // 挂载元素
    mountElement(n2, container, anchor)
  } else {
    // 更新元素
    patchElement(n1, n2)
  }
}

function mountElement(vnode: VNode, container: Element, anchor?: Node | null) {
  const el = (vnode.el = createElement(vnode.type as string))

  // 处理子节点
  const { children, shapeFlag } = vnode
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    setElementText(el, children as string)
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children as VNode[], el)
  }

  // 处理 props
  if (vnode.props) {
    for (const key in vnode.props) {
      patchProp(el, key, null, vnode.props[key])
    }
  }

  insert(el, container, anchor)
}
```

### 第七步：实现组件系统

#### 7.1 组件实例

**src/runtime-core/component.ts**

```typescript
export interface ComponentInstance {
  vnode: VNode
  type: any
  props: Record<string, any>
  setupState: Record<string, any>
  ctx: Record<string, any>
  render: Function | null
  subTree: VNode | null
  isMounted: boolean
  update: Function | null
  emit: (event: string, ...args: any[]) => void
}

export function createComponentInstance(vnode: VNode): ComponentInstance {
  const instance: ComponentInstance = {
    vnode,
    type: vnode.type,
    props: {},
    setupState: {},
    ctx: {},
    render: null,
    subTree: null,
    isMounted: false,
    update: null,
    emit: () => {},
  }

  instance.emit = emit.bind(null, instance)
  instance.ctx = { _: instance }
  return instance
}
```

#### 7.2 组件设置

```typescript
export function setupComponent(instance: ComponentInstance) {
  initProps(instance, instance.vnode.props)
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance: ComponentInstance) {
  const Component = instance.type
  instance.ctx = createRenderContext(instance)

  if (Component.setup) {
    setCurrentInstance(instance)

    const setupResult = Component.setup(instance.props, {
      emit: instance.emit,
    })

    setCurrentInstance(null)
    handleSetupResult(instance, setupResult)
  } else {
    finishComponentSetup(instance)
  }
}

function handleSetupResult(instance: ComponentInstance, setupResult: any) {
  if (typeof setupResult === 'function') {
    instance.render = setupResult
  } else if (setupResult && typeof setupResult === 'object') {
    instance.setupState = proxyRefs(setupResult)
  }

  finishComponentSetup(instance)
}
```

### 第八步：实现生命周期

**src/runtime-core/apiLifecycle.ts**

```typescript
export const enum LifecycleHooks {
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um'
}

function injectHook(
  type: LifecycleHooks,
  hook: LifecycleHook,
  target?: ComponentInstance | null
) {
  const instance = target || getCurrentInstance()

  if (instance) {
    const hooks = instance[type] || (instance[type] = [])
    hooks.push(hook)
  }
}

export function onMounted(hook: LifecycleHook) {
  injectHook(LifecycleHooks.MOUNTED, hook)
}

export function callHook(instance: ComponentInstance, type: LifecycleHooks) {
  const hooks = instance[type]
  if (hooks) {
    hooks.forEach((hook: LifecycleHook) => hook())
  }
}
```

## 🎯 下一步

继续阅读其他专题文档，深入了解各个模块的实现细节。
