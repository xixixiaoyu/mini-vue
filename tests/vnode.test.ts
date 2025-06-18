import { h, createVNode, createTextVNode, Text, ShapeFlags } from '../src/runtime-core/vnode'

describe('虚拟 DOM 测试', () => {
  describe('createVNode', () => {
    test('应该创建元素 VNode', () => {
      const vnode = createVNode('div')

      expect(vnode.type).toBe('div')
      expect(vnode.props).toBe(null)
      expect(vnode.children).toBe(null)
      expect(vnode.shapeFlag).toBe(ShapeFlags.ELEMENT)
    })

    test('应该创建带 props 的 VNode', () => {
      const props = { id: 'test', class: 'container' }
      const vnode = createVNode('div', props)

      expect(vnode.props).toBe(props)
    })

    test('应该创建带文本子节点的 VNode', () => {
      const vnode = createVNode('div', null, 'hello')

      expect(vnode.children).toBe('hello')
      expect(vnode.shapeFlag & ShapeFlags.TEXT_CHILDREN).toBeTruthy()
    })

    test('应该创建带数组子节点的 VNode', () => {
      const children = [createVNode('span'), createVNode('p')]
      const vnode = createVNode('div', null, children)

      expect(vnode.children).toBe(children)
      expect(vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN).toBeTruthy()
    })
  })

  describe('createTextVNode', () => {
    test('应该创建文本 VNode', () => {
      const vnode = createTextVNode('hello world')

      expect(vnode.type).toBe(Text)
      expect(vnode.children).toBe('hello world')
    })
  })

  describe('h 函数', () => {
    test('应该支持 h(type, children)', () => {
      const vnode = h('div', 'hello')

      expect(vnode.type).toBe('div')
      expect(vnode.props).toBe(null)
      expect(vnode.children).toBe('hello')
    })

    test('应该支持 h(type, props)', () => {
      const props = { id: 'test' }
      const vnode = h('div', props)

      expect(vnode.type).toBe('div')
      expect(vnode.props).toBe(props)
      expect(vnode.children).toBe(null)
    })

    test('应该支持 h(type, props, children)', () => {
      const props = { id: 'test' }
      const vnode = h('div', props, 'hello')

      expect(vnode.type).toBe('div')
      expect(vnode.props).toBe(props)
      expect(vnode.children).toBe('hello')
    })

    test('应该支持数组子节点', () => {
      const children = [h('span'), h('p')]
      const vnode = h('div', null, children)

      expect(vnode.children).toBe(children)
      expect(vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN).toBeTruthy()
    })

    test('应该支持嵌套结构', () => {
      const vnode = h('div', { class: 'container' }, [
        h('h1', 'Title'),
        h('p', 'Content'),
        h('ul', [h('li', 'Item 1'), h('li', 'Item 2')]),
      ])

      expect(vnode.type).toBe('div')
      expect(vnode.props?.class).toBe('container')
      expect(Array.isArray(vnode.children)).toBe(true)
      expect((vnode.children as any[]).length).toBe(3)
    })
  })
})
