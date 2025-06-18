// 导出虚拟 DOM 相关
export { h, createVNode, createTextVNode, Text, Fragment } from './vnode'
export type { VNode } from './vnode'

// 导出渲染器
export { createRenderer } from './renderer'
export type { RendererOptions } from './renderer'

// 导出组件相关
export { 
  createComponentInstance, 
  setupComponent, 
  getCurrentInstance,
  setCurrentInstance
} from './component'
export type { ComponentInstance } from './component'

// 导出生命周期钩子
export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  callHook,
  LifecycleHooks
} from './apiLifecycle'
export type { LifecycleHook } from './apiLifecycle'
