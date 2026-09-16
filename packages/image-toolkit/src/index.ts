/**
 * 图片处理包入口：纯逻辑层（同构，零重量依赖）
 *
 * 边界约定：本入口只允许导出与图片语义相关的纯函数与类型，
 * 禁止静态引用 @imagemagick/magick-wasm —— 服务端（file.server.ts）
 * 会 import 本入口做魔数嗅探，静态引用会把 wasm glue 拖进服务端 bundle。
 * 引擎与 UI 一律经 ./ui（动态 import）进入。
 */
export * from './limits';
export * from './lossless';
export * from './operation';
export * from './resize';
export * from './sniff';
export type * from './types';
