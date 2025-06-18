import { track, trigger } from './effect'

// 用于标识对象是否为响应式的 symbol
export const ReactiveFlags = {
  IS_REACTIVE: '__v_isReactive'
} as const

// 存储原始对象到响应式对象的映射
const reactiveMap = new WeakMap<object, any>()

/**
 * 判断一个值是否为对象
 */
function isObject(val: unknown): val is Record<any, any> {
  return val !== null && typeof val === 'object'
}

/**
 * 创建响应式对象
 */
export function reactive<T extends object>(target: T): T {
  // 如果不是对象，直接返回
  if (!isObject(target)) {
    console.warn(`reactive() can only be called on objects, not ${typeof target}`)
    return target
  }

  // 如果已经是响应式对象，直接返回
  if (isReactive(target)) {
    return target
  }

  // 如果已经创建过响应式对象，返回缓存的结果
  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 创建 Proxy 代理对象
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      // 处理响应式标识
      if (key === ReactiveFlags.IS_REACTIVE) {
        return true
      }

      // 获取属性值
      const result = Reflect.get(target, key, receiver)

      // 依赖收集
      track(target, key)

      // 如果属性值是对象，递归创建响应式对象
      if (isObject(result)) {
        return reactive(result)
      }

      return result
    },

    set(target, key, value, receiver) {
      // 获取旧值
      const oldValue = (target as any)[key]

      // 设置新值
      const result = Reflect.set(target, key, value, receiver)

      // 如果值发生变化，触发更新
      if (oldValue !== value) {
        trigger(target, key)
      }

      return result
    },

    has(target, key) {
      const result = Reflect.has(target, key)
      track(target, key)
      return result
    },

    ownKeys(target) {
      // 对于 ownKeys 操作，我们使用一个特殊的 key 来追踪
      track(target, Symbol('ownKeys'))
      return Reflect.ownKeys(target)
    },

    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const result = Reflect.deleteProperty(target, key)

      if (result && hadKey) {
        trigger(target, key)
      }

      return result
    }
  })

  // 缓存响应式对象
  reactiveMap.set(target, proxy)

  return proxy
}

/**
 * 判断一个对象是否为响应式对象
 */
export function isReactive(value: unknown): boolean {
  return !!(value && (value as any)[ReactiveFlags.IS_REACTIVE])
}

/**
 * 获取响应式对象的原始对象
 */
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as any).__v_raw
  return raw ? toRaw(raw) : observed
}

/**
 * 创建只读的响应式对象
 */
export function readonly<T extends object>(target: T): Readonly<T> {
  if (!isObject(target)) {
    console.warn(`readonly() can only be called on objects, not ${typeof target}`)
    return target
  }

  return new Proxy(target, {
    get(target, key, receiver) {
      // 处理响应式标识
      if (key === ReactiveFlags.IS_REACTIVE) {
        return true
      }

      const result = Reflect.get(target, key, receiver)

      // 只读对象也需要依赖收集，但不会触发更新
      track(target, key)

      // 如果属性值是对象，递归创建只读对象
      if (isObject(result)) {
        return readonly(result)
      }

      return result
    },

    set() {
      console.warn('Set operation on readonly object is not allowed')
      return true
    },

    deleteProperty() {
      console.warn('Delete operation on readonly object is not allowed')
      return true
    }
  })
}
