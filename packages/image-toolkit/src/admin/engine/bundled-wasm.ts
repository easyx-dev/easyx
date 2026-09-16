/**
 * 本地打包的 wasm 资源定位
 *
 * 路径基准是**产物**中引用本模块的那个入口（`dist/admin/index.js`），
 * 不是源码位置：本模块会被内联进该入口，因此资源统一按 `./engine/` 前缀指向
 * `dist/admin/engine/magick.wasm`（由 rslib 的 output.copy 落盘）。
 *
 * 这里必须保持静态的 `new URL(..., import.meta.url)` 写法：宿主打包器据此
 * 把 wasm 复制进自己的产物。本包构建期已关闭该表达式的解析（见 rslib.config.ts），
 * 因此改动此处路径时需同步核对产物目录结构。
 */
export function loadBundledWasmUrl(): string {
  return new URL('./engine/magick.wasm', import.meta.url).href;
}
