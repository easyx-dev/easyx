/**
 * 编辑器设置模型测试：UI 状态 → 引擎入参的转换规则
 */
import { describe, expect, it } from '@rstest/core';
import type { ImageSize } from '../src/types';
import {
  applySettingsPatch,
  buildLosslessOptions,
  buildOperation,
  buildSaveAsName,
  createDefaultSettings,
  describeResultHint,
  hasResize,
  resolveOutputFormat,
  resolveSourceRect,
} from '../src/ui/editor-settings';

const sourceSize: ImageSize = { width: 1772, height: 2480 };

describe('createDefaultSettings', () => {
  it('尺寸跟随原图且默认不做处理', () => {
    const settings = createDefaultSettings(sourceSize);
    expect(settings).toEqual({
      size: { width: 1772, height: 2480 },
      crop: null,
      mode: 'lossy',
      format: 'keep',
      quality: 82,
      colors: null,
      strip: false,
    });
  });
});

describe('resolveOutputFormat', () => {
  it('保持原格式时返回源格式（可输出）', () => {
    const settings = createDefaultSettings(sourceSize);
    expect(resolveOutputFormat(settings, 'png')).toBe('png');
    expect(resolveOutputFormat(settings, 'jpeg')).toBe('jpeg');
  });

  it('源格式不可输出时 keep 退回 WebP（gif / tiff 等）', () => {
    const settings = createDefaultSettings(sourceSize);
    expect(resolveOutputFormat(settings, 'gif')).toBe('webp');
    expect(resolveOutputFormat(settings, 'tiff')).toBe('webp');
  });

  it('显式指定格式时优先返回指定值', () => {
    const settings = {
      ...createDefaultSettings(sourceSize),
      format: 'jpeg' as const,
    };
    expect(resolveOutputFormat(settings, 'png')).toBe('jpeg');
  });
});

describe('hasResize', () => {
  it('尺寸与原图一致时返回 false', () => {
    expect(hasResize(createDefaultSettings(sourceSize), sourceSize)).toBe(
      false,
    );
  });

  it('尺寸变化时返回 true', () => {
    const settings = {
      ...createDefaultSettings(sourceSize),
      size: { width: 886, height: 1240 },
    };
    expect(hasResize(settings, sourceSize)).toBe(true);
  });
});

describe('buildOperation', () => {
  it('PNG 源 + 保持原格式时不写入质量（PNG 无质量参数，写入只会触发无意义重编码）', () => {
    expect(
      buildOperation(createDefaultSettings(sourceSize), sourceSize, 'png'),
    ).toEqual({});
  });

  it('JPEG 源 + 保持原格式时写入质量', () => {
    expect(
      buildOperation(createDefaultSettings(sourceSize), sourceSize, 'jpeg'),
    ).toEqual({ quality: 82 });
  });

  it('缩放落到精确目标尺寸（fill 配合等比推导值不会变形）', () => {
    const settings = {
      ...createDefaultSettings(sourceSize),
      size: { width: 886, height: 1240 },
    };
    expect(buildOperation(settings, sourceSize, 'png').resize).toEqual({
      width: 886,
      height: 1240,
      fit: 'fill',
    });
  });

  it('携带裁切、格式、降色与元数据剥离', () => {
    const settings = {
      ...createDefaultSettings(sourceSize),
      crop: { left: 10, top: 20, width: 100, height: 80 },
      format: 'png' as const,
      colors: 256,
      strip: true,
    };
    expect(buildOperation(settings, sourceSize, 'png')).toEqual({
      crop: { left: 10, top: 20, width: 100, height: 80 },
      format: 'png',
      colors: 256,
      strip: true,
    });
  });

  it('keep 不写入 format 字段', () => {
    const operation = buildOperation(
      createDefaultSettings(sourceSize),
      sourceSize,
      'png',
    );
    expect(operation.format).toBeUndefined();
  });
});

describe('buildLosslessOptions', () => {
  it('keep 时不指定目标格式（同格式无损）', () => {
    expect(buildLosslessOptions(createDefaultSettings(sourceSize))).toEqual({
      strip: false,
      crop: undefined,
      format: undefined,
    });
  });

  it('可无损转 WebP 并叠加裁切', () => {
    const settings = {
      ...createDefaultSettings(sourceSize),
      format: 'webp' as const,
      crop: { left: 0, top: 0, width: 100, height: 100 },
    };
    expect(buildLosslessOptions(settings)).toEqual({
      strip: false,
      crop: { left: 0, top: 0, width: 100, height: 100 },
      format: 'webp',
    });
  });
});

describe('applySettingsPatch', () => {
  it('PNG 源 + keep 时保留降色设置（关键：按解析后的输出格式判断）', () => {
    const current = createDefaultSettings(sourceSize);
    const next = applySettingsPatch(
      current,
      { colors: 256 },
      sourceSize,
      'png',
    );

    expect(next.colors).toBe(256);
  });

  it('切到非 PNG 输出时清空降色', () => {
    const current = { ...createDefaultSettings(sourceSize), colors: 256 };
    const next = applySettingsPatch(
      current,
      { format: 'webp' },
      sourceSize,
      'png',
    );

    expect(next.colors).toBeNull();
  });

  it('切到无损模式时清空降色并把尺寸收回原尺寸', () => {
    const current = {
      ...createDefaultSettings(sourceSize),
      colors: 256,
      size: { width: 500, height: 500 },
    };
    const next = applySettingsPatch(
      current,
      { mode: 'lossless' },
      sourceSize,
      'png',
    );

    expect(next.colors).toBeNull();
    expect(next.size).toEqual({ width: 1772, height: 2480 });
  });

  it('keep + 源格式不可输出（gif）时按实际输出（webp）清空降色', () => {
    const current = { ...createDefaultSettings(sourceSize), colors: 256 };
    const next = applySettingsPatch(current, {}, sourceSize, 'gif');

    expect(next.colors).toBeNull();
  });

  it('不修改传入对象（保持不可变）', () => {
    const current = createDefaultSettings(sourceSize);
    applySettingsPatch(current, { colors: 256 }, sourceSize, 'png');

    expect(current.colors).toBeNull();
  });
});

describe('resolveSourceRect', () => {
  it('无裁切时返回整图区域', () => {
    expect(
      resolveSourceRect(createDefaultSettings(sourceSize), sourceSize),
    ).toEqual({ left: 0, top: 0, width: 1772, height: 2480 });
  });

  it('有裁切时返回裁切区域（拖动对比按此对齐）', () => {
    const settings = {
      ...createDefaultSettings(sourceSize),
      crop: { left: 100, top: 200, width: 800, height: 600 },
    };
    expect(resolveSourceRect(settings, sourceSize)).toEqual({
      left: 100,
      top: 200,
      width: 800,
      height: 600,
    });
  });
});

describe('buildSaveAsName', () => {
  it('按输出 MIME 替换扩展名', () => {
    expect(buildSaveAsName('15x21色纸.png', 'image/webp')).toBe(
      '15x21色纸-edited.webp',
    );
  });

  it('原名无扩展名时直接追加', () => {
    expect(buildSaveAsName('photo', 'image/jpeg')).toBe('photo-edited.jpg');
  });
});

describe('describeResultHint', () => {
  it('体积减小时不提示', () => {
    expect(
      describeResultHint(
        { sizeBefore: 1000, sizeAfter: 500, mimeType: 'image/png' },
        'image/png',
      ),
    ).toBeNull();
  });

  it('同格式未减小时提示已是最优', () => {
    expect(
      describeResultHint(
        { sizeBefore: 1000, sizeAfter: 1000, mimeType: 'image/png' },
        'image/png',
      ),
    ).toContain('已是最优');
  });

  it('转换格式后反而更大时提示保持原图', () => {
    expect(
      describeResultHint(
        { sizeBefore: 1000, sizeAfter: 1200, mimeType: 'image/webp' },
        'image/png',
      ),
    ).toContain('比原图更大');
  });
});
