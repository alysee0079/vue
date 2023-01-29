/* @flow */

import Vue from "core/index";
import config from "core/config";
import { extend, noop } from "shared/util";
import { mountComponent } from "core/instance/lifecycle";
import { devtools, inBrowser } from "core/util/index";

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement,
} from "web/util/index";

import { patch } from "./patch";
import platformDirectives from "./directives/index";
import platformComponents from "./components/index";
// 注入与平台相关
// install platform specific utils
Vue.config.mustUseProp = mustUseProp;
Vue.config.isReservedTag = isReservedTag;
Vue.config.isReservedAttr = isReservedAttr;
Vue.config.getTagNamespace = getTagNamespace;
Vue.config.isUnknownElement = isUnknownElement;

// install platform runtime directives & components
// 注册全局指令 v-model v-show
extend(Vue.options.directives, platformDirectives);
extend(Vue.options.components, platformComponents);

// install platform patch function
Vue.prototype.__patch__ = inBrowser ? patch : noop;

// public mount method
// 定义公共 $mount 方法, 不区分平台(只包含运行时版本)
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 运行时也要获取 el
  el = el && inBrowser ? query(el) : undefined;
  // 挂载组件
  return mountComponent(this, el, hydrating);
};

// devtools global hook
/* istanbul ignore next */
if (inBrowser) {
  setTimeout(() => {
    if (config.devtools) {
      if (devtools) {
        devtools.emit("init", Vue);
      } else if (
        process.env.NODE_ENV !== "production" &&
        process.env.NODE_ENV !== "test"
      ) {
        console[console.info ? "info" : "log"](
          "Download the Vue Devtools extension for a better development experience:\n" +
            "https://github.com/vuejs/vue-devtools"
        );
      }
    }
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test" &&
      config.productionTip !== false &&
      typeof console !== "undefined"
    ) {
      console[console.info ? "info" : "log"](
        `You are running Vue in development mode.\n` +
          `Make sure to turn on production mode when deploying for production.\n` +
          `See more tips at https://vuejs.org/guide/deployment.html`
      );
    }
  }, 0);
}

export default Vue;
