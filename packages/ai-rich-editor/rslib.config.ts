import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rslib/core';

/**
 * 构建配置说明
 *
 * - 样式走包内 SCSS + CSS 变量，`injectStyles` 编译后内联进 JS，宿主零配置
 * - react / react-dom / monaco-editor 声明为 peerDependencies，
 *   构建时自动外置，避免宿主出现多份 React 实例
 * - UI 层自研（无 UI 库），依赖仅 @floating-ui/dom（浮层定位）、marked（对话 markdown）
 * - Monaco 只取 editor.api 与三种语言的 Monarch 词法高亮（见 src/components/monaco-setup.ts），
 *   不打语言服务与 worker
 */
export default defineConfig({
  plugins: [pluginReact(), pluginSass()],
  lib: [
    {
      format: 'esm',
      syntax: 'es2021',
      dts: true,
    },
  ],
  output: {
    target: 'web',
    injectStyles: true,
  },
});
