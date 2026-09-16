import { withRslibConfig } from '@rstest/adapter-rslib';
import { defineConfig } from '@rstest/core';

/**
 * 测试配置：默认 node 环境（纯逻辑、引擎编排、真实 wasm 实测均在 node 下跑）
 * 需要 DOM 的组件测试在文件首行用 `// @rstest-environment jsdom` 单独声明
 */
export default defineConfig({
  extends: withRslibConfig(),
  testEnvironment: 'node',
});
