// 当前正在执行的 effect 函数
let activeEffect: ReactiveEffect | undefined

// 依赖收集的栈，用于处理嵌套的 effect
const effectStack: ReactiveEffect[] = []

// 用于存储依赖关系的 WeakMap
// target -> key -> Set<ReactiveEffect>
type KeyToDepMap = Map<any, Set<ReactiveEffect>>
const targetMap = new WeakMap<any, KeyToDepMap>()

export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: (job: ReactiveEffect) => void
}

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
    // 如果 effect 已经被停止，直接执行函数
    if (!this.active) {
      return this._fn()
    }

    try {
      // 将当前 effect 推入栈中
      effectStack.push(this)
      activeEffect = this

      // 清理之前的依赖
      cleanupEffect(this)

      // 执行函数，在执行过程中会触发依赖收集
      return this._fn()
    } finally {
      // 执行完毕后从栈中弹出
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

/**
 * 清理 effect 的所有依赖
 */
function cleanupEffect(effect: ReactiveEffect) {
  effect.deps.forEach((dep) => {
    dep.delete(effect)
  })
  effect.deps.length = 0
}

/**
 * 创建一个 effect 函数
 */
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): (() => T) & { effect: ReactiveEffect<T> } {
  const _effect = new ReactiveEffect(fn, options)

  // 如果不是 lazy 模式，立即执行一次
  if (!options || !options.lazy) {
    _effect.run()
  }

  // 返回 runner 函数，可以手动触发 effect
  const runner = _effect.run.bind(_effect) as (() => T) & { effect: ReactiveEffect<T> }
  runner.effect = _effect
  return runner
}

/**
 * 依赖收集：建立响应式对象属性与 effect 的关系
 */
export function track(target: object, key: unknown) {
  // 如果没有活跃的 effect，不需要收集依赖
  if (!activeEffect) {
    return
  }

  // 获取 target 对应的依赖映射
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  // 获取 key 对应的依赖集合
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  // 建立双向依赖关系
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

/**
 * 触发更新：执行与响应式对象属性相关的所有 effect
 */
export function trigger(target: object, key: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }

  const dep = depsMap.get(key)
  if (!dep) {
    return
  }

  // 创建新的 Set 避免在遍历过程中修改原 Set
  const effects = new Set(dep)

  effects.forEach((effect) => {
    // 避免无限递归：如果当前正在执行的 effect 就是要触发的 effect，跳过
    if (effect !== activeEffect) {
      if (effect.scheduler) {
        effect.scheduler(effect)
      } else {
        effect.run()
      }
    }
  })
}

/**
 * 停止 effect 的执行
 */
export function stop(runner: any) {
  runner.effect.stop()
}
