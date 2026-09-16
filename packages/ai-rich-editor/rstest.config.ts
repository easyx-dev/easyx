import { withRslibConfig } from '@rstest/adapter-rslib';
import { defineConfig } from '@rstest/core';

/**
 * 测试配置：默认 node 环境（提取/提示词/作用域化等纯逻辑）
 * 需要 DOM 的组件测试在文件首行用 `// @rstest-environment jsdom` 单独声明
 */
export default defineConfig({
  extends: withRslibConfig(),
  testEnvironment: 'node',
});
