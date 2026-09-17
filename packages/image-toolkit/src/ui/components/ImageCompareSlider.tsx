/**
 * 原图 / 处理后 拖动对比
 *
 * 对比舞台收缩到「处理后图像的适配矩形」：两张图都只在舞台内渲染，
 * 分隔线的百分比因此始终落在图像上，不会走到空白区域。
 *
 * 关键点是「同区域对齐」：处理结果可能来自裁切与缩放，直接把两张图都按 contain 铺开
 * 会导致左右显示的是不同区域，对比没有意义。做法是让两张图处于**同一像素密度**：
 * - 处理后铺满舞台（舞台即其结果尺寸的适配矩形）
 * - 原图按「舞台宽 / 裁切区宽」缩放，并平移 −裁切偏移 × 该比例
 * 于是裁切区左上角与舞台左上角重合，分隔线两侧永远是同一块像素。
 *
 * 裁剪基准因此天然一致：`clip-path` 的百分比按**元素自身**解析，而承载裁剪的 wrapper
 * 与分隔线都以舞台为基准，两者对齐。
 */
import { useCallback, useRef, useState } from 'react';
import type { ImageCrop, ImageSize } from '../../types';
import { useElementSize } from '../hooks/useElementSize';

export interface ImageCompareSliderProps {
  /** 原图地址 */
  sourceUrl: string;
  /** 原图像素尺寸 */
  sourceSize: ImageSize;
  /** 处理后地址；null 时仅显示原图 */
  resultUrl: string | null;
  /** 处理后像素尺寸 */
  resultSize: ImageSize | null;
  /** 处理结果对应的原图区域；null 表示画幅未变（与处理后尺寸一致） */
  resultSourceRect: ImageCrop | null;
  /** 高度（px） */
  height: number;
}

/** 分隔线位置（0-100）的键盘步进 */
const KEY_STEP = 2;

/** 按容器 contain 适配给定像素尺寸，返回显示尺寸 */
function fitBox(container: ImageSize, size: ImageSize): ImageSize {
  const scale = Math.min(
    container.width / size.width,
    container.height / size.height,
  );
  return { height: size.height * scale, width: size.width * scale };
}

export function ImageCompareSlider({
  sourceUrl,
  sourceSize,
  resultUrl,
  resultSize,
  resultSourceRect,
  height,
}: ImageCompareSliderProps) {
  const [containerRef, container] = useElementSize<HTMLDivElement>();
  const stageRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const draggingRef = useRef(false);

  // 分隔线的百分比以舞台为基准，因此按舞台矩形换算（舞台可能比容器窄，两侧留白）
  const updateFromClientX = useCallback((clientX: number): void => {
    const element = stageRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      draggingRef.current = true;
      // jsdom 无 setPointerCapture，做可选调用
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!draggingRef.current) return;
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      draggingRef.current = false;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'ArrowLeft') {
        setPosition((current) => Math.max(0, current - KEY_STEP));
      } else if (event.key === 'ArrowRight') {
        setPosition((current) => Math.min(100, current + KEY_STEP));
      } else if (event.key === 'Home') {
        setPosition(0);
      } else if (event.key === 'End') {
        setPosition(100);
      } else {
        return;
      }
      event.preventDefault();
    },
    [],
  );

  // 容器尚未测量到时只渲染占位，避免除零
  if (container.width === 0 || container.height === 0) {
    return <div ref={containerRef} style={{ height, width: '100%' }} />;
  }

  const comparing = resultUrl !== null && resultSize !== null;
  // 舞台：有结果时取其适配矩形，否则取原图适配矩形（两者都是图像自身的画幅）
  const stage = fitBox(container, comparing ? resultSize : sourceSize);

  // 原图与处理后同像素密度：舞台宽即裁切区宽的显示值
  const rect = resultSourceRect ?? {
    height: sourceSize.height,
    left: 0,
    top: 0,
    width: sourceSize.width,
  };
  const scale = stage.width / rect.width;
  const sourceBox = {
    height: sourceSize.height * scale,
    width: sourceSize.width * scale,
  };
  // 裁切区左上角对齐舞台左上角；无裁切时居中铺开
  const sourceLeft = comparing
    ? -rect.left * scale
    : (stage.width - sourceBox.width) / 2;
  const sourceTop = comparing
    ? -rect.top * scale
    : (stage.height - sourceBox.height) / 2;

  return (
    <div
      className="easyx-image-toolkit__compare"
      ref={containerRef}
      style={{ height }}
    >
      <div
        className={
          comparing
            ? 'easyx-image-toolkit__compare-stage easyx-image-toolkit__compare-stage--draggable'
            : 'easyx-image-toolkit__compare-stage'
        }
        onPointerCancel={comparing ? handlePointerUp : undefined}
        onPointerDown={comparing ? handlePointerDown : undefined}
        onPointerMove={comparing ? handlePointerMove : undefined}
        onPointerUp={comparing ? handlePointerUp : undefined}
        ref={stageRef}
        style={{ height: stage.height, width: stage.width }}
      >
        {/* 底层：处理后，铺满舞台 */}
        {comparing && (
          <img
            alt="处理后"
            className="easyx-image-toolkit__compare-img"
            draggable={false}
            src={resultUrl}
            style={{ height: stage.height, width: stage.width }}
          />
        )}

        {/*
					上层：原图，按分隔线只露出左侧。
					裁剪套一层与舞台等大的 wrapper —— clip-path 的百分比按元素自身解析，
					而原图元素为了与处理后保持同一像素密度，尺寸/偏移通常都超出舞台，
					直接在 img 上裁剪会让裁切边界与分隔线分离。
				*/}
        <div
          className="easyx-image-toolkit__compare-clip"
          style={{
            clipPath: comparing ? `inset(0 ${100 - position}% 0 0)` : undefined,
            inset: 0,
          }}
        >
          <img
            alt="原图"
            className="easyx-image-toolkit__compare-img"
            draggable={false}
            src={sourceUrl}
            style={{
              height: sourceBox.height,
              left: sourceLeft,
              top: sourceTop,
              width: sourceBox.width,
            }}
          />
        </div>

        {/* 分隔线与拖动手柄 */}
        {comparing && (
          <div
            aria-label="对比位置"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(position)}
            className="easyx-image-toolkit__compare-handle"
            onKeyDown={handleKeyDown}
            role="slider"
            style={{ left: `calc(${position}% - 1px)` }}
            tabIndex={0}
          >
            <span className="easyx-image-toolkit__compare-knob">⇄</span>
          </div>
        )}

        {/* 角标 */}
        {comparing && (
          <>
            <span className="easyx-image-toolkit__compare-badge easyx-image-toolkit__compare-badge--start">
              原图
            </span>
            <span className="easyx-image-toolkit__compare-badge easyx-image-toolkit__compare-badge--end">
              处理后
            </span>
          </>
        )}
      </div>
    </div>
  );
}
