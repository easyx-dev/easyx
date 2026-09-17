import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rslib/core';

/**
 * 构建配置说明
 *
 * - 样式走包内 SCSS + CSS 变量，`injectStyles` 编译后内联进 JS，宿主零配置
 * - react / react-dom 声明为 peerDependencies，构建时自动外置，避免宿主出现多份 React 实例
 * - UI 层自研（无 UI 库）：运行时依赖仅 @floating-ui/dom（浮层定位）、marked（对话 markdown）
 *   与 @codemirror/* + @lezer/highlight（代码面板），后者按 dependencies 外置，随包自动安装
 * - 代码面板按需加载（见 src/components/EditorPanel.tsx 的懒加载边界），
 *   CodeMirror 与语法解析器只在打开「编辑器」时进入宿主产物
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
