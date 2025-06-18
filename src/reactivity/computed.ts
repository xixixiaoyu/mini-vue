import { ReactiveEffect } from './effect'
import { Ref } from './ref'
import { track, trigger } from './effect'

/**
 * 计算属性的实现类
 */
class ComputedRefImpl<T> {
  private _value!: T
  private _dirty = true // 标识是否需要重新计算
  private _effect: ReactiveEffect<T>
  public readonly __v_isRef = true

  constructor(getter: () => T, private readonly _setter?: (value: T) => void) {
    // 创建一个 effect，但设置为 lazy 模式，不会立即执行
    this._effect = new ReactiveEffect(getter, {
      lazy: true,
      // 当依赖发生变化时，标记为 dirty 并触发更新
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true
          // 触发计算属性的更新
          trigger(this, 'value')
        }
      }
    })
  }

  get value() {
    // 依赖收集：将当前计算属性作为依赖
    track(this, 'value')

    // 如果是 dirty 状态，重新计算值
    if (this._dirty) {
      this._value = this._effect.run()!
      this._dirty = false
    }

    return this._value
  }

  set value(newValue: T) {
    if (this._setter) {
      this._setter(newValue)
    } else {
      console.warn('Computed property is readonly')
    }
  }
}

/**
 * 计算属性的选项接口
 */
export interface ComputedOptions<T> {
  get: () => T
  set?: (value: T) => void
}

/**
 * 创建计算属性
 */
export function computed<T>(getter: () => T): Ref<T>
export function computed<T>(options: ComputedOptions<T>): Ref<T>
export function computed<T>(
  getterOrOptions: (() => T) | ComputedOptions<T>
): Ref<T> {
  let getter: () => T
  let setter: ((value: T) => void) | undefined

  // 处理参数：可以是函数或选项对象
  if (typeof getterOrOptions === 'function') {
    getter = getterOrOptions
    setter = undefined
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  return new ComputedRefImpl(getter, setter) as any
}

/**
 * 判断一个值是否为计算属性
 */
export function isComputed<T>(value: unknown): value is Ref<T> {
  return !!(value && (value as any).__v_isRef && (value as any)._effect)
}
