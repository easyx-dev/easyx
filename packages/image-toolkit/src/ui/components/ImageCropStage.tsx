/**
 * 裁切台：占满预览区的裁切交互（进入裁切模式时替换对比视图）
 *
 * 坐标约定：裁切矩形基于「EXIF 自动定向后的原图」像素坐标，与引擎 autoOrient → crop 顺序一致。
 * objectFit 必须为 cover：contain 会让裁切框超出图像而产生越界坐标。
 * 容器尺寸为 0 时（隐藏 / 未测量）react-easy-crop 会算出 NaN，此处直接丢弃该回调。
 */
import { Button, Radio, Slider, Space, Typography } from 'antd';
import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import type { ImageCrop } from '../../types';

/** 裁切比例预设；aspect 为 undefined 表示自由裁切 */
const ASPECT_PRESETS: { key: string; label: string; aspect?: number }[] = [
  { key: 'free', label: '自由' },
  { key: '1:1', label: '1:1', aspect: 1 },
  { key: '4:3', label: '4:3', aspect: 4 / 3 },
  { key: '3:4', label: '3:4', aspect: 3 / 4 },
  { key: '16:9', label: '16:9', aspect: 16 / 9 },
  { key: '9:16', label: '9:16', aspect: 9 / 16 },
];

/** 按比例值反查预设 key（undefined 命中「自由」） */
function findAspectKey(aspect: number | undefined): string {
  return (
    ASPECT_PRESETS.find((preset) => preset.aspect === aspect)?.key ?? 'free'
  );
}

export interface ImageCropStageProps {
  imageUrl: string;
  aspect: number | undefined;
  onAspectChange: (aspect: number | undefined) => void;
  onCropAreaChange: (area: ImageCrop) => void;
  /** 画布高度 */
  height: number;
}

export function ImageCropStage({
  imageUrl,
  aspect,
  onAspectChange,
  onCropAreaChange,
  height,
}: ImageCropStageProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handleComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      if (
        !Number.isFinite(croppedAreaPixels.x) ||
        !Number.isFinite(croppedAreaPixels.y) ||
        !Number.isFinite(croppedAreaPixels.width) ||
        !Number.isFinite(croppedAreaPixels.height)
      ) {
        return;
      }
      onCropAreaChange({
        left: Math.round(croppedAreaPixels.x),
        top: Math.round(croppedAreaPixels.y),
        width: Math.round(croppedAreaPixels.width),
        height: Math.round(croppedAreaPixels.height),
      });
    },
    [onCropAreaChange],
  );

  return (
    <div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          background: '#000',
        }}
      >
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          objectFit="cover"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleComplete}
        />
      </div>

      <Space size="small" wrap style={{ marginTop: 12 }}>
        <Typography.Text type="secondary">比例</Typography.Text>
        <Radio.Group
          size="small"
          optionType="button"
          value={findAspectKey(aspect)}
          onChange={(event) => {
            const preset = ASPECT_PRESETS.find(
              (item) => item.key === event.target.value,
            );
            onAspectChange(preset?.aspect);
          }}
          options={ASPECT_PRESETS.map((preset) => ({
            label: preset.label,
            value: preset.key,
          }))}
        />
        <Button
          size="small"
          onClick={() => {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
          }}
        >
          重置
        </Button>
      </Space>

      <div style={{ marginTop: 4 }}>
        <Typography.Text type="secondary">缩放画布</Typography.Text>
        <Slider
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={setZoom}
          tooltip={{ formatter: (value) => `${value ?? 1}x` }}
        />
      </div>
    </div>
  );
}
