/**
 * 缩放面板：等比改变图片尺寸（永远保持原始宽高比，默认不放大）
 */
import { InputNumber, Radio, Space, Typography } from 'antd';
import { resolveScaledSize, scalePercent } from '../../resize';
import type { ImageSize } from '../../types';

/** 常用缩放比例预设 */
const PERCENT_PRESETS = [100, 75, 50, 25] as const;

export interface ImageResizePanelProps {
  sourceSize: ImageSize;
  value: ImageSize;
  onChange: (size: ImageSize) => void;
  /** 无损优化模式下禁用（重采样会改变像素） */
  disabled?: boolean;
  disabledHint?: string;
}

export function ImageResizePanel({
  sourceSize,
  value,
  onChange,
  disabled = false,
  disabledHint,
}: ImageResizePanelProps) {
  const unchanged =
    value.width === sourceSize.width && value.height === sourceSize.height;
  const percent = scalePercent(sourceSize, value);

  const applyPercent = (next: number): void => {
    onChange(resolveScaledSize(sourceSize, { kind: 'percent', percent: next }));
  };

  const applyWidth = (width: number | null): void => {
    if (typeof width !== 'number') return;
    onChange(resolveScaledSize(sourceSize, { kind: 'width', width }));
  };

  const applyHeight = (height: number | null): void => {
    if (typeof height !== 'number') return;
    onChange(resolveScaledSize(sourceSize, { kind: 'height', height }));
  };

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Radio.Group
        size="small"
        optionType="button"
        disabled={disabled}
        value={PERCENT_PRESETS.find((preset) => preset === percent) ?? 'custom'}
        onChange={(event) => applyPercent(Number(event.target.value))}
        options={[
          ...PERCENT_PRESETS.map((preset) => ({
            label: `${preset}%`,
            value: preset,
          })),
          { label: '自定义', value: 'custom', disabled: true },
        ]}
      />

      <Space size="small" wrap>
        <Typography.Text type="secondary">宽</Typography.Text>
        <InputNumber
          size="small"
          min={1}
          max={8192}
          disabled={disabled}
          style={{ width: 100 }}
          value={value.width}
          onChange={applyWidth}
        />
        <Typography.Text type="secondary">× 高</Typography.Text>
        <InputNumber
          size="small"
          min={1}
          max={8192}
          disabled={disabled}
          style={{ width: 100 }}
          value={value.height}
          onChange={applyHeight}
        />
      </Space>

      <Typography.Text type="secondary">
        {unchanged
          ? `保持原尺寸 ${sourceSize.width} × ${sourceSize.height}`
          : `${sourceSize.width} × ${sourceSize.height} → ${value.width} × ${value.height}（${percent}%，等比不放大）`}
      </Typography.Text>

      {disabled && disabledHint && (
        <Typography.Text
          type="secondary"
          style={{ display: 'block', fontSize: 12, lineHeight: 1.6 }}
        >
          {disabledHint}
        </Typography.Text>
      )}
    </Space>
  );
}
