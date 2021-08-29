/* @flow */

import type Watcher from "./watcher";
import { remove } from "../util/index";
import config from "../config";

let uid = 0;

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor() {
    this.id = uid++;
    this.subs = []; // 储存所有的依赖对象(watcher)
  }

  addSub(sub: Watcher) {
    // 将依赖对象(watcher)添加到依赖数组
    this.subs.push(sub);
  }

  removeSub(sub: Watcher) {
    remove(this.subs, sub);
  }

  depend() {
    if (Dep.target) {
      // watcher.addDep
      Dep.target.addDep(this);
    }
  }

  notify() {
    // stabilize the subscriber list first
    const subs = this.subs.slice();
    if (process.env.NODE_ENV !== "production" && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id);
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update();
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// Dep.target 用来存放目前正在使用的 watcher
// 全局唯一, 并且一次也只能有一个 watcher 被使用
Dep.target = null;
const targetStack = [];

export function pushTarget(target: ?Watcher) {
  // 将当前 watcher 入栈, 每个组件都对应一个 watcher, 如果有子组件, 会先处理子组件, 将父组件的 watcher 储存；
  targetStack.push(target);
  // 将当前 watcher 赋值给 Dep.target
  Dep.target = target;
}

export function popTarget() {
  targetStack.pop();
  Dep.target = targetStack[targetStack.length - 1];
}
