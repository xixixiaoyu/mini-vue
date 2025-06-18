import { getCurrentInstance, ComponentInstance } from './component'

// 生命周期钩子类型
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

// 生命周期钩子函数类型
export type LifecycleHook = () => void

/**
 * 注册生命周期钩子的通用函数
 */
function injectHook(
  type: LifecycleHooks,
  hook: LifecycleHook,
  target?: ComponentInstance | null
) {
  const instance = target || getCurrentInstance()
  
  if (instance) {
    const hooks = instance[type] || (instance[type] = [])
    
    // 包装钩子函数，确保在正确的实例上下文中执行
    const wrappedHook = () => {
      // 这里可以添加错误处理
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

/**
 * 调用生命周期钩子
 */
export function callHook(instance: ComponentInstance, type: LifecycleHooks) {
  const hooks = instance[type]
  if (hooks) {
    hooks.forEach((hook: LifecycleHook) => hook())
  }
}

// 导出各种生命周期钩子 API

/**
 * onBeforeMount 钩子
 */
export function onBeforeMount(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.BEFORE_MOUNT, hook, target)
}

/**
 * onMounted 钩子
 */
export function onMounted(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.MOUNTED, hook, target)
}

/**
 * onBeforeUpdate 钩子
 */
export function onBeforeUpdate(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.BEFORE_UPDATE, hook, target)
}

/**
 * onUpdated 钩子
 */
export function onUpdated(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.UPDATED, hook, target)
}

/**
 * onBeforeUnmount 钩子
 */
export function onBeforeUnmount(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.BEFORE_UNMOUNT, hook, target)
}

/**
 * onUnmounted 钩子
 */
export function onUnmounted(hook: LifecycleHook, target?: ComponentInstance) {
  injectHook(LifecycleHooks.UNMOUNTED, hook, target)
}

// 扩展 ComponentInstance 接口以包含生命周期钩子
declare module './component' {
  interface ComponentInstance {
    [LifecycleHooks.BEFORE_CREATE]?: LifecycleHook[]
    [LifecycleHooks.CREATED]?: LifecycleHook[]
    [LifecycleHooks.BEFORE_MOUNT]?: LifecycleHook[]
    [LifecycleHooks.MOUNTED]?: LifecycleHook[]
    [LifecycleHooks.BEFORE_UPDATE]?: LifecycleHook[]
    [LifecycleHooks.UPDATED]?: LifecycleHook[]
    [LifecycleHooks.BEFORE_UNMOUNT]?: LifecycleHook[]
    [LifecycleHooks.UNMOUNTED]?: LifecycleHook[]
  }
}
