/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from "../util/index";

const arrayProto = Array.prototype;
// 继承数组的原型
export const arrayMethods = Object.create(arrayProto);

// 一下方法都可以直接修改数组元素, 改变数组长度或位置
const methodsToPatch = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
];

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 保存数组原始方法
  const original = arrayProto[method];
  // 调用 defineProperty 重新定义数组的方法
  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args);
    // 获取数组对象的 ob 对象(观察对象)
    // this 指代当前数组, new Observer 时, 已将 Observer 实例挂载到了 this.__ob__ 上
    const ob = this.__ob__;
    let inserted;
    switch (method) {
      case "push":
      case "unshift":
        inserted = args;
        break;
      case "splice":
        inserted = args.slice(2);
        break;
    }
    // 如果是新增的元素, 对元素做响应式处理
    if (inserted) ob.observeArray(inserted);
    // notify change
    // 触发当前属性对应的依赖更新
    ob.dep.notify();
    return result;
  });
});
