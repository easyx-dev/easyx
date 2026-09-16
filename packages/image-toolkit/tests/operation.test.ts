/**
 * 图片操作归一化与描述测试
 */
import { describe, expect, it } from '@rstest/core';
import { IMAGE_LIMITS } from '../src/limits';
import {
  describeImageOperation,
  ImageOperationError,
  intersectCrop,
  isImageOperationEffective,
  normalizeImageOperation,
} from '../src/operation';

describe('normalizeImageOperation', () => {
  it('空操作返回空对象', () => {
    expect(normalizeImageOperation({})).toEqual({});
  });

  it('裁切坐标取整并保留', () => {
    expect(
      normalizeImageOperation({
        crop: { left: 10.6, top: 20.2, width: 300.7, height: 200.1 },
      }),
    ).toEqual({ crop: { left: 11, top: 20, width: 301, height: 200 } });
  });

  it('裁切尺寸超过上限时钳制', () => {
    const result = normalizeImageOperation({
      crop: { left: 0, top: 0, width: 99999, height: 1 },
    });
    expect(result.crop?.width).toBe(IMAGE_LIMITS.maxDimension);
  });

  it('裁切坐标为负时钳制为 0（贴边越界应被容忍）', () => {
    expect(
      normalizeImageOperation({
        crop: { left: -10, top: -5, width: 100, height: 100 },
      }),
    ).toEqual({ crop: { left: 0, top: 0, width: 100, height: 100 } });
  });

  it('裁切坐标为 NaN 时抛错（结构非法，与越界区分）', () => {
    expect(() =>
      normalizeImageOperation({
        crop: { left: Number.NaN, top: 0, width: 10, height: 10 },
      }),
    ).toThrow(/有限数值/);
  });

  it('裁切尺寸为 0 时抛错', () => {
    expect(() =>
      normalizeImageOperation({
        crop: { left: 0, top: 0, width: 0, height: 10 },
      }),
    ).toThrow(ImageOperationError);
  });

  it('resize 未指定宽高时抛错', () => {
    expect(() => normalizeImageOperation({ resize: {} })).toThrow(
      ImageOperationError,
    );
  });

  it('resize 默认 fit 为 inside（不放大）', () => {
    expect(normalizeImageOperation({ resize: { width: 800 } })).toEqual({
      resize: { width: 800, fit: 'inside' },
    });
  });

  it('resize 保留显式 fit 与 contain 补底色', () => {
    expect(
      normalizeImageOperation({
        resize: { width: 400, height: 300, fit: 'contain', background: '#fff' },
      }),
    ).toEqual({
      resize: { width: 400, height: 300, fit: 'contain', background: '#fff' },
    });
  });

  it('resize 的 fit 非法时抛错', () => {
    expect(() =>
      normalizeImageOperation({
        resize: { width: 100, fit: 'stretch' as never },
      }),
    ).toThrow(ImageOperationError);
  });

  it('非 contain 模式丢弃 background', () => {
    expect(
      normalizeImageOperation({
        resize: { width: 100, fit: 'cover', background: '#fff' },
      }),
    ).toEqual({ resize: { width: 100, fit: 'cover' } });
  });

  it('rotate 仅接受 0/90/180/270，0 视为无操作被丢弃', () => {
    expect(normalizeImageOperation({ rotate: 180 })).toEqual({ rotate: 180 });
    expect(normalizeImageOperation({ rotate: 0 })).toEqual({});
    expect(() => normalizeImageOperation({ rotate: 45 as never })).toThrow(
      ImageOperationError,
    );
  });

  it('输出格式非法时抛错', () => {
    expect(() => normalizeImageOperation({ format: 'gif' as never })).toThrow(
      ImageOperationError,
    );
  });

  it('质量取整并钳制', () => {
    expect(normalizeImageOperation({ quality: 82.6 }).quality).toBe(83);
    expect(normalizeImageOperation({ quality: 0 }).quality).toBe(
      IMAGE_LIMITS.minQuality,
    );
    expect(normalizeImageOperation({ quality: 500 }).quality).toBe(
      IMAGE_LIMITS.maxQuality,
    );
  });

  it('降色在无 format 字段时也保留（保持原格式 + PNG 源的场景）', () => {
    expect(normalizeImageOperation({ colors: 256 })).toEqual({ colors: 256 });
  });

  it('降色颜色数非法时抛错', () => {
    expect(() => normalizeImageOperation({ colors: 1 })).toThrow(
      ImageOperationError,
    );
    expect(() => normalizeImageOperation({ colors: 300 })).toThrow(
      ImageOperationError,
    );
  });

  it('忽略 false 的布尔开关', () => {
    expect(
      normalizeImageOperation({ flip: false, flop: false, strip: false }),
    ).toEqual({});
  });
});

describe('isImageOperationEffective', () => {
  it('仅格式转换也算有效变更', () => {
    expect(isImageOperationEffective({ format: 'webp' })).toBe(true);
  });

  it('仅调整质量或剥离元数据也算有效变更', () => {
    expect(isImageOperationEffective({ quality: 80 })).toBe(true);
    expect(isImageOperationEffective({ strip: true })).toBe(true);
  });

  it('空操作不算有效变更', () => {
    expect(isImageOperationEffective({})).toBe(false);
    expect(isImageOperationEffective({ flip: false, strip: false })).toBe(
      false,
    );
  });
});

describe('intersectCrop', () => {
  const imageSize = { width: 1000, height: 800 };

  it('完全在图内时原样返回', () => {
    expect(
      intersectCrop({ left: 10, top: 20, width: 300, height: 200 }, imageSize),
    ).toEqual({ left: 10, top: 20, width: 300, height: 200 });
  });

  it('越界部分被裁剪到图像范围（容忍前端取整误差）', () => {
    expect(
      intersectCrop(
        { left: -50, top: -30, width: 200, height: 200 },
        imageSize,
      ),
    ).toEqual({ left: 0, top: 0, width: 150, height: 170 });
  });

  it('右下越界同样被裁剪', () => {
    expect(
      intersectCrop(
        { left: 900, top: 700, width: 200, height: 200 },
        imageSize,
      ),
    ).toEqual({ left: 900, top: 700, width: 100, height: 100 });
  });

  it('完全落在图外时抛错', () => {
    expect(() =>
      intersectCrop(
        { left: 2000, top: 2000, width: 100, height: 100 },
        imageSize,
      ),
    ).toThrow(ImageOperationError);
  });
});

describe('describeImageOperation', () => {
  it('描述空操作', () => {
    expect(describeImageOperation({})).toBe('无变更');
  });

  it('组合描述裁切、缩放、格式与质量', () => {
    const description = describeImageOperation({
      crop: { left: 10, top: 20, width: 300, height: 200 },
      resize: { width: 800, fit: 'inside' },
      format: 'webp',
      quality: 82,
    });
    expect(description).toContain('裁切 300x200@(10,20)');
    expect(description).toContain('缩放到 宽 800（inside）');
    expect(description).toContain('转 WEBP');
    expect(description).toContain('质量 82');
  });
});
