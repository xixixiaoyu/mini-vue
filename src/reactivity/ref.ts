import { track, trigger } from './effect'
import { reactive, isReactive } from './reactive'

// 用于标识 ref 对象的 symbol
export const RefFlags = {
  IS_REF: '__v_isRef',
} as const

/**
 * 判断一个值是否为对象
 */
function isObject(val: unknown): val is Record<any, any> {
  return val !== null && typeof val === 'object'
}

/**
 * 转换值：如果是对象则使用 reactive，否则直接返回
 */
function convert<T>(value: T): T {
  return isObject(value) ? reactive(value) : value
}

/**
 * Ref 类的实现
 */
class RefImpl<T> {
  private _value: T
  public readonly __v_isRef = true

  constructor(value: T) {
    this._value = convert(value)
  }

  get value() {
    // 依赖收集
    track(this, 'value')
    return this._value
  }

  set value(newValue: T) {
    // 如果值没有变化，不触发更新
    if (newValue === this._value) {
      return
    }

    this._value = convert(newValue)
    // 触发更新
    trigger(this, 'value')
  }
}

/**
 * 创建一个 ref 对象
 */
export function ref<T>(value: T): Ref<T> {
  return new RefImpl(value) as any
}

/**
 * 判断一个值是否为 ref 对象
 */
export function isRef<T>(value: Ref<T> | unknown): value is Ref<T> {
  return !!(value && (value as any).__v_isRef)
}

/**
 * 获取 ref 的值，如果不是 ref 则直接返回
 */
export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? ref.value : ref
}

/**
 * 将 ref 或响应式对象转换为普通对象，其中每个属性都是指向原始对象相应属性的 ref
 */
export function toRefs<T extends object>(object: T): ToRefs<T> {
  if (!isReactive(object)) {
    console.warn('toRefs() expects a reactive object but received a plain one.')
  }

  const result: any = {}

  for (const key in object) {
    result[key] = toRef(object, key)
  }

  return result
}

/**
 * 为响应式对象的某个属性创建对应的 ref
 */
export function toRef<T extends object, K extends keyof T>(object: T, key: K): Ref<T[K]> {
  return {
    get value() {
      return object[key]
    },
    set value(newValue: T[K]) {
      object[key] = newValue
    },
    __v_isRef: true,
  } as any
}

/**
 * 自动解包 ref，在模板中使用时不需要 .value
 */
export function proxyRefs<T extends object>(objectWithRefs: T): T {
  return new Proxy(objectWithRefs, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)
      return isRef(result) ? result.value : result
    },

    set(target, key, value, receiver) {
      const oldValue = (target as any)[key]

      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      } else {
        return Reflect.set(target, key, value, receiver)
      }
    },
  })
}

// 类型定义
export interface Ref<T = any> {
  value: T
  readonly __v_isRef: true
}

export type ToRefs<T = any> = {
  [K in keyof T]: Ref<T[K]>
}

export type UnwrapRef<T> = T extends Ref<infer V>
  ? V
  : T extends object
  ? { [K in keyof T]: UnwrapRef<T[K]> }
  : T
