# 实战示例

## 📖 概述

本文档提供了使用 Mini Vue 构建实际应用的完整示例，展示了如何运用响应式系统、组件系统、生命周期等核心特性。

## 🎯 示例列表

1. [基础计数器](#基础计数器)
2. [待办事项列表](#待办事项列表)
3. [用户信息卡片](#用户信息卡片)
4. [动态表单](#动态表单)
5. [数据可视化](#数据可视化)

## 🔢 基础计数器

### 功能特性
- 响应式数据
- 事件处理
- 计算属性
- 生命周期钩子

```typescript
const Counter = {
  setup() {
    // 响应式状态
    const count = ref(0)
    const step = ref(1)
    
    // 计算属性
    const doubleCount = computed(() => count.value * 2)
    const isEven = computed(() => count.value % 2 === 0)
    
    // 方法
    const increment = () => {
      count.value += step.value
    }
    
    const decrement = () => {
      count.value -= step.value
    }
    
    const reset = () => {
      count.value = 0
    }
    
    // 生命周期
    onMounted(() => {
      console.log('计数器组件已挂载')
    })
    
    onUpdated(() => {
      console.log(`计数器更新: ${count.value}`)
    })
    
    return {
      count,
      step,
      doubleCount,
      isEven,
      increment,
      decrement,
      reset
    }
  },
  
  render() {
    return h('div', { class: 'counter' }, [
      h('h2', '计数器'),
      h('div', { class: 'display' }, [
        h('span', { class: 'count' }, `计数: ${this.count}`),
        h('span', { class: 'double' }, `双倍: ${this.doubleCount}`),
        h('span', { 
          class: this.isEven ? 'even' : 'odd' 
        }, this.isEven ? '偶数' : '奇数')
      ]),
      h('div', { class: 'controls' }, [
        h('input', {
          type: 'number',
          value: this.step,
          onInput: (e) => this.step = parseInt(e.target.value) || 1
        }),
        h('button', { onClick: this.decrement }, '-'),
        h('button', { onClick: this.increment }, '+'),
        h('button', { onClick: this.reset }, '重置')
      ])
    ])
  }
}
```

## 📝 待办事项列表

### 功能特性
- 列表渲染
- 条件渲染
- 表单处理
- 数据过滤

```typescript
const TodoList = {
  setup() {
    const todos = ref([
      { id: 1, text: '学习 Vue', completed: false },
      { id: 2, text: '构建项目', completed: true },
      { id: 3, text: '写文档', completed: false }
    ])
    
    const newTodo = ref('')
    const filter = ref('all') // all, active, completed
    
    // 计算属性
    const filteredTodos = computed(() => {
      switch (filter.value) {
        case 'active':
          return todos.value.filter(todo => !todo.completed)
        case 'completed':
          return todos.value.filter(todo => todo.completed)
        default:
          return todos.value
      }
    })
    
    const activeCount = computed(() => 
      todos.value.filter(todo => !todo.completed).length
    )
    
    const completedCount = computed(() => 
      todos.value.filter(todo => todo.completed).length
    )
    
    // 方法
    const addTodo = () => {
      if (newTodo.value.trim()) {
        todos.value.push({
          id: Date.now(),
          text: newTodo.value.trim(),
          completed: false
        })
        newTodo.value = ''
      }
    }
    
    const removeTodo = (id) => {
      const index = todos.value.findIndex(todo => todo.id === id)
      if (index > -1) {
        todos.value.splice(index, 1)
      }
    }
    
    const toggleTodo = (id) => {
      const todo = todos.value.find(todo => todo.id === id)
      if (todo) {
        todo.completed = !todo.completed
      }
    }
    
    const clearCompleted = () => {
      todos.value = todos.value.filter(todo => !todo.completed)
    }
    
    return {
      todos,
      newTodo,
      filter,
      filteredTodos,
      activeCount,
      completedCount,
      addTodo,
      removeTodo,
      toggleTodo,
      clearCompleted
    }
  },
  
  render() {
    return h('div', { class: 'todo-app' }, [
      h('h1', '待办事项'),
      
      // 输入框
      h('div', { class: 'todo-input' }, [
        h('input', {
          type: 'text',
          placeholder: '添加新任务...',
          value: this.newTodo,
          onInput: (e) => this.newTodo = e.target.value,
          onKeyup: (e) => e.key === 'Enter' && this.addTodo()
        }),
        h('button', { onClick: this.addTodo }, '添加')
      ]),
      
      // 过滤器
      h('div', { class: 'filters' }, [
        h('button', {
          class: this.filter === 'all' ? 'active' : '',
          onClick: () => this.filter = 'all'
        }, '全部'),
        h('button', {
          class: this.filter === 'active' ? 'active' : '',
          onClick: () => this.filter = 'active'
        }, '未完成'),
        h('button', {
          class: this.filter === 'completed' ? 'active' : '',
          onClick: () => this.filter = 'completed'
        }, '已完成')
      ]),
      
      // 任务列表
      h('ul', { class: 'todo-list' },
        this.filteredTodos.map(todo =>
          h('li', {
            key: todo.id,
            class: todo.completed ? 'completed' : ''
          }, [
            h('input', {
              type: 'checkbox',
              checked: todo.completed,
              onChange: () => this.toggleTodo(todo.id)
            }),
            h('span', { class: 'todo-text' }, todo.text),
            h('button', {
              class: 'delete',
              onClick: () => this.removeTodo(todo.id)
            }, '删除')
          ])
        )
      ),
      
      // 统计信息
      h('div', { class: 'todo-footer' }, [
        h('span', `活跃: ${this.activeCount} | 已完成: ${this.completedCount}`),
        this.completedCount > 0 && h('button', {
          onClick: this.clearCompleted
        }, '清除已完成')
      ])
    ])
  }
}
```

## 👤 用户信息卡片

### 功能特性
- 异步数据获取
- 加载状态
- 错误处理
- 组件通信

```typescript
// 用户卡片组件
const UserCard = {
  props: ['userId'],
  
  setup(props, { emit }) {
    const user = ref(null)
    const loading = ref(false)
    const error = ref(null)
    
    // 模拟 API 调用
    const fetchUser = async (id) => {
      loading.value = true
      error.value = null
      
      try {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 模拟用户数据
        const users = {
          1: { id: 1, name: '张三', email: 'zhangsan@example.com', avatar: '👨' },
          2: { id: 2, name: '李四', email: 'lisi@example.com', avatar: '👩' },
          3: { id: 3, name: '王五', email: 'wangwu@example.com', avatar: '👨‍💼' }
        }
        
        user.value = users[id] || null
        if (!user.value) {
          throw new Error('用户不存在')
        }
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }
    
    // 监听 userId 变化
    const stopWatcher = effect(() => {
      if (props.userId) {
        fetchUser(props.userId)
      }
    })
    
    // 组件卸载时停止监听
    onBeforeUnmount(() => {
      stopWatcher()
    })
    
    const handleEdit = () => {
      emit('edit', user.value)
    }
    
    const handleDelete = () => {
      emit('delete', user.value.id)
    }
    
    return {
      user,
      loading,
      error,
      handleEdit,
      handleDelete
    }
  },
  
  render() {
    if (this.loading) {
      return h('div', { class: 'user-card loading' }, '加载中...')
    }
    
    if (this.error) {
      return h('div', { class: 'user-card error' }, [
        h('p', `错误: ${this.error}`),
        h('button', { onClick: () => this.fetchUser(this.userId) }, '重试')
      ])
    }
    
    if (!this.user) {
      return h('div', { class: 'user-card empty' }, '请选择用户')
    }
    
    return h('div', { class: 'user-card' }, [
      h('div', { class: 'avatar' }, this.user.avatar),
      h('div', { class: 'info' }, [
        h('h3', this.user.name),
        h('p', this.user.email)
      ]),
      h('div', { class: 'actions' }, [
        h('button', { onClick: this.handleEdit }, '编辑'),
        h('button', { onClick: this.handleDelete }, '删除')
      ])
    ])
  }
}

// 用户管理组件
const UserManager = {
  setup() {
    const selectedUserId = ref(1)
    const users = ref([
      { id: 1, name: '张三' },
      { id: 2, name: '李四' },
      { id: 3, name: '王五' }
    ])
    
    const handleEdit = (user) => {
      console.log('编辑用户:', user)
    }
    
    const handleDelete = (userId) => {
      console.log('删除用户:', userId)
      // 如果删除的是当前选中的用户，清空选择
      if (selectedUserId.value === userId) {
        selectedUserId.value = null
      }
    }
    
    return {
      selectedUserId,
      users,
      handleEdit,
      handleDelete
    }
  },
  
  render() {
    return h('div', { class: 'user-manager' }, [
      h('h2', '用户管理'),
      
      // 用户列表
      h('div', { class: 'user-list' }, [
        h('h3', '用户列表'),
        h('ul',
          this.users.map(user =>
            h('li', {
              key: user.id,
              class: this.selectedUserId === user.id ? 'active' : '',
              onClick: () => this.selectedUserId = user.id
            }, user.name)
          )
        )
      ]),
      
      // 用户详情
      h('div', { class: 'user-detail' }, [
        h('h3', '用户详情'),
        h(UserCard, {
          userId: this.selectedUserId,
          onEdit: this.handleEdit,
          onDelete: this.handleDelete
        })
      ])
    ])
  }
}
```

## 📊 动态表单

### 功能特性
- 动态字段
- 表单验证
- 数据绑定

```typescript
const DynamicForm = {
  setup() {
    const formData = reactive({})
    const errors = reactive({})
    
    const fields = ref([
      {
        name: 'username',
        label: '用户名',
        type: 'text',
        required: true,
        rules: [
          { required: true, message: '用户名不能为空' },
          { min: 3, message: '用户名至少3个字符' }
        ]
      },
      {
        name: 'email',
        label: '邮箱',
        type: 'email',
        required: true,
        rules: [
          { required: true, message: '邮箱不能为空' },
          { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '邮箱格式不正确' }
        ]
      },
      {
        name: 'age',
        label: '年龄',
        type: 'number',
        required: false,
        rules: [
          { min: 18, max: 100, message: '年龄必须在18-100之间' }
        ]
      }
    ])
    
    // 验证单个字段
    const validateField = (field, value) => {
      const fieldErrors = []
      
      for (const rule of field.rules || []) {
        if (rule.required && (!value || value.trim() === '')) {
          fieldErrors.push(rule.message)
          break
        }
        
        if (rule.min && value && value.length < rule.min) {
          fieldErrors.push(rule.message)
        }
        
        if (rule.max && value && value.length > rule.max) {
          fieldErrors.push(rule.message)
        }
        
        if (rule.pattern && value && !rule.pattern.test(value)) {
          fieldErrors.push(rule.message)
        }
      }
      
      errors[field.name] = fieldErrors
    }
    
    // 验证整个表单
    const validateForm = () => {
      let isValid = true
      
      fields.value.forEach(field => {
        validateField(field, formData[field.name])
        if (errors[field.name] && errors[field.name].length > 0) {
          isValid = false
        }
      })
      
      return isValid
    }
    
    // 处理输入
    const handleInput = (fieldName, value) => {
      formData[fieldName] = value
      const field = fields.value.find(f => f.name === fieldName)
      if (field) {
        validateField(field, value)
      }
    }
    
    // 提交表单
    const handleSubmit = () => {
      if (validateForm()) {
        console.log('表单提交:', formData)
        alert('表单提交成功！')
      } else {
        console.log('表单验证失败:', errors)
      }
    }
    
    // 添加字段
    const addField = () => {
      const newField = {
        name: `field_${Date.now()}`,
        label: '新字段',
        type: 'text',
        required: false,
        rules: []
      }
      fields.value.push(newField)
    }
    
    // 移除字段
    const removeField = (index) => {
      const field = fields.value[index]
      delete formData[field.name]
      delete errors[field.name]
      fields.value.splice(index, 1)
    }
    
    return {
      formData,
      errors,
      fields,
      handleInput,
      handleSubmit,
      addField,
      removeField
    }
  },
  
  render() {
    return h('div', { class: 'dynamic-form' }, [
      h('h2', '动态表单'),
      
      h('form', { onSubmit: (e) => { e.preventDefault(); this.handleSubmit() } }, [
        // 渲染字段
        ...this.fields.map((field, index) =>
          h('div', { key: field.name, class: 'form-field' }, [
            h('label', field.label + (field.required ? ' *' : '')),
            h('input', {
              type: field.type,
              value: this.formData[field.name] || '',
              onInput: (e) => this.handleInput(field.name, e.target.value)
            }),
            h('button', {
              type: 'button',
              onClick: () => this.removeField(index)
            }, '删除字段'),
            // 显示错误信息
            this.errors[field.name] && this.errors[field.name].length > 0 &&
            h('div', { class: 'error' },
              this.errors[field.name].map(error =>
                h('p', { key: error }, error)
              )
            )
          ])
        ),
        
        // 表单操作
        h('div', { class: 'form-actions' }, [
          h('button', { type: 'button', onClick: this.addField }, '添加字段'),
          h('button', { type: 'submit' }, '提交表单')
        ])
      ])
    ])
  }
}
```

## 🚀 运行示例

### HTML 文件

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mini Vue 示例</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .example { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
    .counter { text-align: center; }
    .todo-app { max-width: 500px; }
    .user-card { border: 1px solid #ccc; padding: 15px; margin: 10px 0; }
    .form-field { margin: 10px 0; }
    .error { color: red; font-size: 12px; }
  </style>
</head>
<body>
  <div id="counter-app"></div>
  <div id="todo-app"></div>
  <div id="user-app"></div>
  <div id="form-app"></div>

  <script type="module">
    import { createApp } from './dist/index.esm.js'
    
    // 挂载各个示例
    createApp(Counter).mount('#counter-app')
    createApp(TodoList).mount('#todo-app')
    createApp(UserManager).mount('#user-app')
    createApp(DynamicForm).mount('#form-app')
  </script>
</body>
</html>
```

## 📚 相关文档

- [实现指南](./implementation-guide.md)
- [响应式系统](./reactivity-system.md)
- [组件系统](./component-system.md)
- [生命周期](./lifecycle.md)
