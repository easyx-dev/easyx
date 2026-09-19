/**
 * 编辑内容区的共享类型
 */
import type { ImageCrop, ImageProcessResult } from '../../types';

/** 预览结果集合：由编辑主体持有，预览舞台与状态区共用同一次引擎处理结果 */
export interface PreviewBundle {
  result: ImageProcessResult | null;
  /** 处理后图像的 Object URL */
  resultUrl: string | null;
  /** 结果对应的原图区域（拖动对比的同区域对齐） */
  resultSourceRect: ImageCrop | null;
  pending: boolean;
  error: string | null;
  /** 设置未产生任何实际变更 */
  noop: boolean;
  /** 无损优化不支持该格式 */
  unsupported: boolean;
  refresh: () => void;
}

/**
 * 交给宿主的处理状态
 *
 * 组件只负责编辑与预览，保存 / 下载等动作由宿主实现，故通过本状态暴露
 * 「当前有没有可用结果」以及是否仍在处理中。
 */
export interface ImageEditorResult {
  result: ImageProcessResult | null;
  pending: boolean;
  noop: boolean;
  unsupported: boolean;
  error: string | null;
}
