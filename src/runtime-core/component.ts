import { VNode } from './vnode'
import { proxyRefs } from '../reactivity'

// 组件实例接口
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

// 当前组件实例
let currentInstance: ComponentInstance | null = null

/**
 * 获取当前组件实例
 */
export function getCurrentInstance(): ComponentInstance | null {
  return currentInstance
}

/**
 * 设置当前组件实例
 */
export function setCurrentInstance(instance: ComponentInstance | null) {
  currentInstance = instance
}

/**
 * 创建组件实例
 */
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

  // 设置上下文
  instance.ctx = { _: instance }

  return instance
}

/**
 * 设置组件
 */
export function setupComponent(instance: ComponentInstance) {
  // 初始化 props 和 slots
  initProps(instance, instance.vnode.props)
  initSlots(instance, instance.vnode.children)

  // 设置有状态组件
  setupStatefulComponent(instance)
}

/**
 * 设置有状态组件
 */
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

/**
 * 处理 setup 函数的返回结果
 */
function handleSetupResult(instance: ComponentInstance, setupResult: any) {
  if (typeof setupResult === 'function') {
    // setup 返回渲染函数
    instance.render = setupResult
  } else if (setupResult && typeof setupResult === 'object') {
    // setup 返回状态对象
    instance.setupState = proxyRefs(setupResult)
  }

  finishComponentSetup(instance)
}

/**
 * 完成组件设置
 */
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

/**
 * 创建渲染上下文代理
 */
function createRenderContext(instance: ComponentInstance) {
  return new Proxy(instance.ctx, {
    get(_target, key) {
      const { setupState, props } = instance

      // 只处理字符串和数字键
      if (typeof key !== 'string' && typeof key !== 'number') {
        return undefined
      }

      // 优先从 setupState 中获取
      if (setupState && key in setupState) {
        return setupState[key as string]
      }
      // 然后从 props 中获取
      else if (props && key in props) {
        return props[key as string]
      }
      // 最后从实例中获取
      else if (key in instance) {
        return (instance as any)[key]
      }
    },

    set(_target, key, value) {
      const { setupState } = instance

      // 只处理字符串和数字键
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

/**
 * 初始化 props
 */
export function initProps(instance: ComponentInstance, rawProps: Record<string, any> | null) {
  const props: Record<string, any> = {}
  const attrs: Record<string, any> = {}

  if (rawProps) {
    for (const key in rawProps) {
      // 简化处理：所有属性都作为 props
      props[key] = rawProps[key]
    }
  }

  instance.props = props
  instance.attrs = attrs
}

/**
 * 初始化插槽
 */
function initSlots(instance: ComponentInstance, children: any) {
  // 简化处理：将 children 作为默认插槽
  if (children) {
    instance.slots = {
      default: () => children,
    }
  }
}

/**
 * emit 事件
 */
function emit(instance: ComponentInstance, event: string, ...args: any[]) {
  const { props } = instance

  // 将事件名转换为 props 中的处理函数名
  const handlerName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`
  const handler = props[handlerName]

  if (handler && typeof handler === 'function') {
    handler(...args)
  }
}

/**
 * 判断是否为组件
 */
export function isComponent(type: any): boolean {
  return typeof type === 'object' && (type.render || type.setup)
}
