/**
 * 编辑器设置模型：UI 状态 → 引擎入参的唯一转换点（纯逻辑，可单测）
 */
import { formatToExtension, isOutputFormat, mimeTypeToFormat } from '../limits';
import { isSameSize } from '../resize';
import type {
  ImageCrop,
  ImageFormat,
  ImageOperation,
  ImageOutputFormat,
  ImageSize,
} from '../types';
import type { LosslessOptions } from './engine/protocol';

/** 编码策略：有损压缩 / 无损优化（与缩放互斥） */
export type EncodeMode = 'lossy' | 'lossless';

/** 编辑器设置 */
export interface EditorSettings {
  /** 目标尺寸；无损模式下恒等于原尺寸 */
  size: ImageSize;
  /** 裁切区域；null 表示不裁切 */
  crop: ImageCrop | null;
  mode: EncodeMode;
  /** 有损为输出格式、无损为目标格式；keep 表示保持原格式 */
  format: ImageOutputFormat | 'keep';
  /** 有损压缩质量 1-100 */
  quality: number;
  /** PNG 降色颜色数；null 表示不降色 */
  colors: number | null;
  /** 是否剥离元数据（EXIF/ICC） */
  strip: boolean;
}

/** 默认压缩质量 */
const DEFAULT_QUALITY = 82;

/** 生成默认设置（尺寸跟随原图，不做任何处理） */
export function createDefaultSettings(sourceSize: ImageSize): EditorSettings {
  return {
    size: { width: sourceSize.width, height: sourceSize.height },
    crop: null,
    mode: 'lossy',
    format: 'keep',
    quality: DEFAULT_QUALITY,
    colors: null,
    strip: false,
  };
}

/**
 * 解析实际输出格式
 * 源格式不可输出（如 gif / tiff）时 keep 无意义，退回 WebP
 */
export function resolveOutputFormat(
  settings: EditorSettings,
  sourceFormat: ImageFormat,
): ImageOutputFormat {
  if (settings.format !== 'keep') return settings.format;
  return isOutputFormat(sourceFormat) ? sourceFormat : 'webp';
}

/** 源格式是否可作为「保持原格式」的输出目标 */
export function canKeepSourceFormat(sourceFormat: ImageFormat): boolean {
  return isOutputFormat(sourceFormat);
}

/** 是否启用了缩放（尺寸与原图不同） */
export function hasResize(
  settings: EditorSettings,
  sourceSize: ImageSize,
): boolean {
  return !isSameSize(settings.size, sourceSize);
}

/**
 * 构造有损压缩 / 几何处理操作
 * 无损模式不走这里（无损不允许缩放）
 */
export function buildOperation(
  settings: EditorSettings,
  sourceSize: ImageSize,
  sourceFormat: ImageFormat,
): ImageOperation {
  const operation: ImageOperation = {};

  if (settings.crop) operation.crop = settings.crop;
  if (hasResize(settings, sourceSize)) {
    // 尺寸已按原比例推导，fill 只是精确落到该尺寸，不会拉伸变形
    operation.resize = {
      width: settings.size.width,
      height: settings.size.height,
      fit: 'fill',
    };
  }
  if (settings.format !== 'keep') operation.format = settings.format;
  // 质量仅对 JPEG / WebP 有意义：PNG 编码始终无损，写入质量只会触发无意义的重编码
  if (resolveOutputFormat(settings, sourceFormat) !== 'png') {
    operation.quality = settings.quality;
  }
  if (settings.colors !== null) operation.colors = settings.colors;
  if (settings.strip) operation.strip = true;

  return operation;
}

/** 构造无损优化参数（无损允许裁切，不允许缩放） */
export function buildLosslessOptions(
  settings: EditorSettings,
): LosslessOptions {
  return {
    strip: settings.strip,
    crop: settings.crop ?? undefined,
    format: settings.format === 'keep' ? undefined : settings.format,
  };
}

/**
 * 应用设置的局部更新，并收敛模式联动规则
 *
 * 注意：判断「降色是否有效」必须用**解析后的输出格式**而非原始 `format` 字段 ——
 * PNG 源 + `keep` 的实际输出仍是 PNG，用原始字段判断会把刚选中的降色立刻清空。
 */
export function applySettingsPatch(
  current: EditorSettings,
  patch: Partial<EditorSettings>,
  sourceSize: ImageSize,
  sourceFormat: ImageFormat,
): EditorSettings {
  const next = { ...current, ...patch };

  if (next.mode === 'lossless') {
    // 重采样会改变像素，无损模式下尺寸强制回到原尺寸
    next.size = { width: sourceSize.width, height: sourceSize.height };
    next.colors = null;
  } else if (resolveOutputFormat(next, sourceFormat) !== 'png') {
    next.colors = null;
  }

  return next;
}

/** 处理结果对应的原图区域：用于拖动对比的同区域对齐 */
export function resolveSourceRect(
  settings: EditorSettings,
  sourceSize: ImageSize,
): ImageCrop {
  return (
    settings.crop ?? {
      left: 0,
      top: 0,
      width: sourceSize.width,
      height: sourceSize.height,
    }
  );
}

/** 生成「另存为」文件名：按输出 MIME 替换扩展名 */
export function buildSaveAsName(fileName: string, mimeType: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '');
  const format = mimeTypeToFormat(mimeType);
  return `${base}-edited${format ? formatToExtension(format) : ''}`;
}

/**
 * 结果提示：体积未减小时给出建议（无损已最优 / 转换后反而更大）
 * 返回 null 表示体积确实减小、无需提示
 */
export function describeResultHint(
  result: { sizeBefore: number; sizeAfter: number; mimeType: string },
  sourceMimeType: string,
): string | null {
  if (result.sizeAfter < result.sizeBefore) return null;
  return result.mimeType === sourceMimeType
    ? '当前文件已是最优，无需处理'
    : '处理结果比原图更大，建议保持原图';
}
