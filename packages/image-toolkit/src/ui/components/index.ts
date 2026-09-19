/**
 * 图片处理 UI 组件（公开面）
 *
 * 只导出编辑内容区与引擎门控：前者是宿主的唯一入口，后者供自定义 UI 组合。
 * 对比滑块、裁切台、控制面板、预览舞台等均为内部实现，不对外导出 ——
 * 自定义 UI 请用 ImageEngineGate + 引擎 API（见 ../engine）自行搭建。
 */
export { ImageEditor, type ImageEditorProps } from './ImageEditor';
export { ImageEngineGate } from './ImageEngineGate';
export type { ImageEditorResult } from './types';
