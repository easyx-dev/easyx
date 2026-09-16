/**
 * 等比缩放换算测试
 */
import { describe, expect, it } from '@rstest/core';
import { IMAGE_LIMITS } from '../src/limits';
import { isSameSize, resolveScaledSize, scalePercent } from '../src/resize';

const source = { width: 1772, height: 2480 };

describe('resolveScaledSize - percent', () => {
  it('按百分比等比缩放', () => {
    expect(resolveScaledSize(source, { kind: 'percent', percent: 50 })).toEqual(
      {
        width: 886,
        height: 1240,
      },
    );
  });

  it('超过 100% 时默认不放大，退回原尺寸', () => {
    expect(
      resolveScaledSize(source, { kind: 'percent', percent: 200 }),
    ).toEqual(source);
  });

  it('允许放大时可超过原尺寸', () => {
    expect(
      resolveScaledSize(
        source,
        { kind: 'percent', percent: 200 },
        {
          allowUpscale: true,
        },
      ),
    ).toEqual({ width: 3544, height: 4960 });
  });
});

describe('resolveScaledSize - 单边', () => {
  it('指定宽度时等比推导高度', () => {
    const size = resolveScaledSize(source, { kind: 'width', width: 886 });
    expect(size.width).toBe(886);
    expect(size.height).toBe(1240);
  });

  it('指定高度时等比推导宽度', () => {
    const size = resolveScaledSize(source, { kind: 'height', height: 620 });
    expect(size.height).toBe(620);
    expect(size.width).toBe(443);
  });

  it('指定宽度超过原图时默认不放大，整体退回原尺寸', () => {
    expect(resolveScaledSize(source, { kind: 'width', width: 4000 })).toEqual(
      source,
    );
  });
});

describe('resolveScaledSize - 边界', () => {
  it('结果钳制到 maxDimension', () => {
    const huge = { width: 20000, height: 10000 };
    const size = resolveScaledSize(
      huge,
      { kind: 'percent', percent: 100 },
      {
        allowUpscale: true,
      },
    );
    expect(size.width).toBe(IMAGE_LIMITS.maxDimension);
  });

  it('极小尺寸不低于 1px', () => {
    const size = resolveScaledSize(source, { kind: 'percent', percent: 0.01 });
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it('始终保持原始宽高比', () => {
    const size = resolveScaledSize(source, { kind: 'width', width: 500 });
    expect(size.width / size.height).toBeCloseTo(
      source.width / source.height,
      2,
    );
  });
});

describe('scalePercent', () => {
  it('返回四舍五入的百分比', () => {
    expect(scalePercent(source, { width: 886, height: 1240 })).toBe(50);
  });

  it('原尺寸为 0 时返回 0', () => {
    expect(scalePercent({ width: 0, height: 0 }, source)).toBe(0);
  });
});

describe('isSameSize', () => {
  it('判断尺寸是否一致', () => {
    expect(isSameSize(source, { ...source })).toBe(true);
    expect(isSameSize(source, { width: 1, height: 1 })).toBe(false);
  });
});
