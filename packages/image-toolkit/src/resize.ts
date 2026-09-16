/**
 * 等比缩放换算（纯函数，UI 与引擎共用）
 *
 * 语义：始终保持原始宽高比；默认不放大；结果钳制到 IMAGE_LIMITS.maxDimension
 */
import { IMAGE_LIMITS } from './limits';
import type { ImageSize } from './types';

/** 缩放请求：按比例 / 指定宽 / 指定高（指定单边时另一边等比推导） */
export type ScaleRequest =
  | { kind: 'percent'; percent: number }
  | { kind: 'width'; width: number }
  | { kind: 'height'; height: number };

export interface ScaleOptions {
  /** 是否允许放大，默认 false（放大不会增加信息量，通常不是用户意图） */
  allowUpscale?: boolean;
}

function clampDimension(value: number): number {
  return Math.min(IMAGE_LIMITS.maxDimension, Math.max(1, Math.round(value)));
}

/** 按原始宽高比从某一维度推导另一维度 */
function derive(source: ImageSize, width?: number, height?: number): ImageSize {
  if (width !== undefined) {
    return { width, height: (width * source.height) / source.width };
  }
  if (height !== undefined) {
    return { width: (height * source.width) / source.height, height };
  }
  return { width: source.width, height: source.height };
}

/**
 * 计算等比缩放后的目标尺寸
 * @param source 原图尺寸
 * @param request 缩放请求
 * @param options 是否允许放大
 */
export function resolveScaledSize(
  source: ImageSize,
  request: ScaleRequest,
  options: ScaleOptions = {},
): ImageSize {
  const { allowUpscale = false } = options;

  let size: ImageSize;
  switch (request.kind) {
    case 'percent': {
      const ratio = request.percent / 100;
      size = {
        width: source.width * ratio,
        height: source.height * ratio,
      };
      break;
    }
    case 'width':
      size = derive(source, request.width, undefined);
      break;
    case 'height':
      size = derive(source, undefined, request.height);
      break;
  }

  if (!allowUpscale) {
    // 任一边超过原图即视为放大，整体退回原尺寸（保持等比）
    if (size.width > source.width || size.height > source.height) {
      const shrink = Math.min(
        source.width / size.width,
        source.height / size.height,
      );
      size = { width: size.width * shrink, height: size.height * shrink };
    }
  }

  return {
    width: clampDimension(size.width),
    height: clampDimension(size.height),
  };
}

/** 计算相对原图的实际缩放百分比（供 UI 展示） */
export function scalePercent(source: ImageSize, target: ImageSize): number {
  if (source.width === 0) return 0;
  return Math.round((target.width / source.width) * 100);
}

/** 尺寸是否与原图一致（用于判断是否需要真正下发放缩放操作） */
export function isSameSize(a: ImageSize, b: ImageSize): boolean {
  return a.width === b.width && a.height === b.height;
}
