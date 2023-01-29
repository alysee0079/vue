/* @flow */

import { parse } from "./parser/index";
import { optimize } from "./optimizer";
import { generate } from "./codegen/index";
import { createCompilerCreator } from "./create-compiler";

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile(
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 1. 把 template 模版转换成模板 AST
  const ast = parse(template.trim(), options);
  if (options.optimize !== false) {
    // 2. 优化抽象语法树
    optimize(ast, options);
  }
  // 3. 把抽象语法树生成字符串形式的 js 代码
  const code = generate(ast, options);
  return {
    ast,
    render: code.render, // 字符串形式 js 代码
    staticRenderFns: code.staticRenderFns,
  };
});
