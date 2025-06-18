# Mini Vue

一个用于学习的 Vue 3 最小化实现，包含核心的响应式系统、虚拟 DOM、组件系统等功能。

## 🚀 特性

- ✅ **响应式系统**：实现 `reactive`、`ref`、`computed`、`effect` 等核心 API
- ✅ **虚拟 DOM**：VNode 创建、diff 算法和 patch 更新机制
- ✅ **组件系统**：组件定义、props、emit、生命周期钩子
- ✅ **渲染器**：DOM 挂载和更新的渲染逻辑
- 📝 **TypeScript**：完整的类型支持
- 🧪 **测试覆盖**：完整的单元测试

## 📁 项目结构

```
mini-vue/
├── src/
│   ├── reactivity/     # 响应式系统
│   │   ├── reactive.ts
│   │   ├── ref.ts
│   │   ├── effect.ts
│   │   └── computed.ts
│   ├── runtime-core/   # 运行时核心
│   │   ├── component.ts
│   │   ├── vnode.ts
│   │   └── renderer.ts
│   ├── runtime-dom/    # DOM 相关
│   │   └── index.ts
│   └── index.ts        # 入口文件
├── examples/           # 示例代码
├── tests/             # 测试文件
├── docs/              # 学习文档
└── dist/              # 构建输出
```

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 启动示例服务器
npm run serve
```

## 📚 学习资源

- [设计思路和实现原理](./docs/design.md)
- [核心算法详解](./docs/algorithms.md)
- [API 使用指南](./docs/api.md)
- [与 Vue 3 源码对比](./docs/comparison.md)

## 🎯 快速开始

```typescript
import { createApp, reactive, computed } from './src/index'

// 创建响应式数据
const state = reactive({
  count: 0,
  message: 'Hello Mini Vue!'
})

// 创建计算属性
const doubleCount = computed(() => state.count * 2)

// 创建应用
const app = createApp({
  setup() {
    const increment = () => {
      state.count++
    }

    return {
      state,
      doubleCount,
      increment
    }
  },
  render() {
    return h('div', [
      h('p', `Count: ${this.state.count}`),
      h('p', `Double: ${this.doubleCount}`),
      h('button', { onClick: this.increment }, 'Increment')
    ])
  }
})

app.mount('#app')
```

## 📖 核心概念

### 响应式系统
基于 Proxy 实现的响应式系统，支持深度响应和依赖追踪。

### 虚拟 DOM
轻量级的 JavaScript 对象表示 DOM 结构，通过 diff 算法实现高效更新。

### 组件系统
支持函数式组件和选项式组件，包含完整的生命周期管理。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
