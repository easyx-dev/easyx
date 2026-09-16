/**
 * 引擎操作实测：跑真实 wasm 编解码（Node 环境），断言各路径产出可被嗅探为声明格式
 *
 * 回归目标：magick-wasm 的 write 回调返回的是 wasm 堆视图，复制必须发生在回调内部。
 * 写成 `Uint8Array.from(image.write(...))` 会在 blob 释放后复制，静默产出损坏文件
 * （use-after-free，表现为文件头为垃圾字节但长度正确）。
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  ImageMagick,
  initializeImageMagick,
  MagickColor,
  MagickFormat,
  NoiseType,
} from '@imagemagick/magick-wasm';
import { beforeAll, describe, expect, it } from '@rstest/core';
import {
  optimizeLosslessly,
  probeImage,
  transformImage,
} from '../src/admin/engine/operations';
import { sniffImage } from '../src/sniff';

const require = createRequire(import.meta.url);

/** 源图：平滑噪声，接近真实照片的压缩特性 */
let source: Uint8Array;

beforeAll(async () => {
  const wasmPath = require.resolve('@imagemagick/magick-wasm/magick.wasm');
  await initializeImageMagick(readFileSync(wasmPath));

  source = ImageMagick.read(new MagickColor('#3a7bd5'), 400, 300, (image) => {
    image.addNoise(NoiseType.Gaussian, 30);
    image.blur(0, 6);
    return image.write(MagickFormat.Png, (data) => Uint8Array.from(data));
  });
});

/** 取原始 RGBA 字节流，用于逐像素比对 */
function rawPixels(bytes: Uint8Array): Uint8Array {
  return ImageMagick.read(bytes, (image) =>
    image.write(MagickFormat.Rgba, (data) => Uint8Array.from(data)),
  );
}

describe('probeImage', () => {
  it('读出来源图的尺寸与格式', () => {
    expect(probeImage(source)).toEqual({
      width: 400,
      height: 300,
      format: 'png',
      hasAlpha: false,
    });
  });

  it('非图片返回 null', () => {
    expect(
      probeImage(new TextEncoder().encode('<html>not an image</html>')),
    ).toBeNull();
  });
});

describe('transformImage', () => {
  it('裁切 + 缩放 + 转 WebP 的产出是合法 WebP', () => {
    const result = transformImage(source, {
      crop: { left: 50, top: 40, width: 200, height: 200 },
      resize: { width: 100, fit: 'inside' },
      format: 'webp',
      quality: 82,
    });

    expect(result.meta).toMatchObject({
      width: 100,
      height: 100,
      format: 'webp',
    });
    expect(result.mimeType).toBe('image/webp');
    expect(sniffImage(result.data)?.format).toBe('webp');
    expect(result.sizeBefore).toBe(source.byteLength);
    expect(result.sizeAfter).toBe(result.data.byteLength);
  });

  it('仅调质量并保持原格式的产出是合法 PNG', () => {
    const result = transformImage(source, { quality: 90 });
    expect(sniffImage(result.data)?.format).toBe('png');
  });

  it('裁切越界时与原图求交而非报错', () => {
    const result = transformImage(source, {
      // 左上越界、右下越界：应裁剪为 300x250
      crop: { left: -20, top: -10, width: 320, height: 260 },
      format: 'png',
    });
    expect(result.meta).toMatchObject({ width: 300, height: 250 });
    expect(sniffImage(result.data)?.format).toBe('png');
  });

  it('裁切完全落在图外时抛错', () => {
    expect(() =>
      transformImage(source, {
        crop: { left: 5000, top: 5000, width: 10, height: 10 },
        format: 'png',
      }),
    ).toThrow();
  });

  it('输出格式不支持时抛错', () => {
    expect(() => transformImage(source, { format: 'gif' as never })).toThrow();
  });
});

describe('optimizeLosslessly', () => {
  it('同格式无损优化的产出是合法 PNG，尺寸不变', () => {
    const result = optimizeLosslessly(source, { strip: false });
    expect(result).not.toBeNull();
    expect(sniffImage(result!.data)?.format).toBe('png');
    expect(result!.meta).toMatchObject({ width: 400, height: 300 });
  });

  it('无损转 WebP：产出合法 WebP 且逐像素与原图一致', () => {
    const result = optimizeLosslessly(source, {
      strip: false,
      format: 'webp',
    });
    expect(result).not.toBeNull();
    expect(sniffImage(result!.data)?.format).toBe('webp');
    expect(result!.mimeType).toBe('image/webp');
    // 逐像素比对是「无损」的唯一硬证据
    expect(rawPixels(result!.data)).toEqual(rawPixels(source));
  });

  it('可叠加裁切：裁切区像素与原图对应区域一致', () => {
    const crop = { left: 40, top: 30, width: 120, height: 90 };
    const result = optimizeLosslessly(source, { strip: false, crop });
    expect(result).not.toBeNull();
    expect(result!.meta).toMatchObject({ width: 120, height: 90 });
    expect(sniffImage(result!.data)?.format).toBe('png');

    // 用同样的裁切走有损路径做对照：无损路径的结果应与原图对应区域逐像素一致
    const cropped = transformImage(source, { crop, format: 'png' });
    expect(rawPixels(result!.data)).toEqual(rawPixels(cropped.data));
  });

  it('无损转 JPEG 被拒绝（JPEG 无逐像素无损能力）', () => {
    expect(
      optimizeLosslessly(source, { strip: false, format: 'jpeg' }),
    ).toBeNull();
  });

  it('GIF 等不支持优化的格式返回 null', () => {
    const gif = ImageMagick.read(new MagickColor('#fff'), 20, 20, (image) =>
      image.write(MagickFormat.Gif, (data) => Uint8Array.from(data)),
    );
    expect(optimizeLosslessly(gif, { strip: true })).toBeNull();
  });
});

describe('transformImage - 降色', () => {
  it('指定 colors 时产出合法索引色 PNG 且颜色数受控', () => {
    const result = transformImage(source, { format: 'png', colors: 64 });
    expect(sniffImage(result.data)?.format).toBe('png');
    expect(
      ImageMagick.read(result.data, (image) => image.totalColors),
    ).toBeLessThanOrEqual(64);
    // 降色属有损，但画幅不变
    expect(result.meta).toMatchObject({ width: 400, height: 300 });
  });

  it('颜色数越多越接近原图（单调性）', () => {
    const few = transformImage(source, { format: 'png', colors: 8 });
    const many = transformImage(source, { format: 'png', colors: 256 });
    expect(
      ImageMagick.read(few.data, (image) => image.totalColors),
    ).toBeLessThanOrEqual(
      ImageMagick.read(many.data, (image) => image.totalColors),
    );
  });

  it('非 PNG 输出时忽略 colors，且产出仍合法', () => {
    const result = transformImage(source, { format: 'webp', colors: 64 });
    expect(sniffImage(result.data)?.format).toBe('webp');
  });

  it('PNG 输出一律使用最高压缩级别，默认重编码不会让文件变大', () => {
    const result = transformImage(source, { format: 'png' });
    expect(sniffImage(result.data)?.format).toBe('png');
    expect(result.sizeAfter).toBeLessThanOrEqual(result.sizeBefore);
  });

  it('降色通常比不降色更小', () => {
    const plain = transformImage(source, { format: 'png' });
    const quantized = transformImage(source, { format: 'png', colors: 32 });
    expect(quantized.sizeAfter).toBeLessThan(plain.sizeAfter);
  });
});
