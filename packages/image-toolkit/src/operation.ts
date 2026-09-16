/**
 * 图片操作的归一化与描述（纯函数）
 *
 * 归一化职责：取整 + 钳制到 IMAGE_LIMITS 允许范围 + 拒绝结构非法输入
 * 与源图尺寸相关的裁切边界处理见 intersectCrop（容错求交，而非直接拒绝）
 */
import {
  clampQuality,
  IMAGE_LIMITS,
  isOutputFormat,
  isValidPaletteColors,
  MAX_PALETTE_COLORS,
  MIN_PALETTE_COLORS,
} from './limits';
import type { ImageCrop, ImageFit, ImageOperation, ImageResize } from './types';

/** 操作参数非法时抛出，调用方据此返回 400 而非 500 */
export class ImageOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageOperationError';
  }
}

const VALID_FITS: readonly ImageFit[] = ['cover', 'contain', 'fill', 'inside'];
const VALID_ROTATIONS = [0, 90, 180, 270] as const;

/**
 * 取正整数：非有限数值或非正数视为结构非法（零尺寸裁切无意义）
 */
function toPositiveInt(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ImageOperationError(`${field} 必须是正数`);
  }
  return Math.min(max, Math.max(1, Math.round(value)));
}

/**
 * 取非负整数：非有限数值视为结构非法；负数钳制为 0
 * 裁切框由前端交互产生，贴边时的负值应被容忍，真正的边界处理见 intersectCrop
 */
function toNonNegativeInt(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ImageOperationError(`${field} 必须是有限数值`);
  }
  return Math.min(max, Math.max(0, Math.round(value)));
}

function normalizeCrop(crop: ImageCrop): ImageCrop {
  return {
    left: toNonNegativeInt(crop.left, 'crop.left', IMAGE_LIMITS.maxDimension),
    top: toNonNegativeInt(crop.top, 'crop.top', IMAGE_LIMITS.maxDimension),
    width: toPositiveInt(crop.width, 'crop.width', IMAGE_LIMITS.maxDimension),
    height: toPositiveInt(
      crop.height,
      'crop.height',
      IMAGE_LIMITS.maxDimension,
    ),
  };
}

function normalizeResize(resize: ImageResize): ImageResize {
  const width =
    resize.width === undefined
      ? undefined
      : toPositiveInt(resize.width, 'resize.width', IMAGE_LIMITS.maxDimension);
  const height =
    resize.height === undefined
      ? undefined
      : toPositiveInt(
          resize.height,
          'resize.height',
          IMAGE_LIMITS.maxDimension,
        );

  if (width === undefined && height === undefined) {
    throw new ImageOperationError('resize 至少需要指定 width 或 height');
  }

  const fit = resize.fit ?? 'inside';
  if (!VALID_FITS.includes(fit)) {
    throw new ImageOperationError(`resize.fit 不支持：${String(resize.fit)}`);
  }

  const normalized: ImageResize = { fit };
  if (width !== undefined) normalized.width = width;
  if (height !== undefined) normalized.height = height;
  if (fit === 'contain' && resize.background) {
    normalized.background = resize.background;
  }
  return normalized;
}

/**
 * 归一化图片操作
 * 未提供任何字段时返回空对象（视为不做处理）
 */
export function normalizeImageOperation(input: ImageOperation): ImageOperation {
  const normalized: ImageOperation = {};

  if (input.crop) normalized.crop = normalizeCrop(input.crop);
  if (input.resize) normalized.resize = normalizeResize(input.resize);

  if (input.rotate !== undefined) {
    if (!VALID_ROTATIONS.includes(input.rotate)) {
      throw new ImageOperationError(`rotate 仅支持 0 / 90 / 180 / 270`);
    }
    if (input.rotate !== 0) normalized.rotate = input.rotate;
  }

  if (input.flip) normalized.flip = true;
  if (input.flop) normalized.flop = true;

  if (input.format !== undefined) {
    if (!isOutputFormat(input.format)) {
      throw new ImageOperationError(
        `不支持的输出格式：${String(input.format)}`,
      );
    }
    normalized.format = input.format;
  }

  const quality = clampQuality(input.quality);
  if (quality !== undefined) normalized.quality = quality;

  // 降色只对 PNG 输出有意义，但这里不能按 format 字段判断：
  // 「保持原格式」时 format 为空，而源格式恰是 PNG —— 具体是否生效由引擎按解析后的输出格式决定
  if (input.colors !== undefined) {
    if (!isValidPaletteColors(input.colors)) {
      throw new ImageOperationError(
        `colors 需为 ${MIN_PALETTE_COLORS}-${MAX_PALETTE_COLORS} 之间的整数`,
      );
    }
    normalized.colors = input.colors;
  }

  if (input.strip) normalized.strip = true;

  return normalized;
}

/**
 * 判断操作是否会产生实际变更
 * 质量、降色与元数据剥离也算有效变更：保持格式只调质量同样能显著减小体积
 */
export function isImageOperationEffective(operation: ImageOperation): boolean {
  return (
    operation.crop !== undefined ||
    operation.resize !== undefined ||
    operation.rotate !== undefined ||
    operation.flip === true ||
    operation.flop === true ||
    operation.format !== undefined ||
    operation.quality !== undefined ||
    operation.colors !== undefined ||
    operation.strip === true
  );
}

/**
 * 裁切区域与原图求交
 *
 * 裁切框由前端交互产生，可能因取整或裁切器适配方式（contain 会让裁切框超出图像）
 * 而越出原图边界 —— 这类越界应被容忍并裁剪到图像范围，而不是报错打断用户。
 * 完全落在图外（交集为空）才视为非法。
 */
export function intersectCrop(
  crop: ImageCrop,
  imageSize: { width: number; height: number },
): ImageCrop {
  const left = Math.max(0, crop.left);
  const top = Math.max(0, crop.top);
  const right = Math.min(imageSize.width, crop.left + crop.width);
  const bottom = Math.min(imageSize.height, crop.top + crop.height);

  if (right <= left || bottom <= top) {
    throw new ImageOperationError(
      `裁切区域落在原图之外：原图 ${imageSize.width}x${imageSize.height}，裁切 ${crop.width}x${crop.height}@(${crop.left},${crop.top})`,
    );
  }

  return { left, top, width: right - left, height: bottom - top };
}

/** 生成操作的中文描述，用于审计日志与 UI 回显 */
export function describeImageOperation(operation: ImageOperation): string {
  const parts: string[] = [];

  if (operation.crop) {
    const { left, top, width, height } = operation.crop;
    parts.push(`裁切 ${width}x${height}@(${left},${top})`);
  }
  if (operation.resize) {
    const { width, height, fit } = operation.resize;
    const size = [width ? `宽 ${width}` : '', height ? `高 ${height}` : '']
      .filter(Boolean)
      .join(' / ');
    parts.push(`缩放到 ${size}（${fit ?? 'inside'}）`);
  }
  if (operation.rotate) parts.push(`旋转 ${operation.rotate}°`);
  if (operation.flip) parts.push('水平翻转');
  if (operation.flop) parts.push('垂直翻转');
  if (operation.format) parts.push(`转 ${operation.format.toUpperCase()}`);
  if (operation.quality !== undefined) parts.push(`质量 ${operation.quality}`);
  if (operation.colors !== undefined)
    parts.push(`降色至 ${operation.colors} 色`);
  if (operation.strip) parts.push('剥离元数据');

  return parts.length === 0 ? '无变更' : parts.join('；');
}
