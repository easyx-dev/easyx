/**
 * 无损优化策略表测试
 */
import { describe, expect, it } from '@rstest/core';
import { isOutputFormat, PROCESSABLE_FORMATS } from '../src/limits';
import {
  getLosslessStrategy,
  isOptimizableLosslessly,
  LOSSLESS_STRATEGIES,
} from '../src/lossless';

describe('LOSSLESS_STRATEGIES', () => {
  it('覆盖全部可识别格式', () => {
    for (const format of Object.keys(LOSSLESS_STRATEGIES)) {
      expect(getLosslessStrategy(format as never).label).toBeTruthy();
    }
    expect(Object.keys(LOSSLESS_STRATEGIES)).toContain('heic');
  });

  it('PNG / WebP / TIFF 为逐像素无损（已用原始 RGBA 字节比对实测）', () => {
    expect(getLosslessStrategy('png').fidelity).toBe('exact');
    expect(getLosslessStrategy('webp').fidelity).toBe('exact');
    expect(getLosslessStrategy('tiff').fidelity).toBe('exact');
  });

  it('JPEG 只能做到视觉无损（ImageMagick 无系数透传能力，实测约 24% 像素字节差异）', () => {
    expect(getLosslessStrategy('jpeg').fidelity).toBe('near');
  });

  it('AVIF 在本引擎下编码产物非法、解码不可用，标记为不支持', () => {
    expect(getLosslessStrategy('avif').fidelity).toBe('unsupported');
  });
});

describe('isOptimizableLosslessly', () => {
  it('exact 与 near 均视为可用', () => {
    expect(isOptimizableLosslessly('png')).toBe(true);
    expect(isOptimizableLosslessly('jpeg')).toBe(true);
  });

  it('不支持优化的格式返回 false', () => {
    expect(isOptimizableLosslessly('gif')).toBe(false);
    expect(isOptimizableLosslessly('svg')).toBe(false);
  });

  it('TIFF 虽可无损重压缩但不在可输出格式内，判定为不可用（与引擎保持一致）', () => {
    expect(getLosslessStrategy('tiff').fidelity).toBe('exact');
    expect(isOutputFormat('tiff')).toBe(false);
    expect(isOptimizableLosslessly('tiff')).toBe(false);
  });

  it('可处理格式中至少存在一种支持无损优化的格式', () => {
    expect(PROCESSABLE_FORMATS.some((f) => isOptimizableLosslessly(f))).toBe(
      true,
    );
  });
});
