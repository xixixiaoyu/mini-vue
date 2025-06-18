import { reactive, ref, computed, effect } from '../src/reactivity'

describe('响应式系统测试', () => {
  describe('reactive', () => {
    test('应该使对象变为响应式', () => {
      const original = { count: 0 }
      const observed = reactive(original)
      
      expect(observed).not.toBe(original)
      expect(observed.count).toBe(0)
    })

    test('应该触发 effect', () => {
      const obj = reactive({ count: 0 })
      let dummy
      
      effect(() => {
        dummy = obj.count
      })
      
      expect(dummy).toBe(0)
      obj.count++
      expect(dummy).toBe(1)
    })

    test('应该处理嵌套对象', () => {
      const obj = reactive({
        nested: { count: 0 }
      })
      let dummy
      
      effect(() => {
        dummy = obj.nested.count
      })
      
      expect(dummy).toBe(0)
      obj.nested.count++
      expect(dummy).toBe(1)
    })
  })

  describe('ref', () => {
    test('应该创建 ref 对象', () => {
      const count = ref(0)
      
      expect(count.value).toBe(0)
    })

    test('应该触发 effect', () => {
      const count = ref(0)
      let dummy
      
      effect(() => {
        dummy = count.value
      })
      
      expect(dummy).toBe(0)
      count.value++
      expect(dummy).toBe(1)
    })

    test('应该处理对象值', () => {
      const obj = ref({ count: 0 })
      let dummy
      
      effect(() => {
        dummy = obj.value.count
      })
      
      expect(dummy).toBe(0)
      obj.value.count++
      expect(dummy).toBe(1)
    })
  })

  describe('computed', () => {
    test('应该返回计算值', () => {
      const value = reactive({ count: 1 })
      const c = computed(() => value.count * 2)
      
      expect(c.value).toBe(2)
    })

    test('应该在依赖变化时重新计算', () => {
      const value = reactive({ count: 1 })
      const c = computed(() => value.count * 2)
      
      expect(c.value).toBe(2)
      value.count = 2
      expect(c.value).toBe(4)
    })

    test('应该缓存计算结果', () => {
      const value = reactive({ count: 1 })
      const getter = jest.fn(() => value.count * 2)
      const c = computed(getter)
      
      // 第一次访问
      expect(c.value).toBe(2)
      expect(getter).toHaveBeenCalledTimes(1)
      
      // 再次访问，应该使用缓存
      expect(c.value).toBe(2)
      expect(getter).toHaveBeenCalledTimes(1)
      
      // 依赖变化后重新计算
      value.count = 2
      expect(c.value).toBe(4)
      expect(getter).toHaveBeenCalledTimes(2)
    })

    test('应该触发 effect', () => {
      const value = reactive({ count: 1 })
      const c = computed(() => value.count * 2)
      let dummy
      
      effect(() => {
        dummy = c.value
      })
      
      expect(dummy).toBe(2)
      value.count = 2
      expect(dummy).toBe(4)
    })
  })

  describe('effect', () => {
    test('应该立即执行', () => {
      const fn = jest.fn()
      effect(fn)
      
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('应该在依赖变化时重新执行', () => {
      const obj = reactive({ count: 0 })
      const fn = jest.fn(() => obj.count)
      
      effect(fn)
      expect(fn).toHaveBeenCalledTimes(1)
      
      obj.count++
      expect(fn).toHaveBeenCalledTimes(2)
    })

    test('应该支持 lazy 选项', () => {
      const obj = reactive({ count: 0 })
      const fn = jest.fn(() => obj.count)
      
      const runner = effect(fn, { lazy: true })
      expect(fn).toHaveBeenCalledTimes(0)
      
      runner()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('应该支持 scheduler 选项', () => {
      const obj = reactive({ count: 0 })
      const scheduler = jest.fn()
      const fn = jest.fn(() => obj.count)
      
      effect(fn, { scheduler })
      expect(fn).toHaveBeenCalledTimes(1)
      expect(scheduler).toHaveBeenCalledTimes(0)
      
      obj.count++
      expect(fn).toHaveBeenCalledTimes(1)
      expect(scheduler).toHaveBeenCalledTimes(1)
    })
  })
})
