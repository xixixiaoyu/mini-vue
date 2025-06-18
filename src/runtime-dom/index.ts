import { createRenderer, RendererOptions } from '../runtime-core/renderer'

/**
 * DOM 操作的具体实现
 */
const rendererOptions: RendererOptions = {
  // 创建元素
  createElement(tag: string): Element {
    return document.createElement(tag)
  },

  // 创建文本节点
  createText(text: string): Text {
    return document.createTextNode(text)
  },

  // 设置文本节点内容
  setText(node: Text, text: string): void {
    node.nodeValue = text
  },

  // 设置元素文本内容
  setElementText(el: Element, text: string): void {
    el.textContent = text
  },

  // 插入节点
  insert(child: Node, parent: Element, anchor?: Node | null): void {
    parent.insertBefore(child, anchor || null)
  },

  // 移除节点
  remove(child: Node): void {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  // 更新属性
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void {
    if (key.startsWith('on')) {
      // 事件处理
      const eventName = key.slice(2).toLowerCase()
      if (prevValue) {
        el.removeEventListener(eventName, prevValue)
      }
      if (nextValue) {
        el.addEventListener(eventName, nextValue)
      }
    } else if (key === 'class') {
      // class 属性
      el.className = nextValue || ''
    } else if (key === 'style') {
      // style 属性
      if (typeof nextValue === 'string') {
        ;(el as HTMLElement).style.cssText = nextValue
      } else if (typeof nextValue === 'object') {
        const style = (el as HTMLElement).style
        for (const styleName in nextValue) {
          style[styleName as any] = nextValue[styleName]
        }
        // 清理旧样式
        if (prevValue && typeof prevValue === 'object') {
          for (const styleName in prevValue) {
            if (!(styleName in nextValue)) {
              style[styleName as any] = ''
            }
          }
        }
      }
    } else {
      // 普通属性
      if (nextValue == null || nextValue === false) {
        el.removeAttribute(key)
      } else {
        el.setAttribute(key, nextValue)
      }
    }
  }
}

// 创建 DOM 渲染器
const renderer = createRenderer(rendererOptions)

/**
 * 渲染函数
 */
export function render(vnode: any, container: Element) {
  renderer.render(vnode, container)
}

/**
 * 创建应用实例
 */
export function createApp(rootComponent: any) {
  return {
    mount(rootContainer: Element | string) {
      const container = typeof rootContainer === 'string' 
        ? document.querySelector(rootContainer)! 
        : rootContainer

      // 创建根组件的 VNode
      const vnode = createVNode(rootComponent)
      
      // 渲染到容器
      render(vnode, container)
    }
  }
}

// 重新导出核心 API
export { h, createVNode, createTextVNode } from '../runtime-core/vnode'
export * from '../reactivity'

// 简化的 createVNode 实现（用于 createApp）
function createVNode(component: any) {
  return {
    type: component,
    props: null,
    children: null,
    shapeFlag: 2, // STATEFUL_COMPONENT
    el: null,
    key: null,
    component: null
  }
}
