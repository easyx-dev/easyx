/**
 * 编码面板：有损压缩（格式 / 质量 / PNG 降色）与无损优化（可无损转 WebP）二选一
 *
 * 说明性文案统一用一行小字（Hint），Alert 只保留给错误与需要用户行动的提示。
 */

import { useId } from 'react';
import { isOutputFormat, PALETTE_COLOR_PRESETS } from '../../limits';
import { getLosslessStrategy, isOptimizableLosslessly } from '../../lossless';
import type { ImageFormat, ImageOutputFormat } from '../../types';
import {
  canKeepSourceFormat,
  type EditorSettings,
  resolveOutputFormat,
} from '../editor-settings';
import {
  Checkbox,
  Field,
  Hint,
  Segmented,
  Select,
  Slider,
  Stack,
} from '../primitives';

export interface ImageEncodePanelProps {
  sourceFormat: ImageFormat;
  value: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}

export function ImageEncodePanel({
  sourceFormat,
  value,
  onChange,
}: ImageEncodePanelProps) {
  const effectiveFormat = resolveOutputFormat(value, sourceFormat);
  const losslessSupported = isOptimizableLosslessly(sourceFormat);
  const strategy = getLosslessStrategy(sourceFormat);
  const keepAvailable = canKeepSourceFormat(sourceFormat);
  const keepLabel = keepAvailable
    ? '保持原格式'
    : '保持原格式（源格式不可输出）';
  // 关联 Field 的 label 与控件，让下拉在无障碍树里带上名字
  const formatId = useId();
  const paletteId = useId();

  return (
    <Stack size="sm">
      <Segmented
        aria-label="压缩模式"
        onChange={(mode) =>
          onChange({ colors: null, mode: mode as EditorSettings['mode'] })
        }
        options={[
          { label: '有损压缩', value: 'lossy' },
          { label: '无损优化', value: 'lossless' },
        ]}
        value={value.mode}
      />

      {value.mode === 'lossless' ? (
        <>
          <Field htmlFor={formatId} label="目标格式">
            <Select
              id={formatId}
              onChange={(format) => onChange({ format })}
              options={[
                { disabled: !keepAvailable, label: keepLabel, value: 'keep' },
                { label: 'WebP（无损）', value: 'webp' },
              ]}
              value={value.format}
              width={180}
            />
          </Field>
          {losslessSupported ? (
            <Hint>
              {strategy.label}；像素不变。连续色调图片转 WebP 通常比 PNG
              小得多。
            </Hint>
          ) : (
            <Hint tone="warning">
              {sourceFormat.toUpperCase()} 不支持无损优化：{strategy.label}
            </Hint>
          )}
        </>
      ) : (
        <>
          <Field htmlFor={formatId} label="输出格式">
            <Select
              id={formatId}
              onChange={(format) =>
                onChange({
                  colors:
                    resolveOutputFormat({ ...value, format }, sourceFormat) ===
                    'png'
                      ? value.colors
                      : null,
                  format,
                })
              }
              options={[
                { disabled: !keepAvailable, label: keepLabel, value: 'keep' },
                { label: 'WebP', value: 'webp' },
                { label: 'JPEG', value: 'jpeg' },
                { label: 'PNG', value: 'png' },
              ]}
              value={value.format}
              width={180}
            />
          </Field>

          {effectiveFormat === 'png' ? (
            <>
              <Field htmlFor={paletteId} label="调色板">
                <Select
                  id={paletteId}
                  onChange={(colors) => onChange({ colors })}
                  options={[
                    { label: '不降色（真彩）', value: null },
                    ...PALETTE_COLOR_PRESETS.map((colors) => ({
                      label: `${colors} 色`,
                      value: colors,
                    })),
                  ]}
                  value={value.colors}
                  width={180}
                />
              </Field>
              {value.colors !== null ? (
                <Hint tone="warning">
                  降色至 {value.colors}{' '}
                  色属有损压缩：照片、渐变会出现色带，扁平插画几乎无感。
                </Hint>
              ) : (
                <Hint>
                  PNG 未降色时为无损重压缩（最高压缩级别），不会让文件变大。
                </Hint>
              )}
            </>
          ) : (
            <Field label="质量">
              <Slider
                aria-label="质量"
                max={100}
                min={1}
                onChange={(quality) => onChange({ quality })}
                value={value.quality}
              />
            </Field>
          )}
        </>
      )}

      <Checkbox checked={value.strip} onChange={(strip) => onChange({ strip })}>
        剥离元数据（EXIF / ICC）
      </Checkbox>
    </Stack>
  );
}

export type { ImageOutputFormat };
/** 供上层判断输出格式是否为可编码格式（避免 keep 落到不可输出源格式） */
export { isOutputFormat };
