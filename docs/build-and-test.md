# 构建和测试指南

## 📖 概述

本文档详细介绍了 Mini Vue 项目的构建配置、测试策略和开发工具链，帮助开发者理解现代前端项目的工程化实践。

## 🛠️ 构建系统

### TypeScript 配置

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2020",           // 编译目标
    "module": "ESNext",           // 模块系统
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "declaration": true,          // 生成类型声明文件
    "outDir": "./dist",          // 输出目录
    "rootDir": "./src",          // 源码目录
    "strict": true,              // 严格模式
    "noUnusedLocals": true,      // 检查未使用的局部变量
    "noUnusedParameters": true,   // 检查未使用的参数
    "noImplicitReturns": true,   // 检查隐式返回
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",   // 模块解析策略
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]           // 路径映射
    },
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**配置要点：**
- 使用 ES2020 作为编译目标，支持现代 JavaScript 特性
- 启用严格模式，提高代码质量
- 生成类型声明文件，支持 TypeScript 用户
- 配置路径映射，简化导入路径

### Rollup 构建配置

**rollup.config.js**
```javascript
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',              // CommonJS 格式
      exports: 'named'
    },
    {
      file: 'dist/index.esm.js',
      format: 'es'                // ES Module 格式
    }
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    })
  ],
  external: []                    // 外部依赖
};
```

**构建特点：**
- 支持多种模块格式 (CJS, ESM)
- 使用 TypeScript 插件处理 TS 文件
- 无外部依赖，生成独立的构建文件

### 构建脚本

**package.json**
```json
{
  "scripts": {
    "build": "rollup -c",           // 构建
    "dev": "rollup -c -w",          // 开发模式（监听文件变化）
    "test": "jest",                 // 运行测试
    "test:watch": "jest --watch",   // 监听模式测试
    "serve": "http-server examples -p 8080 -o"  // 启动示例服务器
  }
}
```

## 🧪 测试系统

### Jest 配置

**jest.config.js**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

**配置说明：**
- 使用 `ts-jest` 预设处理 TypeScript
- 使用 `jsdom` 环境模拟浏览器环境
- 配置测试文件匹配模式
- 设置代码覆盖率报告

### 测试策略

#### 1. 单元测试

**响应式系统测试**
```typescript
// tests/reactivity.test.ts
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
    test('应该创建响应式引用', () => {
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
  })

  describe('computed', () => {
    test('应该计算值', () => {
      const count = ref(1)
      const doubled = computed(() => count.value * 2)
      
      expect(doubled.value).toBe(2)
    })

    test('应该缓存计算结果', () => {
      const count = ref(1)
      const getter = jest.fn(() => count.value * 2)
      const doubled = computed(getter)
      
      // 第一次访问
      expect(doubled.value).toBe(2)
      expect(getter).toHaveBeenCalledTimes(1)
      
      // 第二次访问，应该使用缓存
      expect(doubled.value).toBe(2)
      expect(getter).toHaveBeenCalledTimes(1)
      
      // 依赖变化后重新计算
      count.value = 2
      expect(doubled.value).toBe(4)
      expect(getter).toHaveBeenCalledTimes(2)
    })
  })
})
```

**虚拟 DOM 测试**
```typescript
// tests/vnode.test.ts
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
```

#### 2. 集成测试

**组件渲染测试**
```typescript
// tests/component.test.ts
import { createApp, h, ref, reactive } from '../src'

describe('组件集成测试', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  test('应该渲染简单组件', () => {
    const App = {
      render() {
        return h('div', { id: 'app' }, 'Hello World')
      }
    }

    createApp(App).mount(container)
    
    expect(container.innerHTML).toBe('<div id="app">Hello World</div>')
  })

  test('应该处理响应式数据', () => {
    const App = {
      setup() {
        const count = ref(0)
        const increment = () => count.value++
        
        return { count, increment }
      },
      render() {
        return h('div', [
          h('span', `Count: ${this.count}`),
          h('button', { onClick: this.increment }, 'Increment')
        ])
      }
    }

    createApp(App).mount(container)
    
    expect(container.textContent).toContain('Count: 0')
    
    // 模拟点击
    const button = container.querySelector('button')!
    button.click()
    
    expect(container.textContent).toContain('Count: 1')
  })
})
```

### 测试覆盖率

运行测试并生成覆盖率报告：

```bash
npm test -- --coverage
```

**覆盖率目标：**
- 语句覆盖率: > 90%
- 分支覆盖率: > 85%
- 函数覆盖率: > 90%
- 行覆盖率: > 90%

## 🔧 开发工具

### 开发服务器

使用 `http-server` 提供静态文件服务：

```bash
npm run serve
```

这将启动一个本地服务器，可以在浏览器中查看示例。

### 监听模式

开发时使用监听模式，自动重新构建：

```bash
npm run dev
```

### 代码质量

#### ESLint 配置（可选）

```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    'prefer-const': 'error'
  }
}
```

#### Prettier 配置（可选）

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

## 📊 性能监控

### 构建分析

分析构建产物大小：

```bash
# 安装分析工具
npm install -D rollup-plugin-analyzer

# 在 rollup.config.js 中添加插件
import { analyzer } from 'rollup-plugin-analyzer'

export default {
  // ...
  plugins: [
    typescript(),
    analyzer({ summaryOnly: true })
  ]
}
```

### 运行时性能

在示例中添加性能监控：

```typescript
// 性能测试示例
const performanceTest = () => {
  const start = performance.now()
  
  // 创建大量响应式数据
  const data = reactive({
    items: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i }))
  })
  
  // 批量更新
  data.items.forEach(item => {
    item.value *= 2
  })
  
  const end = performance.now()
  console.log(`性能测试耗时: ${end - start}ms`)
}
```

## 🚀 部署和发布

### 构建生产版本

```bash
npm run build
```

### 发布到 npm

```bash
# 更新版本
npm version patch

# 发布
npm publish
```

### 文档部署

可以使用 GitHub Pages 或其他静态站点托管服务部署文档：

```bash
# 构建文档站点
npm run build:docs

# 部署到 GitHub Pages
npm run deploy
```

## 📚 相关文档

- [实现指南](./implementation-guide.md)
- [响应式系统](./reactivity-system.md)
- [虚拟 DOM](./virtual-dom.md)
- [组件系统](./component-system.md)
- [实战示例](./examples.md)
