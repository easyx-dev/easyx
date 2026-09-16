/**
 * 图片处理公共类型：与具体引擎无关的语义化描述
 */

/** 可识别的图片格式 */
export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'avif'
  | 'gif'
  | 'tiff'
  | 'bmp'
  | 'heic'
  | 'svg';

/** 可编码输出的目标格式（avif 在本 wasm 构建下产物不可用，故不纳入） */
export type ImageOutputFormat = 'jpeg' | 'png' | 'webp';

/** 缩放适配方式：cover 裁切填满、contain 完整放入并补底色、fill 拉伸、inside 仅等比缩小 */
export type ImageFit = 'cover' | 'contain' | 'fill' | 'inside';

/** 精确裁切区域（基于原图像素坐标，EXIF 已自动定向） */
export interface ImageCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 尺寸变更 */
export interface ImageResize {
  width?: number;
  height?: number;
  fit?: ImageFit;
  /** contain 模式下的补底色（CSS 颜色，如 "#ffffff"） */
  background?: string;
}

/** 与引擎无关的图片处理操作 */
export interface ImageOperation {
  /** 精确裁切 */
  crop?: ImageCrop;
  /** 尺寸变更 */
  resize?: ImageResize;
  /** 顺时针旋转角度 */
  rotate?: 0 | 90 | 180 | 270;
  /** 水平翻转（左右镜像） */
  flip?: boolean;
  /** 垂直翻转（上下镜像） */
  flop?: boolean;
  /** 输出格式，省略则保持原格式 */
  format?: ImageOutputFormat;
  /** 输出质量 1-100，无损模式下忽略 */
  quality?: number;
  /**
   * 调色板量化：输出为 PNG 时最多保留 N 色（有损，连续色调图会出现色带）
   * 仅在输出格式为 png 时生效
   */
  colors?: number;
  /** 是否剥离元数据（EXIF/ICC），默认 false */
  strip?: boolean;
}

/** 宽高尺寸 */
export interface ImageSize {
  width: number;
  height: number;
}

/** 图片元数据 */
export interface ImageMeta {
  width: number;
  height: number;
  format: ImageFormat;
  hasAlpha: boolean;
}

/** 魔数嗅探结果：尺寸在容器头无法解析时为 null */
export interface ImageSniffResult {
  format: ImageFormat;
  mimeType: string;
  /** 规范扩展名，含点（如 ".png"） */
  extension: string;
  width: number | null;
  height: number | null;
}

/** 单次处理结果 */
export interface ImageProcessResult {
  data: Uint8Array;
  mimeType: string;
  meta: ImageMeta;
  /** 处理前字节数（便于 UI 展示收益） */
  sizeBefore: number;
  /** 处理后字节数 */
  sizeAfter: number;
}
