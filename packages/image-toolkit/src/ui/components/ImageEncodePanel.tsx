/**
 * 编码面板：有损压缩（格式 / 质量 / PNG 降色）与无损优化（可无损转 WebP）二选一
 *
 * 选项都不多，因此格式与调色板一律用分段控件（与压缩模式同一控件）而非下拉：
 * 少一次点击、选项一眼可见，也免去浮层定位与焦点管理。
 *
 * 说明性文案统一用一行小字（Hint），Alert 只保留给错误与需要用户行动的提示。
 */
import { isOutputFormat, PALETTE_COLOR_PRESETS } from '../../limits';
import { getLosslessStrategy, isOptimizableLosslessly } from '../../lossless';
import type { ImageFormat, ImageOutputFormat } from '../../types';
import {
  canKeepSourceFormat,
  type EditorSettings,
  resolveOutputFormat,
} from '../editor-settings';
import { Checkbox, Field, Hint, Segmented, Slider, Stack } from '../primitives';

/** 调色板的「不降色」哨兵：分段控件的取值只能是字符串 */
const PALETTE_NONE = 'none';

/** 保持原格式的展示文案（不可用时由 Hint 说明原因） */
const KEEP_LABEL = '保持原格式';

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
  const sourceLabel = sourceFormat.toUpperCase();

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

      {!keepAvailable && (
        <Hint>源格式 {sourceLabel} 不可作为输出格式，请另选一种。</Hint>
      )}

      {value.mode === 'lossless' ? (
        <>
          <Field label="目标格式">
            <Segmented
              aria-label="目标格式"
              onChange={(format) =>
                onChange({ format: format as EditorSettings['format'] })
              }
              options={[
                {
                  disabled: !keepAvailable,
                  label: KEEP_LABEL,
                  value: 'keep',
                },
                { label: 'WebP（无损）', value: 'webp' },
              ]}
              value={value.format}
            />
          </Field>
          {losslessSupported ? (
            <Hint>
              {strategy.label}；像素不变。连续色调图片转 WebP 通常比 PNG
              小得多。
            </Hint>
          ) : (
            <Hint tone="warning">
              {sourceLabel} 不支持无损优化：{strategy.label}
            </Hint>
          )}
        </>
      ) : (
        <>
          <Field label="输出格式">
            <Segmented
              aria-label="输出格式"
              onChange={(format) =>
                onChange({
                  colors:
                    resolveOutputFormat(
                      { ...value, format: format as EditorSettings['format'] },
                      sourceFormat,
                    ) === 'png'
                      ? value.colors
                      : null,
                  format: format as EditorSettings['format'],
                })
              }
              options={[
                {
                  disabled: !keepAvailable,
                  label: KEEP_LABEL,
                  value: 'keep',
                },
                { label: 'WebP', value: 'webp' },
                { label: 'JPEG', value: 'jpeg' },
                { label: 'PNG', value: 'png' },
              ]}
              value={value.format}
            />
          </Field>

          {effectiveFormat === 'png' ? (
            <>
              <Field label="调色板">
                <Segmented
                  aria-label="调色板"
                  onChange={(key) =>
                    onChange({
                      colors: key === PALETTE_NONE ? null : Number(key),
                    })
                  }
                  options={[
                    { label: '不降色', value: PALETTE_NONE },
                    ...PALETTE_COLOR_PRESETS.map((colors) => ({
                      label: `${colors} 色`,
                      value: String(colors),
                    })),
                  ]}
                  value={
                    value.colors === null ? PALETTE_NONE : String(value.colors)
                  }
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
