/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop,
} from "../util/index";

import { traverse } from "./traverse";
import { queueWatcher } from "./scheduler";
import Dep, { pushTarget, popTarget } from "./dep";

import type { SimpleSet } from "../util/index";

let uid = 0;

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor(
    vm: Component,
    expOrFn: string | Function, // 更新函数或者表达式, 如果是渲染 watcher: updateComponent; computed 对应 get函数, watch 对应监听目标(字符串, 函数)
    cb: Function, // 回调函数, 例如 watch 的回调函数
    options?: ?Object, // 配置对象, 在使用 watch 或者渲染组件时用到
    isRenderWatcher?: boolean // 是否是渲染 watcher, 只有组件更新时渲染函数
  ) {
    this.vm = vm;
    // 渲染 watcher(组件更新)
    if (isRenderWatcher) {
      vm._watcher = this;
    }
    // _watchers 储存所有 watcher, 渲染 watcher, 计算属性, 侦听器
    vm._watchers.push(this);
    // options
    if (options) {
      this.deep = !!options.deep; // watch 是否深度监听
      this.user = !!options.user; // 在使用 watch 时标记是用户 watcher
      this.lazy = !!options.lazy; // 是否懒加载, 计算属性(true)
      this.sync = !!options.sync;
      this.before = options.before; // 渲染组件 beforeUpdate
    } else {
      this.deep = this.user = this.lazy = this.sync = false;
    }
    this.cb = cb;
    this.id = ++uid; // uid for batching
    this.active = true;
    this.dirty = this.lazy; // for lazy watchers
    this.deps = []; // 储存之前的 dep
    this.newDeps = []; // 储存本次新增的 dep
    this.depIds = new Set(); // 储存之前的 dep id
    this.newDepIds = new Set(); // 储存本次新增的 dep id
    this.expression =
      process.env.NODE_ENV !== "production" ? expOrFn.toString() : "";
    // parse expression for getter
    // expOrFn 可能是函数或者字符串, updateComponent 是函数
    if (typeof expOrFn === "function") {
      this.getter = expOrFn;
    } else {
      // expOrFn 是字符串的时候, 例如: watch: { 'person.name': function() {} }
      // parsePath('person.name') 返回一个函数获取 'person.name' 的值
      this.getter = parsePath(expOrFn);
      if (!this.getter) {
        this.getter = noop;
        process.env.NODE_ENV !== "production" &&
          warn(
            `Failed watching path: "${expOrFn}" ` +
              "Watcher only accepts simple dot-delimited paths. " +
              "For full control, use a function instead.",
            vm
          );
      }
    }
    this.value = this.lazy ? undefined : this.get(); // computed 不初始化, watch 初始化
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get() {
    pushTarget(this);
    let value;
    const vm = this.vm;
    try {
      // getter: updateComponent, watch: 获取属性, computed: 对应 get 函数
      value = this.getter.call(vm, vm);
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`);
      } else {
        throw e;
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 触发每一个子属性, 以达到深度监听
      if (this.deep) {
        traverse(value);
      }
      popTarget();
      this.cleanupDeps();
    }
    return value;
  }

  /**
   * Add a dependency to this directive.
   */
  addDep(dep: Dep) {
    const id = dep.id;
    // 如果本次 dep id 列表没有当前的 dep, 才添加本次 dep 列表
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id);
      this.newDeps.push(dep);
      // 如果储存 dep id列表没有当前的 dep, 才添加储存列表
      if (!this.depIds.has(id)) {
        dep.addSub(this);
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  // 清理本次没有使用到的 dep 的 watcher
  cleanupDeps() {
    let i = this.deps.length;
    while (i--) {
      const dep = this.deps[i];
      // 如果之前的 dep 中没有本次新增的 dep, 将其删除, 说明本次更新没有使用到
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this);
      }
    }
    let tmp = this.depIds;
    // 更新 dep id 为最新的
    this.depIds = this.newDepIds;
    // 清除最新的 dep id
    this.newDepIds = tmp;
    this.newDepIds.clear();
    tmp = this.deps;
    // 更新 dep 为最新的
    this.deps = this.newDeps;
    // 清除最新的 dep
    this.newDeps = tmp;
    this.newDeps.length = 0;
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // 触发更新逻辑
  update() {
    /* istanbul ignore else */
    // computed
    if (this.lazy) {
      this.dirty = true;
    } else if (this.sync) {
      this.run();
    } else {
      // 异步更新(updateComponent, watch)
      queueWatcher(this);
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run() {
    // watcher 对象是够是存活的
    if (this.active) {
      const value = this.get(); // 如果是渲染 watcher 执行 updateComponent, 返回 undefined, 如果是计算属性, 侦听器, 返回值
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value;
        this.value = value;
        // 是否是侦听器 watch
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`;
          // 调用 watch 回调
          invokeWithErrorHandling(
            this.cb,
            this.vm,
            [value, oldValue],
            this.vm,
            info
          );
        } else {
          this.cb.call(this.vm, value, oldValue);
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate() {
    this.value = this.get();
    this.dirty = false;
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend() {
    let i = this.deps.length;
    while (i--) {
      this.deps[i].depend();
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown() {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this);
      }
      let i = this.deps.length;
      while (i--) {
        this.deps[i].removeSub(this);
      }
      this.active = false;
    }
  }
}
