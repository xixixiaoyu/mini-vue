// 当前正在执行的 effect 函数
let activeEffect;
// 依赖收集的栈，用于处理嵌套的 effect
const effectStack = [];
const targetMap = new WeakMap();
class ReactiveEffect {
    constructor(fn, options) {
        this.deps = [];
        this.active = true;
        this._fn = fn;
        if (options) {
            this.scheduler = options.scheduler;
        }
    }
    run() {
        // 如果 effect 已经被停止，直接执行函数
        if (!this.active) {
            return this._fn();
        }
        try {
            // 将当前 effect 推入栈中
            effectStack.push(this);
            activeEffect = this;
            // 清理之前的依赖
            cleanupEffect(this);
            // 执行函数，在执行过程中会触发依赖收集
            return this._fn();
        }
        finally {
            // 执行完毕后从栈中弹出
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1];
        }
    }
    stop() {
        if (this.active) {
            cleanupEffect(this);
            this.active = false;
        }
    }
}
/**
 * 清理 effect 的所有依赖
 */
function cleanupEffect(effect) {
    effect.deps.forEach((dep) => {
        dep.delete(effect);
    });
    effect.deps.length = 0;
}
/**
 * 创建一个 effect 函数
 */
function effect(fn, options) {
    const _effect = new ReactiveEffect(fn, options);
    // 如果不是 lazy 模式，立即执行一次
    if (!options || !options.lazy) {
        _effect.run();
    }
    // 返回 runner 函数，可以手动触发 effect
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
}
/**
 * 依赖收集：建立响应式对象属性与 effect 的关系
 */
function track(target, key) {
    // 如果没有活跃的 effect，不需要收集依赖
    if (!activeEffect) {
        return;
    }
    // 获取 target 对应的依赖映射
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    // 获取 key 对应的依赖集合
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = new Set()));
    }
    // 建立双向依赖关系
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
    }
}
/**
 * 触发更新：执行与响应式对象属性相关的所有 effect
 */
function trigger(target, key) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
        return;
    }
    const dep = depsMap.get(key);
    if (!dep) {
        return;
    }
    // 创建新的 Set 避免在遍历过程中修改原 Set
    const effects = new Set(dep);
    effects.forEach((effect) => {
        // 避免无限递归：如果当前正在执行的 effect 就是要触发的 effect，跳过
        if (effect !== activeEffect) {
            if (effect.scheduler) {
                effect.scheduler(effect);
            }
            else {
                effect.run();
            }
        }
    });
}
/**
 * 停止 effect 的执行
 */
function stop(runner) {
    runner.effect.stop();
}

// 用于标识对象是否为响应式的 symbol
const ReactiveFlags = {
    IS_REACTIVE: '__v_isReactive'
};
// 存储原始对象到响应式对象的映射
const reactiveMap = new WeakMap();
/**
 * 判断一个值是否为对象
 */
function isObject$1(val) {
    return val !== null && typeof val === 'object';
}
/**
 * 创建响应式对象
 */
function reactive(target) {
    // 如果不是对象，直接返回
    if (!isObject$1(target)) {
        console.warn(`reactive() can only be called on objects, not ${typeof target}`);
        return target;
    }
    // 如果已经是响应式对象，直接返回
    if (isReactive(target)) {
        return target;
    }
    // 如果已经创建过响应式对象，返回缓存的结果
    const existingProxy = reactiveMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    // 创建 Proxy 代理对象
    const proxy = new Proxy(target, {
        get(target, key, receiver) {
            // 处理响应式标识
            if (key === ReactiveFlags.IS_REACTIVE) {
                return true;
            }
            // 获取属性值
            const result = Reflect.get(target, key, receiver);
            // 依赖收集
            track(target, key);
            // 如果属性值是对象，递归创建响应式对象
            if (isObject$1(result)) {
                return reactive(result);
            }
            return result;
        },
        set(target, key, value, receiver) {
            // 获取旧值
            const oldValue = target[key];
            // 设置新值
            const result = Reflect.set(target, key, value, receiver);
            // 如果值发生变化，触发更新
            if (oldValue !== value) {
                trigger(target, key);
            }
            return result;
        },
        has(target, key) {
            const result = Reflect.has(target, key);
            track(target, key);
            return result;
        },
        ownKeys(target) {
            // 对于 ownKeys 操作，我们使用一个特殊的 key 来追踪
            track(target, Symbol('ownKeys'));
            return Reflect.ownKeys(target);
        },
        deleteProperty(target, key) {
            const hadKey = Object.prototype.hasOwnProperty.call(target, key);
            const result = Reflect.deleteProperty(target, key);
            if (result && hadKey) {
                trigger(target, key);
            }
            return result;
        }
    });
    // 缓存响应式对象
    reactiveMap.set(target, proxy);
    return proxy;
}
/**
 * 判断一个对象是否为响应式对象
 */
function isReactive(value) {
    return !!(value && value[ReactiveFlags.IS_REACTIVE]);
}
/**
 * 获取响应式对象的原始对象
 */
function toRaw(observed) {
    const raw = observed && observed.__v_raw;
    return raw ? toRaw(raw) : observed;
}
/**
 * 创建只读的响应式对象
 */
function readonly(target) {
    if (!isObject$1(target)) {
        console.warn(`readonly() can only be called on objects, not ${typeof target}`);
        return target;
    }
    return new Proxy(target, {
        get(target, key, receiver) {
            // 处理响应式标识
            if (key === ReactiveFlags.IS_REACTIVE) {
                return true;
            }
            const result = Reflect.get(target, key, receiver);
            // 只读对象也需要依赖收集，但不会触发更新
            track(target, key);
            // 如果属性值是对象，递归创建只读对象
            if (isObject$1(result)) {
                return readonly(result);
            }
            return result;
        },
        set() {
            console.warn('Set operation on readonly object is not allowed');
            return true;
        },
        deleteProperty() {
            console.warn('Delete operation on readonly object is not allowed');
            return true;
        }
    });
}

/**
 * 判断一个值是否为对象
 */
function isObject(val) {
    return val !== null && typeof val === 'object';
}
/**
 * 转换值：如果是对象则使用 reactive，否则直接返回
 */
function convert(value) {
    return isObject(value) ? reactive(value) : value;
}
/**
 * Ref 类的实现
 */
class RefImpl {
    constructor(value) {
        this.__v_isRef = true;
        this._value = convert(value);
    }
    get value() {
        // 依赖收集
        track(this, 'value');
        return this._value;
    }
    set value(newValue) {
        // 如果值没有变化，不触发更新
        if (newValue === this._value) {
            return;
        }
        this._value = convert(newValue);
        // 触发更新
        trigger(this, 'value');
    }
}
/**
 * 创建一个 ref 对象
 */
function ref(value) {
    return new RefImpl(value);
}
/**
 * 判断一个值是否为 ref 对象
 */
function isRef(value) {
    return !!(value && value.__v_isRef);
}
/**
 * 获取 ref 的值，如果不是 ref 则直接返回
 */
function unref(ref) {
    return isRef(ref) ? ref.value : ref;
}
/**
 * 将 ref 或响应式对象转换为普通对象，其中每个属性都是指向原始对象相应属性的 ref
 */
function toRefs(object) {
    if (!isReactive(object)) {
        console.warn('toRefs() expects a reactive object but received a plain one.');
    }
    const result = {};
    for (const key in object) {
        result[key] = toRef(object, key);
    }
    return result;
}
/**
 * 为响应式对象的某个属性创建对应的 ref
 */
function toRef(object, key) {
    return {
        get value() {
            return object[key];
        },
        set value(newValue) {
            object[key] = newValue;
        },
        __v_isRef: true,
    };
}
/**
 * 自动解包 ref，在模板中使用时不需要 .value
 */
function proxyRefs(objectWithRefs) {
    return new Proxy(objectWithRefs, {
        get(target, key, receiver) {
            const result = Reflect.get(target, key, receiver);
            return isRef(result) ? result.value : result;
        },
        set(target, key, value, receiver) {
            const oldValue = target[key];
            if (isRef(oldValue) && !isRef(value)) {
                oldValue.value = value;
                return true;
            }
            else {
                return Reflect.set(target, key, value, receiver);
            }
        },
    });
}

/**
 * 计算属性的实现类
 */
class ComputedRefImpl {
    constructor(getter, _setter) {
        this._setter = _setter;
        this._dirty = true; // 标识是否需要重新计算
        this.__v_isRef = true;
        // 创建一个 effect，但设置为 lazy 模式，不会立即执行
        this._effect = new ReactiveEffect(getter, {
            lazy: true,
            // 当依赖发生变化时，标记为 dirty 并触发更新
            scheduler: () => {
                if (!this._dirty) {
                    this._dirty = true;
                    // 触发计算属性的更新
                    trigger(this, 'value');
                }
            }
        });
    }
    get value() {
        // 依赖收集：将当前计算属性作为依赖
        track(this, 'value');
        // 如果是 dirty 状态，重新计算值
        if (this._dirty) {
            this._value = this._effect.run();
            this._dirty = false;
        }
        return this._value;
    }
    set value(newValue) {
        if (this._setter) {
            this._setter(newValue);
        }
        else {
            console.warn('Computed property is readonly');
        }
    }
}
function computed(getterOrOptions) {
    let getter;
    let setter;
    // 处理参数：可以是函数或选项对象
    if (typeof getterOrOptions === 'function') {
        getter = getterOrOptions;
        setter = undefined;
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    return new ComputedRefImpl(getter, setter);
}
/**
 * 判断一个值是否为计算属性
 */
function isComputed(value) {
    return !!(value && value.__v_isRef && value._effect);
}

// 文本节点的 symbol 标识
const Text = Symbol('Text');
const Fragment = Symbol('Fragment');
/**
 * 创建 VNode
 */
function createVNode$1(type, props, children) {
    const vnode = {
        type,
        props: props || null,
        children: children || null,
        shapeFlag: getShapeFlag(type),
        el: null,
        key: props?.key || null,
        component: null,
    };
    // 根据 children 的类型设置 shapeFlag
    if (typeof children === 'string') {
        vnode.shapeFlag |= 4 /* ShapeFlags.TEXT_CHILDREN */;
    }
    else if (Array.isArray(children)) {
        vnode.shapeFlag |= 8 /* ShapeFlags.ARRAY_CHILDREN */;
    }
    return vnode;
}
/**
 * 根据 type 获取 shapeFlag
 */
function getShapeFlag(type) {
    if (typeof type === 'string') {
        return 1 /* ShapeFlags.ELEMENT */;
    }
    else if (typeof type === 'object') {
        return 2 /* ShapeFlags.STATEFUL_COMPONENT */;
    }
    return 0;
}
/**
 * 创建文本 VNode
 */
function createTextVNode(text) {
    return createVNode$1(Text, null, text);
}
/**
 * 创建元素 VNode 的便捷函数
 */
function h(type, propsOrChildren, children) {
    const l = arguments.length;
    if (l === 2) {
        if (typeof propsOrChildren === 'object' && !Array.isArray(propsOrChildren)) {
            // h('div', { id: 'app' })
            return createVNode$1(type, propsOrChildren);
        }
        else {
            // h('div', 'hello') 或 h('div', [child1, child2])
            return createVNode$1(type, null, propsOrChildren);
        }
    }
    else {
        // h('div', { id: 'app' }, 'hello') 或 h('div', { id: 'app' }, [child1, child2])
        return createVNode$1(type, propsOrChildren, children);
    }
}
/**
 * 判断两个 VNode 是否为同一类型
 */
function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
}

// 当前组件实例
let currentInstance = null;
/**
 * 获取当前组件实例
 */
function getCurrentInstance() {
    return currentInstance;
}
/**
 * 设置当前组件实例
 */
function setCurrentInstance(instance) {
    currentInstance = instance;
}
/**
 * 创建组件实例
 */
function createComponentInstance(vnode) {
    const type = vnode.type;
    const instance = {
        vnode,
        type,
        props: {},
        attrs: {},
        slots: {},
        setupState: {},
        ctx: {},
        render: null,
        subTree: null,
        isMounted: false,
        update: null,
        emit: () => { },
    };
    // 设置 emit 函数
    instance.emit = emit.bind(null, instance);
    // 设置上下文
    instance.ctx = { _: instance };
    return instance;
}
/**
 * 设置组件
 */
function setupComponent(instance) {
    // 初始化 props 和 slots
    initProps(instance, instance.vnode.props);
    initSlots(instance, instance.vnode.children);
    // 设置有状态组件
    setupStatefulComponent(instance);
}
/**
 * 设置有状态组件
 */
function setupStatefulComponent(instance) {
    const Component = instance.type;
    // 创建渲染上下文代理
    instance.ctx = createRenderContext(instance);
    // 调用 setup 函数
    if (Component.setup) {
        setCurrentInstance(instance);
        const setupResult = Component.setup(instance.props, {
            emit: instance.emit,
            slots: instance.slots,
            attrs: instance.attrs,
        });
        setCurrentInstance(null);
        handleSetupResult(instance, setupResult);
    }
    else {
        finishComponentSetup(instance);
    }
}
/**
 * 处理 setup 函数的返回结果
 */
function handleSetupResult(instance, setupResult) {
    if (typeof setupResult === 'function') {
        // setup 返回渲染函数
        instance.render = setupResult;
    }
    else if (setupResult && typeof setupResult === 'object') {
        // setup 返回状态对象
        instance.setupState = proxyRefs(setupResult);
    }
    finishComponentSetup(instance);
}
/**
 * 完成组件设置
 */
function finishComponentSetup(instance) {
    const Component = instance.type;
    // 如果没有 render 函数，使用组件的 render 选项
    if (!instance.render) {
        instance.render = Component.render;
    }
    // 确保有 render 函数
    if (!instance.render) {
        console.warn('Component is missing render function.');
    }
}
/**
 * 创建渲染上下文代理
 */
function createRenderContext(instance) {
    return new Proxy(instance.ctx, {
        get(_target, key) {
            const { setupState, props } = instance;
            // 只处理字符串和数字键
            if (typeof key !== 'string' && typeof key !== 'number') {
                return undefined;
            }
            // 优先从 setupState 中获取
            if (setupState && key in setupState) {
                return setupState[key];
            }
            // 然后从 props 中获取
            else if (props && key in props) {
                return props[key];
            }
            // 最后从实例中获取
            else if (key in instance) {
                return instance[key];
            }
        },
        set(_target, key, value) {
            const { setupState } = instance;
            // 只处理字符串和数字键
            if (typeof key !== 'string' && typeof key !== 'number') {
                return false;
            }
            if (setupState && key in setupState) {
                setupState[key] = value;
                return true;
            }
            return false;
        },
    });
}
/**
 * 初始化 props
 */
function initProps(instance, rawProps) {
    const props = {};
    const attrs = {};
    if (rawProps) {
        for (const key in rawProps) {
            // 简化处理：所有属性都作为 props
            props[key] = rawProps[key];
        }
    }
    instance.props = props;
    instance.attrs = attrs;
}
/**
 * 初始化插槽
 */
function initSlots(instance, children) {
    // 简化处理：将 children 作为默认插槽
    if (children) {
        instance.slots = {
            default: () => children,
        };
    }
}
/**
 * emit 事件
 */
function emit(instance, event, ...args) {
    const { props } = instance;
    // 将事件名转换为 props 中的处理函数名
    const handlerName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
    const handler = props[handlerName];
    if (handler && typeof handler === 'function') {
        handler(...args);
    }
}

/**
 * 注册生命周期钩子的通用函数
 */
function injectHook(type, hook, target) {
    const instance = target || getCurrentInstance();
    if (instance) {
        const hooks = instance[type] || (instance[type] = []);
        // 包装钩子函数，确保在正确的实例上下文中执行
        const wrappedHook = () => {
            // 这里可以添加错误处理
            try {
                hook();
            }
            catch (err) {
                console.error(`Error in ${type} hook:`, err);
            }
        };
        hooks.push(wrappedHook);
    }
    else {
        console.warn(`${type} hook can only be called during setup() or in a component context.`);
    }
}
/**
 * 调用生命周期钩子
 */
function callHook(instance, type) {
    const hooks = instance[type];
    if (hooks) {
        hooks.forEach((hook) => hook());
    }
}
// 导出各种生命周期钩子 API
/**
 * onBeforeMount 钩子
 */
function onBeforeMount(hook, target) {
    injectHook("bm" /* LifecycleHooks.BEFORE_MOUNT */, hook, target);
}
/**
 * onMounted 钩子
 */
function onMounted(hook, target) {
    injectHook("m" /* LifecycleHooks.MOUNTED */, hook, target);
}
/**
 * onBeforeUpdate 钩子
 */
function onBeforeUpdate(hook, target) {
    injectHook("bu" /* LifecycleHooks.BEFORE_UPDATE */, hook, target);
}
/**
 * onUpdated 钩子
 */
function onUpdated(hook, target) {
    injectHook("u" /* LifecycleHooks.UPDATED */, hook, target);
}
/**
 * onBeforeUnmount 钩子
 */
function onBeforeUnmount(hook, target) {
    injectHook("bum" /* LifecycleHooks.BEFORE_UNMOUNT */, hook, target);
}
/**
 * onUnmounted 钩子
 */
function onUnmounted(hook, target) {
    injectHook("um" /* LifecycleHooks.UNMOUNTED */, hook, target);
}

/**
 * 创建渲染器
 */
function createRenderer(options) {
    const { createElement, createText, setText, setElementText, insert, remove, patchProp } = options;
    /**
     * 渲染函数
     */
    function render(vnode, container) {
        if (vnode == null) {
            // 卸载
            if (container._vnode) {
                unmount(container._vnode);
            }
        }
        else {
            // 挂载或更新
            patch(container._vnode || null, vnode, container);
        }
        container._vnode = vnode;
    }
    /**
     * 核心 patch 函数：比较新旧 VNode 并更新 DOM
     */
    function patch(n1, // 旧 VNode
    n2, // 新 VNode
    container, anchor) {
        // 如果新旧 VNode 类型不同，直接卸载旧节点
        if (n1 && !isSameVNodeType(n1, n2)) {
            unmount(n1);
            n1 = null;
        }
        const { type, shapeFlag } = n2;
        switch (type) {
            case Text:
                processText(n1, n2, container, anchor);
                break;
            case Fragment:
                processFragment(n1, n2, container, anchor);
                break;
            default:
                if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(n1, n2, container, anchor);
                }
                else if (shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    processComponent(n1, n2, container, anchor);
                }
        }
    }
    /**
     * 处理文本节点
     */
    function processText(n1, n2, container, anchor) {
        if (n1 == null) {
            // 挂载文本节点
            n2.el = createText(n2.children);
            insert(n2.el, container, anchor);
        }
        else {
            // 更新文本节点
            const el = (n2.el = n1.el);
            if (n2.children !== n1.children) {
                setText(el, n2.children);
            }
        }
    }
    /**
     * 处理 Fragment 节点
     */
    function processFragment(n1, n2, container, anchor) {
        if (n1 == null) {
            // 挂载 Fragment 的子节点
            mountChildren(n2.children, container, anchor);
        }
        else {
            // 更新 Fragment 的子节点
            patchChildren(n1, n2, container, anchor);
        }
    }
    /**
     * 处理元素节点
     */
    function processElement(n1, n2, container, anchor) {
        if (n1 == null) {
            // 挂载元素
            mountElement(n2, container, anchor);
        }
        else {
            // 更新元素
            patchElement(n1, n2);
        }
    }
    /**
     * 挂载元素节点
     */
    function mountElement(vnode, container, anchor) {
        const el = (vnode.el = createElement(vnode.type));
        // 处理子节点
        const { children, shapeFlag } = vnode;
        if (shapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            setElementText(el, children);
        }
        else if (shapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
            mountChildren(children, el);
        }
        // 处理 props
        if (vnode.props) {
            for (const key in vnode.props) {
                patchProp(el, key, null, vnode.props[key]);
            }
        }
        insert(el, container, anchor);
    }
    /**
     * 更新元素节点
     */
    function patchElement(n1, n2) {
        const el = (n2.el = n1.el);
        // 确保是 Element 类型，不是 Text 节点
        if (el instanceof Element) {
            // 更新 props
            const oldProps = n1.props || {};
            const newProps = n2.props || {};
            patchProps(el, oldProps, newProps);
            // 更新子节点
            patchChildren(n1, n2, el);
        }
    }
    /**
     * 更新属性
     */
    function patchProps(el, oldProps, newProps) {
        // 更新新属性
        for (const key in newProps) {
            const prev = oldProps[key];
            const next = newProps[key];
            if (prev !== next) {
                patchProp(el, key, prev, next);
            }
        }
        // 删除旧属性
        for (const key in oldProps) {
            if (!(key in newProps)) {
                patchProp(el, key, oldProps[key], null);
            }
        }
    }
    /**
     * 挂载子节点数组
     */
    function mountChildren(children, container, anchor) {
        for (let i = 0; i < children.length; i++) {
            patch(null, children[i], container, anchor);
        }
    }
    /**
     * 更新子节点
     */
    function patchChildren(n1, n2, container, anchor) {
        const c1 = n1.children;
        const c2 = n2.children;
        const prevShapeFlag = n1.shapeFlag;
        const shapeFlag = n2.shapeFlag;
        // 新子节点是文本
        if (shapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            // 旧子节点是数组，需要卸载
            if (prevShapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
                unmountChildren(c1);
            }
            // 更新文本内容
            if (c2 !== c1) {
                setElementText(container, c2);
            }
        }
        else {
            // 新子节点是数组或空
            if (prevShapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
                if (shapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
                    // 新旧都是数组，执行 diff
                    patchKeyedChildren(c1, c2, container, anchor);
                }
                else {
                    // 新子节点为空，卸载旧子节点
                    unmountChildren(c1);
                }
            }
            else {
                // 旧子节点是文本或空
                if (prevShapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
                    setElementText(container, '');
                }
                // 挂载新子节点
                if (shapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
                    mountChildren(c2, container, anchor);
                }
            }
        }
    }
    /**
     * 处理组件
     */
    function processComponent(n1, n2, container, anchor) {
        if (n1 == null) {
            // 挂载组件
            mountComponent(n2, container, anchor);
        }
        else {
            // 更新组件
            updateComponent(n1, n2);
        }
    }
    /**
     * 挂载组件
     */
    function mountComponent(vnode, container, anchor) {
        // 创建组件实例
        const instance = createComponentInstance(vnode);
        vnode.component = instance;
        // 设置组件
        setupComponent(instance);
        // 设置渲染 effect
        setupRenderEffect(instance, vnode, container, anchor);
    }
    /**
     * 更新组件
     */
    function updateComponent(n1, n2) {
        const instance = (n2.component = n1.component);
        // 更新组件的 vnode 引用
        instance.vnode = n2;
        // 更新 props
        initProps(instance, n2.props);
        // 触发重新渲染
        instance.update();
    }
    /**
     * 设置渲染 effect
     */
    function setupRenderEffect(instance, vnode, container, anchor) {
        const componentUpdateFn = () => {
            if (!instance.isMounted) {
                // 调用 beforeMount 钩子
                callHook(instance, "bm" /* LifecycleHooks.BEFORE_MOUNT */);
                // 挂载 - 绑定正确的 this 上下文
                const subTree = instance.render.call(instance.ctx);
                instance.subTree = subTree;
                patch(null, subTree, container, anchor);
                vnode.el = subTree.el;
                instance.isMounted = true;
                // 调用 mounted 钩子
                callHook(instance, "m" /* LifecycleHooks.MOUNTED */);
            }
            else {
                // 调用 beforeUpdate 钩子
                callHook(instance, "bu" /* LifecycleHooks.BEFORE_UPDATE */);
                // 更新 - 绑定正确的 this 上下文
                const nextTree = instance.render.call(instance.ctx);
                const prevTree = instance.subTree;
                instance.subTree = nextTree;
                patch(prevTree, nextTree, container, anchor);
                vnode.el = nextTree.el;
                // 调用 updated 钩子
                callHook(instance, "u" /* LifecycleHooks.UPDATED */);
            }
        };
        // 创建响应式 effect
        const update = (instance.update = effect(componentUpdateFn, {
            scheduler() {
                // 异步更新队列（简化处理）
                queueJob(update);
            },
        }));
    }
    /**
     * 卸载节点
     */
    function unmount(vnode) {
        if (vnode.shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
            // 卸载组件
            unmountComponent(vnode);
        }
        else {
            // 卸载元素
            remove(vnode.el);
        }
    }
    /**
     * 卸载子节点数组
     */
    function unmountChildren(children) {
        for (let i = 0; i < children.length; i++) {
            unmount(children[i]);
        }
    }
    /**
     * 卸载组件
     */
    function unmountComponent(vnode) {
        const instance = vnode.component;
        if (instance) {
            // 调用 beforeUnmount 钩子
            callHook(instance, "bum" /* LifecycleHooks.BEFORE_UNMOUNT */);
            unmount(instance.subTree);
            // 调用 unmounted 钩子
            callHook(instance, "um" /* LifecycleHooks.UNMOUNTED */);
        }
    }
    /**
     * 简化版的 diff 算法：处理有 key 的子节点数组
     */
    function patchKeyedChildren(c1, c2, container, anchor) {
        let i = 0;
        const l2 = c2.length;
        let e1 = c1.length - 1;
        let e2 = l2 - 1;
        // 1. 从头开始比较相同的节点
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = c2[i];
            if (isSameVNodeType(n1, n2)) {
                patch(n1, n2, container, anchor);
            }
            else {
                break;
            }
            i++;
        }
        // 2. 从尾开始比较相同的节点
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSameVNodeType(n1, n2)) {
                patch(n1, n2, container, anchor);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 3. 如果旧节点遍历完，新节点还有剩余，则挂载新节点
        if (i > e1) {
            if (i <= e2) {
                const nextPos = e2 + 1;
                const anchor = nextPos < l2 ? c2[nextPos].el : null;
                while (i <= e2) {
                    patch(null, c2[i], container, anchor);
                    i++;
                }
            }
        }
        // 4. 如果新节点遍历完，旧节点还有剩余，则卸载旧节点
        else if (i > e2) {
            while (i <= e1) {
                unmount(c1[i]);
                i++;
            }
        }
        // 5. 处理中间的复杂情况（简化处理）
        else {
            // 简化处理：直接卸载旧节点，挂载新节点
            for (let j = i; j <= e1; j++) {
                unmount(c1[j]);
            }
            for (let j = i; j <= e2; j++) {
                patch(null, c2[j], container, anchor);
            }
        }
    }
    return {
        render,
    };
}
// 简化的任务队列
const queue = [];
let isFlushPending = false;
function queueJob(job) {
    if (!queue.includes(job)) {
        queue.push(job);
    }
    queueFlush();
}
function queueFlush() {
    if (!isFlushPending) {
        isFlushPending = true;
        Promise.resolve().then(flushJobs);
    }
}
function flushJobs() {
    isFlushPending = false;
    queue.forEach((job) => job());
    queue.length = 0;
}

/**
 * DOM 操作的具体实现
 */
const rendererOptions = {
    // 创建元素
    createElement(tag) {
        return document.createElement(tag);
    },
    // 创建文本节点
    createText(text) {
        return document.createTextNode(text);
    },
    // 设置文本节点内容
    setText(node, text) {
        node.nodeValue = text;
    },
    // 设置元素文本内容
    setElementText(el, text) {
        el.textContent = text;
    },
    // 插入节点
    insert(child, parent, anchor) {
        parent.insertBefore(child, anchor || null);
    },
    // 移除节点
    remove(child) {
        const parent = child.parentNode;
        if (parent) {
            parent.removeChild(child);
        }
    },
    // 更新属性
    patchProp(el, key, prevValue, nextValue) {
        if (key.startsWith('on')) {
            // 事件处理
            const eventName = key.slice(2).toLowerCase();
            if (prevValue) {
                el.removeEventListener(eventName, prevValue);
            }
            if (nextValue) {
                el.addEventListener(eventName, nextValue);
            }
        }
        else if (key === 'class') {
            // class 属性
            el.className = nextValue || '';
        }
        else if (key === 'style') {
            // style 属性
            if (typeof nextValue === 'string') {
                el.style.cssText = nextValue;
            }
            else if (typeof nextValue === 'object') {
                const style = el.style;
                for (const styleName in nextValue) {
                    style[styleName] = nextValue[styleName];
                }
                // 清理旧样式
                if (prevValue && typeof prevValue === 'object') {
                    for (const styleName in prevValue) {
                        if (!(styleName in nextValue)) {
                            style[styleName] = '';
                        }
                    }
                }
            }
        }
        else {
            // 普通属性
            if (nextValue == null || nextValue === false) {
                el.removeAttribute(key);
            }
            else {
                el.setAttribute(key, nextValue);
            }
        }
    }
};
// 创建 DOM 渲染器
const renderer = createRenderer(rendererOptions);
/**
 * 渲染函数
 */
function render(vnode, container) {
    renderer.render(vnode, container);
}
/**
 * 创建应用实例
 */
function createApp(rootComponent) {
    return {
        mount(rootContainer) {
            const container = typeof rootContainer === 'string'
                ? document.querySelector(rootContainer)
                : rootContainer;
            // 创建根组件的 VNode
            const vnode = createVNode(rootComponent);
            // 渲染到容器
            render(vnode, container);
        }
    };
}
// 简化的 createVNode 实现（用于 createApp）
function createVNode(component) {
    return {
        type: component,
        props: null,
        children: null,
        shapeFlag: 2, // STATEFUL_COMPONENT
        el: null,
        key: null,
        component: null
    };
}

// 导出响应式系统
// 版本信息
const version = '1.0.0';

export { Fragment, ReactiveEffect, Text, callHook, computed, createApp, createComponentInstance, createRenderer, createTextVNode, createVNode$1 as createVNode, effect, getCurrentInstance, h, isComputed, isReactive, isRef, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onMounted, onUnmounted, onUpdated, proxyRefs, reactive, readonly, ref, render, setCurrentInstance, setupComponent, stop, toRaw, toRef, toRefs, unref, version };
