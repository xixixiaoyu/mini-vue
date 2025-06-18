import { VNode, ShapeFlags, Text, Fragment, isSameVNodeType } from './vnode'
import { effect } from '../reactivity'
import { callHook, LifecycleHooks } from './apiLifecycle'
import { createComponentInstance, setupComponent, ComponentInstance } from './component'

// 渲染器选项接口
export interface RendererOptions {
  createElement(tag: string): Element
  createText(text: string): Text
  setText(node: Text, text: string): void
  setElementText(el: Element, text: string): void
  insert(child: Node, parent: Element, anchor?: Node | null): void
  remove(child: Node): void
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
}

/**
 * 创建渲染器
 */
export function createRenderer(options: RendererOptions) {
  const { createElement, createText, setText, setElementText, insert, remove, patchProp } = options

  /**
   * 渲染函数
   */
  function render(vnode: VNode | null, container: Element) {
    if (vnode == null) {
      // 卸载
      if ((container as any)._vnode) {
        unmount((container as any)._vnode)
      }
    } else {
      // 挂载或更新
      patch((container as any)._vnode || null, vnode, container)
    }
    ;(container as any)._vnode = vnode
  }

  /**
   * 核心 patch 函数：比较新旧 VNode 并更新 DOM
   */
  function patch(
    n1: VNode | null, // 旧 VNode
    n2: VNode, // 新 VNode
    container: Element,
    anchor?: Node | null
  ) {
    // 如果新旧 VNode 类型不同，直接卸载旧节点
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

  /**
   * 处理文本节点
   */
  function processText(n1: VNode | null, n2: VNode, container: Element, anchor?: Node | null) {
    if (n1 == null) {
      // 挂载文本节点
      n2.el = createText(n2.children as string)
      insert(n2.el, container, anchor)
    } else {
      // 更新文本节点
      const el = (n2.el = n1.el!)
      if (n2.children !== n1.children) {
        setText(el as Text, n2.children as string)
      }
    }
  }

  /**
   * 处理 Fragment 节点
   */
  function processFragment(n1: VNode | null, n2: VNode, container: Element, anchor?: Node | null) {
    if (n1 == null) {
      // 挂载 Fragment 的子节点
      mountChildren(n2.children as VNode[], container, anchor)
    } else {
      // 更新 Fragment 的子节点
      patchChildren(n1, n2, container, anchor)
    }
  }

  /**
   * 处理元素节点
   */
  function processElement(n1: VNode | null, n2: VNode, container: Element, anchor?: Node | null) {
    if (n1 == null) {
      // 挂载元素
      mountElement(n2, container, anchor)
    } else {
      // 更新元素
      patchElement(n1, n2)
    }
  }

  /**
   * 挂载元素节点
   */
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

  /**
   * 更新元素节点
   */
  function patchElement(n1: VNode, n2: VNode) {
    const el = (n2.el = n1.el!)

    // 确保是 Element 类型，不是 Text 节点
    if (el instanceof Element) {
      // 更新 props
      const oldProps = n1.props || {}
      const newProps = n2.props || {}
      patchProps(el, oldProps, newProps)

      // 更新子节点
      patchChildren(n1, n2, el)
    }
  }

  /**
   * 更新属性
   */
  function patchProps(el: Element, oldProps: Record<string, any>, newProps: Record<string, any>) {
    // 更新新属性
    for (const key in newProps) {
      const prev = oldProps[key]
      const next = newProps[key]
      if (prev !== next) {
        patchProp(el, key, prev, next)
      }
    }

    // 删除旧属性
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProp(el, key, oldProps[key], null)
      }
    }
  }

  /**
   * 挂载子节点数组
   */
  function mountChildren(children: VNode[], container: Element, anchor?: Node | null) {
    for (let i = 0; i < children.length; i++) {
      patch(null, children[i], container, anchor)
    }
  }

  /**
   * 更新子节点
   */
  function patchChildren(n1: VNode, n2: VNode, container: Element, anchor?: Node | null) {
    const c1 = n1.children
    const c2 = n2.children
    const prevShapeFlag = n1.shapeFlag
    const shapeFlag = n2.shapeFlag

    // 新子节点是文本
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 旧子节点是数组，需要卸载
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[])
      }
      // 更新文本内容
      if (c2 !== c1) {
        setElementText(container, c2 as string)
      }
    } else {
      // 新子节点是数组或空
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 新旧都是数组，执行 diff
          patchKeyedChildren(c1 as VNode[], c2 as VNode[], container, anchor)
        } else {
          // 新子节点为空，卸载旧子节点
          unmountChildren(c1 as VNode[])
        }
      } else {
        // 旧子节点是文本或空
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          setElementText(container, '')
        }
        // 挂载新子节点
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2 as VNode[], container, anchor)
        }
      }
    }
  }

  /**
   * 处理组件
   */
  function processComponent(n1: VNode | null, n2: VNode, container: Element, anchor?: Node | null) {
    if (n1 == null) {
      // 挂载组件
      mountComponent(n2, container, anchor)
    } else {
      // 更新组件
      updateComponent(n1, n2)
    }
  }

  /**
   * 挂载组件
   */
  function mountComponent(vnode: VNode, container: Element, anchor?: Node | null) {
    // 创建组件实例
    const instance = createComponentInstance(vnode)
    vnode.component = instance

    // 设置组件
    setupComponent(instance)

    // 设置渲染 effect
    setupRenderEffect(instance, vnode, container, anchor)
  }

  /**
   * 更新组件
   */
  function updateComponent(n1: VNode, n2: VNode) {
    const instance = (n2.component = n1.component!)
    // 简化处理：直接触发重新渲染
    instance.update()
  }

  /**
   * 设置渲染 effect
   */
  function setupRenderEffect(
    instance: ComponentInstance,
    vnode: VNode,
    container: Element,
    anchor?: Node | null
  ) {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        // 调用 beforeMount 钩子
        callHook(instance, LifecycleHooks.BEFORE_MOUNT)

        // 挂载
        const subTree = instance.render!()
        instance.subTree = subTree
        patch(null, subTree, container, anchor)
        vnode.el = subTree.el
        instance.isMounted = true

        // 调用 mounted 钩子
        callHook(instance, LifecycleHooks.MOUNTED)
      } else {
        // 调用 beforeUpdate 钩子
        callHook(instance, LifecycleHooks.BEFORE_UPDATE)

        // 更新
        const nextTree = instance.render!()
        const prevTree = instance.subTree
        instance.subTree = nextTree
        patch(prevTree, nextTree, container, anchor)
        vnode.el = nextTree.el

        // 调用 updated 钩子
        callHook(instance, LifecycleHooks.UPDATED)
      }
    }

    // 创建响应式 effect
    const update = (instance.update = effect(componentUpdateFn, {
      scheduler() {
        // 异步更新队列（简化处理）
        queueJob(update)
      },
    }))
  }

  /**
   * 卸载节点
   */
  function unmount(vnode: VNode) {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // 卸载组件
      unmountComponent(vnode)
    } else {
      // 卸载元素
      remove(vnode.el!)
    }
  }

  /**
   * 卸载子节点数组
   */
  function unmountChildren(children: VNode[]) {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i])
    }
  }

  /**
   * 卸载组件
   */
  function unmountComponent(vnode: VNode) {
    const instance = vnode.component
    if (instance) {
      // 调用 beforeUnmount 钩子
      callHook(instance, LifecycleHooks.BEFORE_UNMOUNT)

      unmount(instance.subTree!)

      // 调用 unmounted 钩子
      callHook(instance, LifecycleHooks.UNMOUNTED)
    }
  }

  /**
   * 简化版的 diff 算法：处理有 key 的子节点数组
   */
  function patchKeyedChildren(c1: VNode[], c2: VNode[], container: Element, anchor?: Node | null) {
    let i = 0
    const l2 = c2.length
    let e1 = c1.length - 1
    let e2 = l2 - 1

    // 1. 从头开始比较相同的节点
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = c2[i]
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, anchor)
      } else {
        break
      }
      i++
    }

    // 2. 从尾开始比较相同的节点
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = c2[e2]
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, anchor)
      } else {
        break
      }
      e1--
      e2--
    }

    // 3. 如果旧节点遍历完，新节点还有剩余，则挂载新节点
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1
        const anchor = nextPos < l2 ? c2[nextPos].el : null
        while (i <= e2) {
          patch(null, c2[i], container, anchor as Node)
          i++
        }
      }
    }
    // 4. 如果新节点遍历完，旧节点还有剩余，则卸载旧节点
    else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i])
        i++
      }
    }
    // 5. 处理中间的复杂情况（简化处理）
    else {
      // 简化处理：直接卸载旧节点，挂载新节点
      for (let j = i; j <= e1; j++) {
        unmount(c1[j])
      }
      for (let j = i; j <= e2; j++) {
        patch(null, c2[j], container, anchor)
      }
    }
  }

  return {
    render,
  }
}

// 简化的任务队列
const queue: Function[] = []
let isFlushPending = false

function queueJob(job: Function) {
  if (!queue.includes(job)) {
    queue.push(job)
  }
  queueFlush()
}

function queueFlush() {
  if (!isFlushPending) {
    isFlushPending = true
    Promise.resolve().then(flushJobs)
  }
}

function flushJobs() {
  isFlushPending = false
  queue.forEach((job) => job())
  queue.length = 0
}
