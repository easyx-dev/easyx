/**
 * 图片处理包浏览器侧入口：引擎客户端 + React hooks + 组件
 *
 * 本入口为浏览器专用（依赖 Worker 与 wasm）。
 * 服务端请使用包根入口的纯逻辑导出（sniffImage / metrics 等），
 * 根入口禁止静态引用引擎，避免 wasm glue 被打进服务端 bundle。
 */

export * from './components';
export {
  ensureImageEngine,
  getImageEngineState,
  isImageEngineReady,
  optimizeImageLosslessly,
  probeImage,
  resetImageEngine,
  subscribeImageEngine,
  transformImage,
} from './engine/client';
export {
  configureImageEngine,
  getConfiguredWasmUrl,
  resolveEngineWasmUrl,
} from './engine/config';
export {
  ImageEngineConfigError,
  ImageEngineError,
} from './engine/errors';
export type {
  ImageEngineStage,
  ImageEngineState,
} from './engine/protocol';
export {
  type UseImageEngineResult,
  useImageEngine,
} from './hooks/useImageEngine';
