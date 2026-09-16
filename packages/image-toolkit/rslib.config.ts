import { createRequire } from 'node:module';
import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { defineConfig } from '@rslib/core';

const require = createRequire(import.meta.url);

/** 上游 wasm 资源：走包 exports 解析，不依赖其内部目录结构 */
const magickWasmFile = require.resolve('@imagemagick/magick-wasm/magick.wasm');

/** 上游包根：NOTICE 不在 exports 中，只能按文件系统定位（主入口位于根下一级） */
const magickWasmRoot = path.resolve(
  path.dirname(require.resolve('@imagemagick/magick-wasm')),
  '..',
);

/**
 * 构建配置说明
 *
 * 产物形态（宿主打包器需要能解析运行时资源，这是设计的核心约束）：
 * - 三个入口：`.`（同构纯逻辑）、`./ui`（浏览器侧引擎与 UI）、`ui/engine/worker`（引擎 Worker）
 * - Worker 与 wasm 都以「静态相对 new URL(..., import.meta.url)」出现在产物中，
 *   由宿主打包器解析并把资源复制进其产物；因此本包构建期必须关闭这两个表达式的解析
 *   （见 rules 中的 parser.url），否则会被改写成依赖 rslib 运行时 publicPath 的动态表达式，
 *   宿主无法静态分析，产物中的 Worker 与 wasm 就带不过去
 * - wasm 二进制与第三方许可声明（THIRD-PARTY-NOTICES）经 output.copy 落到 dist/，
 *   前者与引用它的模块同目录
 * - Worker 与各入口会共享若干产物内 chunk，宿主打包器会沿静态 import 一并纳入其产物
 * - `@imagemagick/magick-wasm` 放在 devDependencies 参与打包：Worker 由浏览器直接加载，
 *   产物中残留裸模块说明符会加载失败（依赖自动外置只覆盖 dependencies / peerDependencies）
 * - `__EASYX_IMAGE_TOOLKIT_REMOTE_ONLY__` 供自定义构建剥离本地 wasm 副本
 */
export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/index.ts',
      'ui/index': './src/ui/index.ts',
      'ui/engine/worker': './src/ui/engine/worker.ts',
    },
    define: {
      __EASYX_IMAGE_TOOLKIT_REMOTE_ONLY__: JSON.stringify(
        process.env.EASYX_IMAGE_TOOLKIT_REMOTE === '1',
      ),
    },
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2021',
      dts: true,
    },
  ],
  output: {
    target: 'web',
    copy: [
      {
        // wasm 二进制与第三方许可声明：二者都随本包再分发，故随构建从依赖复制进 dist，
        // 既不把 220 KB 的 NOTICE 提交进仓库，也不会与依赖版本脱节
        from: magickWasmFile,
        to: 'ui/engine/magick.wasm',
      },
      {
        // to 视为目录，原文件名 NOTICE 自动附加 → dist/THIRD-PARTY-NOTICES/NOTICE
        from: path.join(magickWasmRoot, 'NOTICE'),
        to: 'THIRD-PARTY-NOTICES',
      },
    ],
  },
  tools: {
    rspack: {
      module: {
        rules: [
          {
            // 关闭这两个模块的 new URL(...) 解析，让静态表达式原样进入产物
            test: /[\\/]ui[\\/]engine[\\/](client|bundled-wasm)\.ts$/,
            parser: { url: false },
          },
        ],
      },
    },
  },
});
