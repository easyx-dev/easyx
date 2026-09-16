/**
 * 编码面板：有损压缩（格式 / 质量 / PNG 降色）与无损优化（可无损转 WebP）二选一
 *
 * 说明性文案统一用一行小字，不用 Alert —— Alert 只保留给错误与需要用户行动的提示。
 */
import {
  Checkbox,
  Divider,
  Radio,
  Select,
  Slider,
  Space,
  Typography,
} from 'antd';
import { isOutputFormat, PALETTE_COLOR_PRESETS } from '../../limits';
import { getLosslessStrategy, isOptimizableLosslessly } from '../../lossless';
import type { ImageFormat, ImageOutputFormat } from '../../types';
import {
  canKeepSourceFormat,
  type EditorSettings,
  resolveOutputFormat,
} from '../editor-settings';

/** 面板内的一行说明小字 */
function Hint({
  tone = 'secondary',
  children,
}: {
  tone?: 'secondary' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <Typography.Text
      type={tone}
      style={{ display: 'block', fontSize: 12, lineHeight: 1.6 }}
    >
      {children}
    </Typography.Text>
  );
}

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

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Radio.Group
        size="small"
        optionType="button"
        value={value.mode}
        onChange={(event) =>
          onChange({
            mode: event.target.value as EditorSettings['mode'],
            colors: null,
          })
        }
        options={[
          { label: '有损压缩', value: 'lossy' },
          { label: '无损优化', value: 'lossless' },
        ]}
      />

      {value.mode === 'lossless' ? (
        <>
          <Space size="small" wrap>
            <Typography.Text type="secondary">目标格式</Typography.Text>
            <Select<EditorSettings['format']>
              size="small"
              style={{ width: 180 }}
              value={value.format}
              onChange={(format) => onChange({ format })}
              options={[
                { label: keepLabel, value: 'keep', disabled: !keepAvailable },
                { label: 'WebP（无损）', value: 'webp' },
              ]}
            />
          </Space>
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
          <Space size="small" wrap>
            <Typography.Text type="secondary">输出格式</Typography.Text>
            <Select<EditorSettings['format']>
              size="small"
              style={{ width: 180 }}
              value={value.format}
              onChange={(format) =>
                onChange({
                  format,
                  colors:
                    resolveOutputFormat({ ...value, format }, sourceFormat) ===
                    'png'
                      ? value.colors
                      : null,
                })
              }
              options={[
                { label: keepLabel, value: 'keep', disabled: !keepAvailable },
                { label: 'WebP', value: 'webp' },
                { label: 'JPEG', value: 'jpeg' },
                { label: 'PNG', value: 'png' },
              ]}
            />
          </Space>

          <Divider style={{ margin: '4px 0' }} />

          {effectiveFormat === 'png' ? (
            <>
              <Space size="small" wrap>
                <Typography.Text type="secondary">调色板</Typography.Text>
                <Select<number | null>
                  size="small"
                  style={{ width: 180 }}
                  value={value.colors}
                  onChange={(colors) => onChange({ colors })}
                  options={[
                    { label: '不降色（真彩）', value: null },
                    ...PALETTE_COLOR_PRESETS.map((colors) => ({
                      label: `${colors} 色`,
                      value: colors,
                    })),
                  ]}
                />
              </Space>
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
            <div>
              <Typography.Text type="secondary">质量</Typography.Text>
              <Slider
                min={1}
                max={100}
                value={value.quality}
                onChange={(quality) => onChange({ quality })}
              />
            </div>
          )}
        </>
      )}

      <Checkbox
        checked={value.strip}
        onChange={(event) => onChange({ strip: event.target.checked })}
      >
        剥离元数据（EXIF / ICC）
      </Checkbox>
    </Space>
  );
}

export type { ImageOutputFormat };
/** 供上层判断输出格式是否为可编码格式（避免 keep 落到不可输出源格式） */
export { isOutputFormat };
