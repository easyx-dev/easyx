/**
 * 缩放面板：等比改变图片尺寸（永远保持原始宽高比，默认不放大）
 */
import { resolveScaledSize, scalePercent } from '../../resize';
import type { ImageSize } from '../../types';
import { Hint, NumberInput, Segmented, Stack, Text } from '../primitives';

/** 常用缩放比例预设 */
const PERCENT_PRESETS = [100, 75, 50, 25] as const;

/** 自定义比例的哨兵值：仅用于让分段控件落在「自定义」上，不可选中 */
const CUSTOM = 'custom';

/** 宽高输入上限 */
const MAX_SIZE = 8192;

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
  // 当前尺寸恰好等于某个预设时高亮该预设，否则落到不可选的「自定义」
  const activePreset = PERCENT_PRESETS.some((preset) => preset === percent)
    ? String(percent)
    : CUSTOM;

  const applyPercent = (next: string): void => {
    if (next === CUSTOM) return;
    onChange(
      resolveScaledSize(sourceSize, { kind: 'percent', percent: Number(next) }),
    );
  };

  return (
    <Stack size="sm">
      <Segmented
        aria-label="缩放比例"
        disabled={disabled}
        onChange={applyPercent}
        options={[
          ...PERCENT_PRESETS.map((preset) => ({
            label: `${preset}%`,
            value: String(preset),
          })),
          { disabled: true, label: '自定义', value: CUSTOM },
        ]}
        value={activePreset}
      />

      <Stack direction="row" size="sm" wrap>
        <Text size="xs" tone="secondary">
          宽
        </Text>
        <NumberInput
          aria-label="宽度"
          disabled={disabled}
          max={MAX_SIZE}
          min={1}
          onChange={(width) =>
            onChange(resolveScaledSize(sourceSize, { kind: 'width', width }))
          }
          value={value.width}
          width={100}
        />
        <Text size="xs" tone="secondary">
          × 高
        </Text>
        <NumberInput
          aria-label="高度"
          disabled={disabled}
          max={MAX_SIZE}
          min={1}
          onChange={(height) =>
            onChange(resolveScaledSize(sourceSize, { kind: 'height', height }))
          }
          value={value.height}
          width={100}
        />
      </Stack>

      <Text size="xs" tone="secondary">
        {unchanged
          ? `保持原尺寸 ${sourceSize.width} × ${sourceSize.height}`
          : `${sourceSize.width} × ${sourceSize.height} → ${value.width} × ${value.height}（${percent}%，等比不放大）`}
      </Text>

      {disabled && disabledHint && <Hint>{disabledHint}</Hint>}
    </Stack>
  );
}
