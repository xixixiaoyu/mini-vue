# Mini Vue API 使用指南

## 📚 概述

本文档详细介绍 Mini Vue 提供的所有 API，包括响应式 API、组件 API、渲染 API 和生命周期 API。

## 🔄 响应式 API

### reactive()

创建一个响应式对象，对象的所有嵌套属性都会变成响应式的。

```typescript
function reactive<T extends object>(target: T): T
```

**示例：**

```javascript
import { reactive } from 'mini-vue'

const state = reactive({
  count: 0,
  user: {
    name: 'John',
    age: 25
  }
})

// 修改属性会触发响应式更新
state.count++
state.user.name = 'Jane'
```

**注意事项：**
- 只能用于对象类型（对象、数组等）
- 返回的是 Proxy 对象，不等于原始对象
- 嵌套对象会被递归地转换为响应式

### ref()

创建一个响应式引用，通常用于基本类型数据。

```typescript
function ref<T>(value: T): Ref<T>
```

**示例：**

```javascript
import { ref } from 'mini-vue'

const count = ref(0)
const message = ref('Hello')
const user = ref({ name: 'John' })

// 通过 .value 访问和修改值
console.log(count.value) // 0
count.value++
console.log(count.value) // 1

// 对象类型会自动用 reactive 包装
user.value.name = 'Jane' // 会触发响应式更新
```

**注意事项：**
- 需要通过 `.value` 访问和修改值
- 对象类型的值会自动用 `reactive()` 包装
- 在模板中会自动解包，不需要 `.value`

### computed()

创建一个计算属性，基于其他响应式数据计算得出，具有缓存特性。

```typescript
function computed<T>(getter: () => T): Ref<T>
function computed<T>(options: ComputedOptions<T>): Ref<T>

interface ComputedOptions<T> {
  get: () => T
  set?: (value: T) => void
}
```

**示例：**

```javascript
import { reactive, computed } from 'mini-vue'

const state = reactive({
  firstName: 'John',
  lastName: 'Doe'
})

// 只读计算属性
const fullName = computed(() => {
  return `${state.firstName} ${state.lastName}`
})

console.log(fullName.value) // "John Doe"

// 可写计算属性
const fullNameWritable = computed({
  get() {
    return `${state.firstName} ${state.lastName}`
  },
  set(value) {
    const names = value.split(' ')
    state.firstName = names[0]
    state.lastName = names[1]
  }
})

fullNameWritable.value = 'Jane Smith'
console.log(state.firstName) // "Jane"
console.log(state.lastName)  // "Smith"
```

**特性：**
- 具有缓存，只在依赖变化时重新计算
- 支持链式依赖
- 可以是只读或可写的

### effect()

创建一个副作用函数，当其依赖的响应式数据发生变化时会重新执行。

```typescript
function effect<T>(
  fn: () => T,
  options?: ReactiveEffectOptions
): (() => T) & { effect: ReactiveEffect<T> }

interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: (job: ReactiveEffect) => void
}
```

**示例：**

```javascript
import { reactive, effect } from 'mini-vue'

const state = reactive({ count: 0 })

// 基本用法
effect(() => {
  console.log(`count is: ${state.count}`)
})
// 输出: count is: 0

state.count++
// 输出: count is: 1

// 懒执行
const runner = effect(() => {
  console.log(`lazy count: ${state.count}`)
}, { lazy: true })

// 手动执行
runner() // 输出: lazy count: 1

// 自定义调度器
effect(() => {
  console.log(`scheduled count: ${state.count}`)
}, {
  scheduler(job) {
    // 延迟执行
    setTimeout(() => job.run(), 100)
  }
})
```

### 其他响应式工具

#### isReactive()

判断一个对象是否为响应式对象。

```javascript
import { reactive, isReactive } from 'mini-vue'

const obj = { count: 0 }
const reactiveObj = reactive(obj)

console.log(isReactive(obj))         // false
console.log(isReactive(reactiveObj)) // true
```

#### isRef()

判断一个值是否为 ref 对象。

```javascript
import { ref, isRef } from 'mini-vue'

const count = ref(0)
const obj = { count: 0 }

console.log(isRef(count)) // true
console.log(isRef(obj))   // false
```

#### unref()

获取 ref 的值，如果不是 ref 则直接返回。

```javascript
import { ref, unref } from 'mini-vue'

const count = ref(0)
const num = 10

console.log(unref(count)) // 0
console.log(unref(num))   // 10
```

#### toRefs()

将响应式对象转换为普通对象，其中每个属性都是指向原始对象相应属性的 ref。

```javascript
import { reactive, toRefs } from 'mini-vue'

const state = reactive({
  count: 0,
  message: 'hello'
})

const stateAsRefs = toRefs(state)

// 现在每个属性都是 ref
console.log(stateAsRefs.count.value)    // 0
console.log(stateAsRefs.message.value)  // "hello"

// 修改会影响原始对象
stateAsRefs.count.value++
console.log(state.count) // 1
```

## 🎨 渲染 API

### h()

创建虚拟 DOM 节点的函数。

```typescript
function h(
  type: string | Component,
  props?: Record<string, any> | null,
  children?: string | VNode[] | null
): VNode
```

**示例：**

```javascript
import { h } from 'mini-vue'

// 创建简单元素
const vnode1 = h('div', 'Hello World')

// 创建带属性的元素
const vnode2 = h('div', { id: 'app', class: 'container' }, 'Hello')

// 创建带子元素的元素
const vnode3 = h('div', null, [
  h('h1', 'Title'),
  h('p', 'Content')
])

// 创建组件
const MyComponent = { /* 组件定义 */ }
const vnode4 = h(MyComponent, { prop1: 'value1' })
```

### createApp()

创建应用实例。

```typescript
function createApp(rootComponent: Component): App

interface App {
  mount(rootContainer: Element | string): void
}
```

**示例：**

```javascript
import { createApp, h } from 'mini-vue'

const App = {
  render() {
    return h('div', 'Hello Mini Vue!')
  }
}

const app = createApp(App)
app.mount('#app')
```

### render()

直接渲染虚拟 DOM 到容器。

```typescript
function render(vnode: VNode | null, container: Element): void
```

**示例：**

```javascript
import { render, h } from 'mini-vue'

const vnode = h('div', 'Hello World')
const container = document.getElementById('app')

render(vnode, container)
```

## 🧩 组件 API

### 组件定义

组件可以通过对象或函数定义：

```javascript
// 选项式组件
const MyComponent = {
  props: ['message', 'count'],
  setup(props, { emit }) {
    const handleClick = () => {
      emit('click', 'button clicked')
    }
    
    return {
      handleClick
    }
  },
  render() {
    return h('button', { onClick: this.handleClick }, this.message)
  }
}

// 函数式组件
const FunctionalComponent = (props) => {
  return h('div', props.message)
}
```

### Props

组件可以接收父组件传递的属性：

```javascript
const ChildComponent = {
  props: ['title', 'count'],
  render() {
    return h('div', [
      h('h2', this.title),
      h('p', `Count: ${this.count}`)
    ])
  }
}

const ParentComponent = {
  render() {
    return h(ChildComponent, {
      title: 'Hello',
      count: 42
    })
  }
}
```

### Emit

子组件可以向父组件发射事件：

```javascript
const ChildComponent = {
  setup(props, { emit }) {
    const handleClick = () => {
      emit('customEvent', 'some data')
    }
    
    return { handleClick }
  },
  render() {
    return h('button', { onClick: this.handleClick }, 'Click me')
  }
}

const ParentComponent = {
  setup() {
    const handleCustomEvent = (data) => {
      console.log('Received:', data)
    }
    
    return { handleCustomEvent }
  },
  render() {
    return h(ChildComponent, {
      onCustomEvent: this.handleCustomEvent
    })
  }
}
```

## 🔄 生命周期 API

### onMounted()

组件挂载完成后调用。

```javascript
import { onMounted } from 'mini-vue'

const MyComponent = {
  setup() {
    onMounted(() => {
      console.log('Component mounted!')
    })
  }
}
```

### onUpdated()

组件更新完成后调用。

```javascript
import { onUpdated } from 'mini-vue'

const MyComponent = {
  setup() {
    onUpdated(() => {
      console.log('Component updated!')
    })
  }
}
```

### onBeforeMount()

组件挂载之前调用。

```javascript
import { onBeforeMount } from 'mini-vue'

const MyComponent = {
  setup() {
    onBeforeMount(() => {
      console.log('Before mount!')
    })
  }
}
```

### onBeforeUpdate()

组件更新之前调用。

```javascript
import { onBeforeUpdate } from 'mini-vue'

const MyComponent = {
  setup() {
    onBeforeUpdate(() => {
      console.log('Before update!')
    })
  }
}
```

### onBeforeUnmount()

组件卸载之前调用。

```javascript
import { onBeforeUnmount } from 'mini-vue'

const MyComponent = {
  setup() {
    onBeforeUnmount(() => {
      console.log('Before unmount!')
    })
  }
}
```

### onUnmounted()

组件卸载完成后调用。

```javascript
import { onUnmounted } from 'mini-vue'

const MyComponent = {
  setup() {
    onUnmounted(() => {
      console.log('Component unmounted!')
    })
  }
}
```

## 🎯 完整示例

```javascript
import { 
  createApp, 
  reactive, 
  ref, 
  computed, 
  h, 
  onMounted,
  onUpdated 
} from 'mini-vue'

const TodoApp = {
  setup() {
    const todos = reactive([])
    const newTodo = ref('')
    
    const completedCount = computed(() => {
      return todos.filter(todo => todo.completed).length
    })
    
    const addTodo = () => {
      if (newTodo.value.trim()) {
        todos.push({
          id: Date.now(),
          text: newTodo.value,
          completed: false
        })
        newTodo.value = ''
      }
    }
    
    const toggleTodo = (todo) => {
      todo.completed = !todo.completed
    }
    
    onMounted(() => {
      console.log('Todo app mounted!')
    })
    
    onUpdated(() => {
      console.log('Todo app updated!')
    })
    
    return {
      todos,
      newTodo,
      completedCount,
      addTodo,
      toggleTodo
    }
  },
  
  render() {
    return h('div', [
      h('h1', 'Todo App'),
      h('div', [
        h('input', {
          value: this.newTodo,
          onInput: (e) => this.newTodo = e.target.value,
          placeholder: 'Add a todo...'
        }),
        h('button', { onClick: this.addTodo }, 'Add')
      ]),
      h('p', `Completed: ${this.completedCount}/${this.todos.length}`),
      h('ul', this.todos.map(todo =>
        h('li', {
          key: todo.id,
          style: { textDecoration: todo.completed ? 'line-through' : 'none' },
          onClick: () => this.toggleTodo(todo)
        }, todo.text)
      ))
    ])
  }
}

createApp(TodoApp).mount('#app')
```

这个完整的示例展示了如何使用 Mini Vue 的各种 API 来构建一个功能完整的 Todo 应用。
