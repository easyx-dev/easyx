/**
 * 裁切台：占满预览区的裁切交互（进入裁切模式时替换对比视图）
 *
 * 坐标约定：裁切矩形基于「EXIF 自动定向后的原图」像素坐标，与引擎 autoOrient → crop 顺序一致。
 * objectFit 必须为 cover：contain 会让裁切框超出图像而产生越界坐标。
 * 容器尺寸为 0 时（隐藏 / 未测量）react-easy-crop 会算出 NaN，此处直接丢弃该回调。
 */
import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import type { ImageCrop } from '../../types';
import { Button, Field, Segmented, Slider, Text } from '../primitives';

/** 裁切比例预设；aspect 为 undefined 表示自由裁切 */
const ASPECT_PRESETS: { key: string; label: string; aspect?: number }[] = [
  { key: 'free', label: '自由' },
  { key: '1:1', label: '1:1', aspect: 1 },
  { key: '4:3', label: '4:3', aspect: 4 / 3 },
  { key: '3:4', label: '3:4', aspect: 3 / 4 },
  { key: '16:9', label: '16:9', aspect: 16 / 9 },
  { key: '9:16', label: '9:16', aspect: 9 / 16 },
];

/** 画布缩放区间 */
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

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
        height: Math.round(croppedAreaPixels.height),
        left: Math.round(croppedAreaPixels.x),
        top: Math.round(croppedAreaPixels.y),
        width: Math.round(croppedAreaPixels.width),
      });
    },
    [onCropAreaChange],
  );

  return (
    <div>
      <div className="easyx-image-toolkit__crop-stage" style={{ height }}>
        <Cropper
          aspect={aspect}
          crop={crop}
          image={imageUrl}
          objectFit="cover"
          onCropChange={setCrop}
          onCropComplete={handleComplete}
          onZoomChange={setZoom}
          zoom={zoom}
        />
      </div>

      <div className="easyx-image-toolkit__crop-toolbar">
        <Text size="xs" tone="secondary">
          比例
        </Text>
        <Segmented
          aria-label="裁切比例"
          onChange={(key) => {
            const preset = ASPECT_PRESETS.find((item) => item.key === key);
            onAspectChange(preset?.aspect);
          }}
          options={ASPECT_PRESETS.map((preset) => ({
            label: preset.label,
            value: preset.key,
          }))}
          value={findAspectKey(aspect)}
        />
        <Button
          onClick={() => {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
          }}
          size="sm"
        >
          重置
        </Button>
      </div>

      <div className="easyx-image-toolkit__crop-zoom">
        <Field label="缩放画布">
          <Slider
            aria-label="缩放画布"
            format={(value) => `${value.toFixed(2)}×`}
            max={ZOOM_MAX}
            min={ZOOM_MIN}
            onChange={setZoom}
            step={0.01}
            value={zoom}
          />
        </Field>
      </div>
    </div>
  );
}
