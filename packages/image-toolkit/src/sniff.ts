/**
 * 图片格式魔数嗅探与尺寸解析（纯函数，服务端与浏览器共用）
 *
 * 服务端用途：阻止伪造 mimeType 的存储型 XSS（文件路由为 inline 返回）
 * 浏览器用途：上传/编辑前判定真实格式，避免信任客户端声明的类型
 */
import { formatToExtension, formatToMimeType } from './limits';
import type { ImageFormat, ImageSniffResult } from './types';

/** PNG 文件签名 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** ftyp brand → 格式（用于 ISO-BMFF 容器家族的区分） */
const FTYP_BRANDS: Record<string, ImageFormat> = {
  avif: 'avif',
  avis: 'avif',
  heic: 'heic',
  heix: 'heic',
  hevc: 'heic',
  hevx: 'heic',
  mif1: 'heic',
  msf1: 'heic',
};

function matchesAt(
  bytes: Uint8Array,
  offset: number,
  pattern: number[],
): boolean {
  if (bytes.length < offset + pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (bytes[offset + i] !== pattern[i]) return false;
  }
  return true;
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return '';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readInt32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24) |
    0
  );
}

/** 解析 PNG 尺寸：IHDR 紧跟在 8 字节签名之后 */
function parsePngDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 24 || asciiAt(bytes, 12, 4) !== 'IHDR') return null;
  return [readUint32BE(bytes, 16), readUint32BE(bytes, 20)];
}

/** JPEG 起始标记 */
const JPEG_SOF_MARKERS = [
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
];

/** 解析 JPEG 尺寸：逐段扫描直到 SOFn 帧头 */
function parseJpegDimensions(bytes: Uint8Array): [number, number] | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    // 填充字节与无载荷标记
    if (
      marker === 0xff ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd8)
    ) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) return null; // 进入压缩数据仍未找到帧头
    const segmentLength = readUint16BE(bytes, offset + 2);
    if (JPEG_SOF_MARKERS.includes(marker)) {
      return [readUint16BE(bytes, offset + 7), readUint16BE(bytes, offset + 5)];
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/** 解析 WebP 尺寸：按 VP8X / VP8 / VP8L 三种块头分别处理 */
function parseWebpDimensions(bytes: Uint8Array): [number, number] | null {
  const chunk = asciiAt(bytes, 12, 4);
  if (chunk === 'VP8X' && bytes.length >= 30) {
    return [readUint24LE(bytes, 24) + 1, readUint24LE(bytes, 27) + 1];
  }
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    return [readUint16LE(bytes, 26) & 0x3fff, readUint16LE(bytes, 28) & 0x3fff];
  }
  if (chunk === 'VP8L' && bytes.length >= 25) {
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return null;
}

/** 判断是否为 SVG 文本内容 */
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, 512))
    .replace(/^\uFEFF/, '')
    .trimStart();
  return (
    head.startsWith('<svg') ||
    (head.startsWith('<?xml') && head.includes('<svg'))
  );
}

function result(
  format: ImageFormat,
  dimensions: [number, number] | null,
): ImageSniffResult {
  return {
    format,
    mimeType: formatToMimeType(format),
    extension: formatToExtension(format),
    width: dimensions?.[0] ?? null,
    height: dimensions?.[1] ?? null,
  };
}

/**
 * 嗅探图片真实格式与尺寸
 * 无法识别的格式返回 null（调用方应据此拒绝处理）
 */
export function sniffImage(bytes: Uint8Array): ImageSniffResult | null {
  if (bytes.length < 12) return null;

  if (matchesAt(bytes, 0, PNG_SIGNATURE)) {
    return result('png', parsePngDimensions(bytes));
  }

  if (matchesAt(bytes, 0, [0xff, 0xd8, 0xff])) {
    return result('jpeg', parseJpegDimensions(bytes));
  }

  if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') {
    return result('webp', parseWebpDimensions(bytes));
  }

  if (asciiAt(bytes, 4, 4) === 'ftyp') {
    const format = FTYP_BRANDS[asciiAt(bytes, 8, 4)];
    // AVIF/HEIC 尺寸位于 meta 盒内，解析成本高于收益，交由引擎读取
    if (format) return result(format, null);
  }

  if (asciiAt(bytes, 0, 4) === 'GIF8') {
    return result('gif', [readUint16LE(bytes, 6), readUint16LE(bytes, 8)]);
  }

  if (asciiAt(bytes, 0, 2) === 'BM') {
    // 高度可能为负（自顶向下位图），取绝对值避免入库负数
    return result('bmp', [
      readInt32LE(bytes, 18),
      Math.abs(readInt32LE(bytes, 22)),
    ]);
  }

  if (
    matchesAt(bytes, 0, [0x49, 0x49, 0x2a, 0x00]) ||
    matchesAt(bytes, 0, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return result('tiff', null);
  }

  if (looksLikeSvg(bytes)) {
    return result('svg', null);
  }

  return null;
}
