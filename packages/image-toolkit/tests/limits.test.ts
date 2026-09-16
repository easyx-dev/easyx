/**
 * 边界常量与格式映射测试
 */
import { describe, expect, it } from '@rstest/core';
import {
  clampQuality,
  formatToExtension,
  formatToMimeType,
  IMAGE_LIMITS,
  isImageMimeType,
  isOutputFormat,
  isProcessableFormat,
  isProcessableMimeType,
  mimeTypeToFormat,
} from '../src/limits';

describe('isProcessableFormat', () => {
  it('常见位图格式可处理', () => {
    expect(isProcessableFormat('jpeg')).toBe(true);
    expect(isProcessableFormat('png')).toBe(true);
    expect(isProcessableFormat('webp')).toBe(true);
  });

  it('SVG 不可处理（规避 XML 解析器的外部引用风险）', () => {
    expect(isProcessableFormat('svg')).toBe(false);
  });
});

describe('isOutputFormat', () => {
  it('仅接受实测可用的三种输出格式', () => {
    expect(isOutputFormat('webp')).toBe(true);
    expect(isOutputFormat('jpeg')).toBe(true);
    expect(isOutputFormat('png')).toBe(true);
  });

  it('avif 编码产物在本引擎下非法，不接受', () => {
    expect(isOutputFormat('avif')).toBe(false);
  });

  it('仅可读取的格式不作为输出格式', () => {
    expect(isOutputFormat('gif')).toBe(false);
    expect(isOutputFormat('tiff')).toBe(false);
  });
});

describe('formatToMimeType', () => {
  it('返回规范 MIME 类型', () => {
    expect(formatToMimeType('jpeg')).toBe('image/jpeg');
    expect(formatToMimeType('avif')).toBe('image/avif');
    expect(formatToMimeType('heic')).toBe('image/heic');
  });
});

describe('formatToExtension', () => {
  it('返回带点的规范扩展名', () => {
    expect(formatToExtension('jpeg')).toBe('.jpg');
    expect(formatToExtension('tiff')).toBe('.tiff');
  });
});

describe('mimeTypeToFormat', () => {
  it('识别标准 MIME', () => {
    expect(mimeTypeToFormat('image/png')).toBe('png');
    expect(mimeTypeToFormat('image/jpeg')).toBe('jpeg');
  });

  it('识别带参数与大小写差异的 MIME', () => {
    expect(mimeTypeToFormat('IMAGE/PNG')).toBe('png');
    expect(mimeTypeToFormat('image/png; charset=binary')).toBe('png');
  });

  it('识别非标准别名', () => {
    expect(mimeTypeToFormat('image/jpg')).toBe('jpeg');
    expect(mimeTypeToFormat('image/x-png')).toBe('png');
    expect(mimeTypeToFormat('image/x-ms-bmp')).toBe('bmp');
  });

  it('未知 MIME 返回 null', () => {
    expect(mimeTypeToFormat('application/pdf')).toBeNull();
    expect(mimeTypeToFormat('')).toBeNull();
  });
});

describe('isProcessableMimeType', () => {
  it('可处理格式返回 true', () => {
    expect(isProcessableMimeType('image/png')).toBe(true);
    expect(isProcessableMimeType('image/jpg')).toBe(true);
  });

  it('SVG 与非图片返回 false', () => {
    expect(isProcessableMimeType('image/svg+xml')).toBe(false);
    expect(isProcessableMimeType('application/octet-stream')).toBe(false);
  });
});

describe('isImageMimeType', () => {
  it('SVG 也算图片（用于列表判定是否展示预览）', () => {
    expect(isImageMimeType('image/svg+xml')).toBe(true);
    expect(isImageMimeType('text/plain')).toBe(false);
  });
});

describe('clampQuality', () => {
  it('取整并钳制到合法区间', () => {
    expect(clampQuality(82.4)).toBe(82);
    expect(clampQuality(0)).toBe(IMAGE_LIMITS.minQuality);
    expect(clampQuality(999)).toBe(IMAGE_LIMITS.maxQuality);
  });

  it('非数值返回 undefined', () => {
    expect(clampQuality(Number.NaN)).toBeUndefined();
    expect(clampQuality('80')).toBeUndefined();
    expect(clampQuality(undefined)).toBeUndefined();
  });
});
