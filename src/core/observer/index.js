/* @flow */

import Dep from "./dep";
import VNode from "../vdom/vnode";
import { arrayMethods } from "./array";
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
} from "../util/index";

const arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true;

export function toggleObserving(value: boolean) {
  shouldObserve = value;
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  // 观测对象
  value: any;
  // 依赖对象
  dep: Dep;
  // 实例计数器
  vmCount: number; // number of vms that have this object as root $data

  constructor(value: any) {
    this.value = value;
    // 当前属性的依赖对象
    this.dep = new Dep();
    // 初始化实例的 vmCount 为0
    this.vmCount = 0;
    // 将实例挂载到观察对象的 __ob__ 属性, 此属性不会被枚举(enumerable: false)
    def(value, "__ob__", this);
    // 数组的响应式处理
    if (Array.isArray(value)) {
      // 为数组添加拦截器, 添加新元素时转换成响应式, 更改数组内容时触发更新
      if (hasProto) {
        // 是否支持 __poro__ 原型对象
        protoAugment(value, arrayMethods);
      } else {
        copyAugment(value, arrayMethods, arrayKeys);
      }
      // 将数组中的对象转成响应式
      this.observeArray(value);
    } else {
      // 遍历对象的属性, 转成 setter/getter
      this.walk(value);
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  // 对象响应式处理
  walk(obj: Object) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      // 对每一个属性进行响应式定义
      defineReactive(obj, keys[i]);
    }
  }

  /**
   * Observe a list of Array items.
   */
  // 数组响应式处理
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i]);
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  // 覆盖原型对象
  target.__proto__ = src;
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
  // value 是否是对象
  if (!isObject(value) || value instanceof VNode) {
    return;
  }
  let ob: Observer | void;
  //如果 value 有 __ob__（说明此对象已经是响应式的）, 直接获取并返回,
  if (hasOwn(value, "__ob__") && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    // 数组或对象
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value);
  }
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 */
// 对每一个属性进行响应式属性, setter, getter
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean // 是否递归观察对象
) {
  // 依赖对象实例, 当前属性所依赖的 watcher
  const dep = new Dep();
  // 获取 obj.key 的属性描述符对象
  const property = Object.getOwnPropertyDescriptor(obj, key);
  if (property && property.configurable === false) {
    return;
  }

  // cater for pre-defined getter/setters
  // 提供预定义的存取器函数
  const getter = property && property.get;
  const setter = property && property.set;
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key];
  }
  // 如果属性的值也是对象, 递归将值的属性都转成 setter/getter, 返回子观察对象
  let childOb = !shallow && observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true, // 可枚举
    configurable: true, // 可配置
    // get 会在 mountComponent => new Watcher 时初始化, 调用 updateComponent
    get: function reactiveGetter() {
      // 获取要返回的属性值
      const value = getter ? getter.call(obj) : val;
      // 为当前属性添加依赖(watcher 对象), 当前属性的值改变时, 回去触发更新
      if (Dep.target) {
        dep.depend(); // 将 dep 添加中 watcher.newDeps, 将 watcher 添加到 dep.subs
        // 如果子属性也需要观察, 建立子对象的依赖关系
        if (childOb) {
          // 为子属性也收集当前依赖对象,  即子属性改变时, 也会触发当前依赖对象的改变
          childOb.dep.depend();
          // 如果属性值(子属性)是数组, 则特殊处理收集数组对象依赖
          if (Array.isArray(value)) {
            dependArray(value);
          }
        }
      }
      return value;
    },
    set: function reactiveSetter(newVal) {
      // 如果用户设置了 getter, 则 value 等于 getter 的返回值
      // 否则直接赋予属性值
      const value = getter ? getter.call(obj) : val;
      /* eslint-disable no-self-compare */
      // 如果新值等于旧值或者新值旧值为NaN则不执行
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return;
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== "production" && customSetter) {
        customSetter();
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return;
      // 如果用户预定义了 setter, 则调用, 否则直接更新新值
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      // 如果新值是对象, 观察子对象并返回子的 observer 对象
      childOb = !shallow && observe(newVal);
      // 派发更新(发布更改通知)
      dep.notify();
    },
  });
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  if (
    process.env.NODE_ENV !== "production" &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  // 如果是数组
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key);
    // 调用 splice 方法, 已经处理过了, 获取触发响应式处理
    target.splice(key, 1, val);
    return val;
  }
  // 如果 key 已经存在于 target 直接赋值即可
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val;
  }
  // 获取 target 的 observer 对象
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid adding reactive properties to a Vue instance or its root $data " +
          "at runtime - declare it upfront in the data option."
      );
    return val;
  }
  // 如果 ob 不存在, target 不是响应式对象, 直接返回
  if (!ob) {
    target[key] = val;
    return val;
  }
  // 把 key 设置响应式, ob.value => target
  defineReactive(ob.value, key, val);
  // 发送通知更新
  ob.dep.notify();
  return val;
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array<any> | Object, key: any) {
  if (
    process.env.NODE_ENV !== "production" &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1);
    return;
  }
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid deleting properties on a Vue instance or its root $data " +
          "- just set it to null."
      );
    return;
  }
  if (!hasOwn(target, key)) {
    return;
  }
  delete target[key];
  if (!ob) {
    return;
  }
  ob.dep.notify();
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i];
    e && e.__ob__ && e.__ob__.dep.depend();
    if (Array.isArray(e)) {
      dependArray(e);
    }
  }
}
