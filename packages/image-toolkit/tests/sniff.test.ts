/**
 * 魔数嗅探测试：覆盖各格式识别与尺寸解析，以及无法识别时的兜底
 */
import { describe, expect, it } from '@rstest/core';
import { sniffImage } from '../src/sniff';
import {
  bmpBytes,
  ftypBytes,
  gifBytes,
  jpegBytes,
  pngBytes,
  svgBytes,
  tiffBytes,
  webpVp8Bytes,
  webpVp8lBytes,
  webpVp8xBytes,
} from './helpers/image-fixtures';

describe('sniffImage', () => {
  it('识别 PNG 并从 IHDR 读出尺寸', () => {
    const result = sniffImage(pngBytes(1920, 1080));
    expect(result).toMatchObject({
      format: 'png',
      mimeType: 'image/png',
      extension: '.png',
      width: 1920,
      height: 1080,
    });
  });

  it('识别 JPEG 并跳过前置段从 SOF0 读出尺寸', () => {
    const result = sniffImage(jpegBytes(800, 600));
    expect(result).toMatchObject({ format: 'jpeg', width: 800, height: 600 });
  });

  it('识别 WebP 的 VP8X 扩展格式（尺寸为 24 位小端减一）', () => {
    const result = sniffImage(webpVp8xBytes(400, 300));
    expect(result).toMatchObject({ format: 'webp', width: 400, height: 300 });
  });

  it('识别 WebP 的 VP8 有损格式（尺寸取 14 位）', () => {
    const result = sniffImage(webpVp8Bytes(320, 240));
    expect(result).toMatchObject({ format: 'webp', width: 320, height: 240 });
  });

  it('识别 WebP 的 VP8L 无损格式（尺寸位打包）', () => {
    const result = sniffImage(webpVp8lBytes(128, 96));
    expect(result).toMatchObject({ format: 'webp', width: 128, height: 96 });
  });

  it('识别 GIF（尺寸为小端 16 位）', () => {
    const result = sniffImage(gifBytes(200, 150));
    expect(result).toMatchObject({
      format: 'gif',
      mimeType: 'image/gif',
      width: 200,
      height: 150,
    });
  });

  it('识别 BMP（尺寸为小端 32 位）', () => {
    const result = sniffImage(bmpBytes(64, 48));
    expect(result).toMatchObject({ format: 'bmp', width: 64, height: 48 });
  });

  it('自顶向下 BMP（高度为负）返回绝对值', () => {
    const result = sniffImage(bmpBytes(64, -48));
    expect(result).toMatchObject({ format: 'bmp', width: 64, height: 48 });
  });

  it('识别 TIFF 且尺寸未知时返回 null 尺寸', () => {
    const result = sniffImage(tiffBytes());
    expect(result).toMatchObject({ format: 'tiff', width: null, height: null });
  });

  it('按 ftyp brand 区分 AVIF', () => {
    const result = sniffImage(ftypBytes('avif'));
    expect(result).toMatchObject({
      format: 'avif',
      mimeType: 'image/avif',
      extension: '.avif',
    });
  });

  it('按 ftyp brand 区分 HEIC', () => {
    const result = sniffImage(ftypBytes('heic'));
    expect(result).toMatchObject({ format: 'heic', mimeType: 'image/heic' });
  });

  it('识别 SVG 文本内容', () => {
    const result = sniffImage(svgBytes());
    expect(result).toMatchObject({ format: 'svg', mimeType: 'image/svg+xml' });
  });

  it('非图片内容返回 null', () => {
    expect(
      sniffImage(new TextEncoder().encode('hello world, not an image')),
    ).toBeNull();
  });

  it('HTML 伪装成图片时返回 null（阻止存储型 XSS）', () => {
    expect(
      sniffImage(
        new TextEncoder().encode('<html><script>alert(1)</script></html>'),
      ),
    ).toBeNull();
  });

  it('字节数不足 12 时返回 null', () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
