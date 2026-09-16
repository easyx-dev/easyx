/**
 * 测试用最小图片字节构造器：只保留能被嗅探器识别的容器头
 */

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

function writeUint24LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
}

/** 最小 PNG：签名 + IHDR */
export function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set(ascii('IHDR'), 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** 最小 JPEG：SOI + APP0 段 + SOF0 帧头 */
export function jpegBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0, 0x00, 0x10], 2);
  bytes.set([0xff, 0xc0, 0x00, 0x11, 0x08], 20);
  const view = new DataView(bytes.buffer);
  view.setUint16(25, height);
  view.setUint16(27, width);
  return bytes;
}

/** 最小 WebP（VP8X 扩展格式） */
export function webpVp8xBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(ascii('RIFF'), 0);
  bytes.set(ascii('WEBP'), 8);
  bytes.set(ascii('VP8X'), 12);
  writeUint24LE(bytes, 24, width - 1);
  writeUint24LE(bytes, 27, height - 1);
  return bytes;
}

/** 最小 WebP（VP8 有损） */
export function webpVp8Bytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(ascii('RIFF'), 0);
  bytes.set(ascii('WEBP'), 8);
  bytes.set(ascii('VP8 '), 12);
  bytes.set([0x9d, 0x01, 0x2a], 23);
  const view = new DataView(bytes.buffer);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return bytes;
}

/** 最小 WebP（VP8L 无损） */
export function webpVp8lBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(25);
  bytes.set(ascii('RIFF'), 0);
  bytes.set(ascii('WEBP'), 8);
  bytes.set(ascii('VP8L'), 12);
  bytes[20] = 0x2f;
  const bits = (width - 1) | ((height - 1) << 14);
  new DataView(bytes.buffer).setUint32(21, bits, true);
  return bytes;
}

/** 最小 GIF */
export function gifBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(13);
  bytes.set(ascii('GIF89a'), 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
}

/** 最小 BMP */
export function bmpBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set(ascii('BM'), 0);
  const view = new DataView(bytes.buffer);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  return bytes;
}

/** 最小 TIFF（小端） */
export function tiffBytes(): Uint8Array {
  const bytes = new Uint8Array(12);
  bytes.set([0x49, 0x49, 0x2a, 0x00], 0);
  return bytes;
}

/** 最小 ISO-BMFF 容器（用于 AVIF / HEIC 的 brand 区分） */
export function ftypBytes(brand: string): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x00, 0x00, 0x00, 0x10], 0);
  bytes.set(ascii('ftyp'), 4);
  bytes.set(ascii(brand), 8);
  return bytes;
}

/** SVG 文本内容 */
export function svgBytes(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
  );
}
