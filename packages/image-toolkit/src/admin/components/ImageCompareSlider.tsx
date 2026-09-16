/**
 * 原图 / 处理后 拖动对比
 *
 * 关键点是「同区域对齐」：处理结果可能来自裁切与缩放，直接把两张图都按 contain 铺开
 * 会导致左右显示的是不同区域，对比没有意义。做法是让两张图处于**同一像素密度**：
 * - 处理后按容器 contain 得到显示比例 k
 * - 原图按 k × (处理后宽 / 裁切区宽) 渲染，并平移 −裁切偏移 × 该比例
 * 这样分隔线两侧永远是同一块像素，才能真正判断质量损失。
 *
 * 另一处必须注意的是裁剪基准：`clip-path` 的百分比按**元素自身**宽度解析，
 * 而分隔线按**容器**宽度定位。原图元素的宽度/偏移通常都不等于容器，
 * 因此裁剪要套在「容器尺寸的 wrapper」上，否则裁切边界会与分隔线分离。
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

export function ImageCompareSlider({
  sourceUrl,
  sourceSize,
  resultUrl,
  resultSize,
  resultSourceRect,
  height,
}: ImageCompareSliderProps) {
  const [containerRef, container] = useElementSize<HTMLDivElement>();
  const [position, setPosition] = useState(50);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback(
    (clientX: number): void => {
      const element = containerRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = ((clientX - rect.left) / rect.width) * 100;
      setPosition(Math.min(100, Math.max(0, ratio)));
    },
    [containerRef],
  );

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
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  const comparing = resultUrl !== null && resultSize !== null;
  // 处理后按 contain 适配容器
  const resultScale = comparing
    ? Math.min(
        container.width / resultSize.width,
        container.height / resultSize.height,
      )
    : 0;
  const displayWidth = comparing ? resultSize.width * resultScale : 0;
  const displayHeight = comparing ? resultSize.height * resultScale : 0;

  // 原图与处理后同像素密度；无处理结果时原图自行 contain
  const rect = resultSourceRect ?? {
    left: 0,
    top: 0,
    width: sourceSize.width,
    height: sourceSize.height,
  };
  const sourceScale = comparing
    ? resultScale * (resultSize.width / rect.width)
    : Math.min(
        container.width / sourceSize.width,
        container.height / sourceSize.height,
      );
  const sourceDisplay = {
    width: sourceSize.width * sourceScale,
    height: sourceSize.height * sourceScale,
  };
  // 处理后图像居中显示；原图按同一像素密度渲染，并把裁切区左上角对齐到该位置
  const resultLeft = (container.width - displayWidth) / 2;
  const resultTop = (container.height - displayHeight) / 2;
  const sourceLeft = comparing
    ? resultLeft - rect.left * sourceScale
    : (container.width - sourceDisplay.width) / 2;
  const sourceTop = comparing
    ? resultTop - rect.top * sourceScale
    : (container.height - sourceDisplay.height) / 2;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        background:
          'repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 0% 50%) 50% / 16px 16px',
        cursor: comparing ? 'ew-resize' : 'default',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={comparing ? handlePointerDown : undefined}
      onPointerMove={comparing ? handlePointerMove : undefined}
      onPointerUp={comparing ? handlePointerUp : undefined}
      onPointerCancel={comparing ? handlePointerUp : undefined}
    >
      {/* 底层：处理后（占满其显示区域） */}
      {comparing && (
        <img
          src={resultUrl}
          alt="处理后"
          draggable={false}
          style={{
            position: 'absolute',
            left: resultLeft,
            top: resultTop,
            width: displayWidth,
            height: displayHeight,
            maxWidth: 'none',
          }}
        />
      )}

      {/*
				上层：原图，按分隔线只露出左侧。
				裁剪必须套一层「容器尺寸」的 wrapper —— clip-path 的百分比按元素自身宽度解析，
				而原图元素为了与处理后保持同一像素密度，宽度/偏移通常都不等于容器，
				直接在 img 上裁剪会让裁切边界与分隔线分离（偏移裁切时偏差可达数百像素）。
			*/}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: comparing ? `inset(0 ${100 - position}% 0 0)` : undefined,
        }}
      >
        <img
          src={sourceUrl}
          alt="原图"
          draggable={false}
          style={{
            position: 'absolute',
            left: sourceLeft,
            top: sourceTop,
            width: sourceDisplay.width,
            height: sourceDisplay.height,
            maxWidth: 'none',
          }}
        />
      </div>

      {/* 分隔线与拖动手柄 */}
      {comparing && (
        <div
          role="slider"
          aria-label="对比位置"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{
            position: 'absolute',
            left: `calc(${position}% - 1px)`,
            top: 0,
            bottom: 0,
            width: 2,
            background: '#fff',
            boxShadow: '0 0 4px rgba(0,0,0,0.4)',
            cursor: 'ew-resize',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 6px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#666',
            }}
          >
            ⇄
          </span>
        </div>
      )}

      {/* 角标 */}
      {comparing && (
        <>
          <span style={badgeStyle('left')}>原图</span>
          <span style={badgeStyle('right')}>处理后</span>
        </>
      )}
    </div>
  );
}

/** 左上/右上角标样式 */
function badgeStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: 8,
    [side]: 8,
    padding: '1px 6px',
    fontSize: 12,
    color: '#fff',
    background: 'rgba(0,0,0,0.5)',
    pointerEvents: 'none',
  };
}
