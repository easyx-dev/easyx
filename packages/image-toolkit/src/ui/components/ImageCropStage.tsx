/**
 * 裁切台：在原图上直接拖出裁切区域
 *
 * 自研而非依赖第三方裁切库的原因：常见的裁切库只支持固定比例（画布固定、靠平移缩放
 * 取景），无法提供「自由调整裁切框」。这里的模型是——原图 contain 铺满画布，
 * 裁切框可整体拖动、可拖四边与四角改尺寸，比例可选锁定。
 *
 * 坐标约定：裁切框始终以「EXIF 自动定向后的原图」像素坐标表示，与引擎
 * autoOrient → crop 的顺序一致；显示时才换算到画布坐标。
 *
 * 键盘可达：裁切框本身可聚焦，方向键移动、Shift + 方向键改尺寸。
 */
import { useCallback, useRef, useState } from 'react';
import type { ImageCrop, ImageSize } from '../../types';
import { useElementSize } from '../hooks/useElementSize';
import { Button, Field, Segmented, Text } from '../primitives';
import {
  applyAspect,
  applyCropDrag,
  applyCropKey,
  type CropHandle,
  type CropRect,
  fitImageBox,
  fullRect,
  toDisplayRect,
} from './crop-geometry';

/** 裁切比例预设；aspect 为 undefined 表示自由裁切 */
const ASPECT_PRESETS: { aspect?: number; key: string; label: string }[] = [
  { key: 'free', label: '自由' },
  { aspect: 1, key: '1:1', label: '1:1' },
  { aspect: 4 / 3, key: '4:3', label: '4:3' },
  { aspect: 3 / 4, key: '3:4', label: '3:4' },
  { aspect: 16 / 9, key: '16:9', label: '16:9' },
  { aspect: 9 / 16, key: '9:16', label: '9:16' },
];

/** 八个拖拽手柄（四角 + 四边） */
const HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** 判定两个比例是否视为相同（避免浮点误差导致无谓重置裁切框） */
function sameAspect(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

/** 按比例值反查预设 key（undefined 命中「自由」） */
function findAspectKey(aspect: number | undefined): string {
  return (
    ASPECT_PRESETS.find((preset) =>
      aspect === undefined
        ? preset.aspect === undefined
        : preset.aspect !== undefined && sameAspect(preset.aspect, aspect),
    )?.key ?? 'free'
  );
}

export interface ImageCropStageProps {
  imageUrl: string;
  /** 原图像素尺寸（EXIF 定向后） */
  sourceSize: ImageSize;
  /** 进入裁切时的初始裁切区；null 表示整幅图 */
  initialCrop: ImageCrop | null;
  aspect: number | undefined;
  onAspectChange: (aspect: number | undefined) => void;
  onCropAreaChange: (area: ImageCrop) => void;
  /** 取消裁切：退出裁切模式且不应用当前裁切区 */
  onCancel: () => void;
  /** 应用当前裁切区并退出裁切模式 */
  onApply: () => void;
  /** 画布高度 */
  height: number;
}

export function ImageCropStage({
  imageUrl,
  sourceSize,
  initialCrop,
  aspect,
  onAspectChange,
  onCropAreaChange,
  onCancel,
  onApply,
  height,
}: ImageCropStageProps) {
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const [rect, setRect] = useState<CropRect>(
    () => initialCrop ?? fullRect(sourceSize),
  );
  const dragRef = useRef<{
    handle: CropHandle;
    start: CropRect;
    x: number;
    y: number;
  } | null>(null);

  const box = fitImageBox(stage, sourceSize);

  /** 统一的更新入口：内部保留浮点以便拖拽平滑，对外只报整数像素 */
  const update = useCallback(
    (next: CropRect) => {
      setRect(next);
      onCropAreaChange({
        height: Math.round(next.height),
        left: Math.round(next.left),
        top: Math.round(next.top),
        width: Math.round(next.width),
      });
    },
    [onCropAreaChange],
  );

  const beginDrag = (handle: CropHandle, event: React.PointerEvent) => {
    if (box.scale <= 0) return;
    event.preventDefault();
    // 手柄上的按下不应同时触发「整体移动」
    event.stopPropagation();
    dragRef.current = {
      handle,
      start: rect,
      x: event.clientX,
      y: event.clientY,
    };
    try {
      stageRef.current?.setPointerCapture?.(event.pointerId);
    } catch {
      // 捕获失败不影响拖拽：仍由画布上的 pointermove 驱动
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || box.scale <= 0) return;
    // 指针位移换算回原图像素，裁切框的处理全部在纯函数里完成
    update(
      applyCropDrag({
        aspect,
        bounds: sourceSize,
        dx: (event.clientX - drag.x) / box.scale,
        dy: (event.clientY - drag.y) / box.scale,
        handle: drag.handle,
        start: drag.start,
      }),
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      stageRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      // 未捕获成功时释放会抛错，忽略
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = applyCropKey(
      rect,
      event.key,
      event.shiftKey,
      sourceSize,
      aspect,
    );
    if (!next) return;
    event.preventDefault();
    update(next);
  };

  const selectAspect = (key: string) => {
    const preset = ASPECT_PRESETS.find((item) => item.key === key);
    const next = preset?.aspect;
    onAspectChange(next);
    if (next === undefined) {
      update(fullRect(sourceSize));
      return;
    }
    // 当前裁切框已是该比例时保留用户已选位置，只换标签
    if (sameAspect(rect.width / rect.height, next)) return;
    update(applyAspect(next, sourceSize));
  };

  const display = toDisplayRect(rect, box);

  return (
    <div>
      <div
        className="easyx-image-toolkit__crop-stage"
        onPointerCancel={endDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        ref={stageRef}
        style={{ height }}
      >
        {box.width > 0 && (
          <img
            alt="待裁切的原图"
            className="easyx-image-toolkit__crop-image"
            draggable={false}
            src={imageUrl}
            style={{
              height: box.height,
              left: box.left,
              top: box.top,
              width: box.width,
            }}
          />
        )}

        {box.width > 0 && (
          <button
            aria-label="裁切区域：方向键移动，Shift 加方向键调整大小"
            className="easyx-image-toolkit__crop-rect"
            onKeyDown={handleKeyDown}
            onPointerDown={(event) => beginDrag('move', event)}
            style={{
              height: display.height,
              left: display.left,
              top: display.top,
              width: display.width,
            }}
            type="button"
          >
            <span
              aria-hidden="true"
              className="easyx-image-toolkit__crop-grid"
            />
            {HANDLES.map((handle) => (
              <span
                aria-hidden="true"
                className={`easyx-image-toolkit__crop-handle easyx-image-toolkit__crop-handle--${handle}`}
                key={handle}
                onPointerDown={(event) => beginDrag(handle, event)}
              />
            ))}
          </button>
        )}
      </div>

      <div className="easyx-image-toolkit__crop-toolbar">
        <Text size="xs" tone="secondary">
          比例
        </Text>
        <Segmented
          aria-label="裁切比例"
          onChange={selectAspect}
          options={ASPECT_PRESETS.map((preset) => ({
            label: preset.label,
            value: preset.key,
          }))}
          value={findAspectKey(aspect)}
        />
        <Button
          onClick={() => {
            onAspectChange(undefined);
            update(fullRect(sourceSize));
          }}
          size="sm"
        >
          重置
        </Button>
        <div className="easyx-image-toolkit__crop-actions">
          <Button onClick={onCancel} size="sm">
            取消裁切
          </Button>
          <Button onClick={onApply} size="sm" variant="primary">
            应用裁切
          </Button>
        </div>
      </div>

      <div className="easyx-image-toolkit__crop-zoom">
        <Field label="裁切区域（原图像素）">
          <Text size="xs" tone="secondary">
            {Math.round(rect.width)} × {Math.round(rect.height)} @ (
            {Math.round(rect.left)}, {Math.round(rect.top)})
          </Text>
        </Field>
      </div>
    </div>
  );
}
