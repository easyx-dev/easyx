/**
 * 图片处理边界常量与格式映射（纯逻辑，同构可用）
 */
import type { ImageFormat, ImageOutputFormat } from './types';

/** 处理上限：引擎层与服务端校验共用，防止超限输入打爆浏览器内存 */
export const IMAGE_LIMITS = {
  /** 单边最大像素（输入与输出同限） */
  maxDimension: 8192,
  /** 输入最大总像素（防 DoS） */
  maxInputPixels: 50_000_000,
  /** 输入最大字节数（50 MB） */
  maxInputBytes: 50 * 1024 * 1024,
  /** 质量下限 */
  minQuality: 1,
  /** 质量上限 */
  maxQuality: 100,
} as const;

/**
 * 可参与处理的格式
 *
 * 成员经 P0 spike 实测确定（本 wasm 构建的编解码往返能力）：
 * - 可自动识别 + 解码 + 编码：jpeg / png / webp / gif / tiff
 * - avif：编码产物非法（头部非 ftyp 盒），解码亦无 delegate —— 完全不可用
 * - bmp / ico / tga：可解码但需显式指定格式（魔数自动识别失败），收益低故不纳入
 * - heic：无编码 delegate，解码同 avif 路径（libheif 解码器缺失）
 * - svg：规避 ImageMagick XML 解析器的历史外部引用风险
 */
export const PROCESSABLE_FORMATS: readonly ImageFormat[] = [
  'jpeg',
  'png',
  'webp',
  'gif',
  'tiff',
];

/** 可编码输出的格式：同样以实测为准，avif 编码产物不可用故排除 */
export const OUTPUT_FORMATS: readonly ImageOutputFormat[] = [
  'jpeg',
  'png',
  'webp',
];

/** 调色板降色的可选颜色数（PNG 8-bit 索引图上限为 256 色） */
export const PALETTE_COLOR_PRESETS: readonly number[] = [256, 128, 64, 32];

/** 调色板颜色数下限（更少则无法表达有效图像） */
export const MIN_PALETTE_COLORS = 2;

/** 调色板颜色数上限 */
export const MAX_PALETTE_COLORS = 256;

/** 判断调色板颜色数是否合法 */
export function isValidPaletteColors(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_PALETTE_COLORS &&
    value <= MAX_PALETTE_COLORS
  );
}

/** 格式 → 规范 MIME 类型 */
const FORMAT_MIME_TYPES: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  heic: 'image/heic',
  svg: 'image/svg+xml',
};

/** 格式 → 规范扩展名（含点） */
const FORMAT_EXTENSIONS: Record<ImageFormat, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  avif: '.avif',
  gif: '.gif',
  tiff: '.tiff',
  bmp: '.bmp',
  heic: '.heic',
  svg: '.svg',
};

/** 非标准但常见的 MIME 别名 → 规范格式 */
const MIME_ALIASES: Record<string, ImageFormat> = {
  'image/jpg': 'jpeg',
  'image/pjpeg': 'jpeg',
  'image/x-png': 'png',
  'image/x-ms-bmp': 'bmp',
  'image/x-tiff': 'tiff',
  'image/svg': 'svg',
};

/** 判断是否为可参与处理的格式 */
export function isProcessableFormat(format: unknown): format is ImageFormat {
  return (
    typeof format === 'string' &&
    (PROCESSABLE_FORMATS as readonly string[]).includes(format)
  );
}

/** 判断是否为可编码输出的格式 */
export function isOutputFormat(format: unknown): format is ImageOutputFormat {
  return (
    typeof format === 'string' &&
    (OUTPUT_FORMATS as readonly string[]).includes(format)
  );
}

/** 取格式对应的 MIME 类型 */
export function formatToMimeType(format: ImageFormat): string {
  return FORMAT_MIME_TYPES[format];
}

/** 取格式对应的规范扩展名（含点） */
export function formatToExtension(format: ImageFormat): string {
  return FORMAT_EXTENSIONS[format];
}

/** MIME 类型 → 格式；无法识别返回 null */
export function mimeTypeToFormat(mimeType: string): ImageFormat | null {
  const normalized = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalized in MIME_ALIASES) return MIME_ALIASES[normalized];
  for (const [format, mime] of Object.entries(FORMAT_MIME_TYPES)) {
    if (mime === normalized) return format as ImageFormat;
  }
  return null;
}

/** 判断 MIME 类型是否可参与图片处理 */
export function isProcessableMimeType(mimeType: string): boolean {
  const format = mimeTypeToFormat(mimeType);
  return format !== null && isProcessableFormat(format);
}

/** 判断 MIME 类型是否为图片（含不可处理的 svg），用于列表判定是否展示编辑入口 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeTypeToFormat(mimeType) !== null;
}

/** 把质量值钳制到合法区间并取整；传入非数值时返回 undefined */
export function clampQuality(quality: unknown): number | undefined {
  if (typeof quality !== 'number' || !Number.isFinite(quality))
    return undefined;
  const rounded = Math.round(quality);
  return Math.min(
    IMAGE_LIMITS.maxQuality,
    Math.max(IMAGE_LIMITS.minQuality, rounded),
  );
}
