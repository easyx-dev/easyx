/// <reference types="@rslib/core/types" />

/**
 * 构建期标记：自定义构建时置为 true 以剥离本地 wasm 副本
 * 由 rslib 的 source.define 注入；未注入的环境（rstest / 源码直引）用 typeof 守卫降级
 */
declare const __EASYX_IMAGE_TOOLKIT_REMOTE_ONLY__: boolean | undefined;
