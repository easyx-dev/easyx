/**
 * 裁切几何：全部以「EXIF 自动定向后的原图」像素坐标为准
 *
 * 抽成纯函数的原因：裁切的价值全在边界与比例的处理上（越界、下限、锁定比例时的
 * 锚点），这些用交互去验证成本高、回归风险也高，单测可以直接钉死。
 */
import type { ImageCrop, ImageSize } from '../../types';

/** 裁切矩形（原图像素坐标） */
export type CropRect = ImageCrop;

/** 拖拽对象：整体移动，或四边 / 四角调整 */
export type CropHandle =
  | 'move'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'nw';

/** 裁切矩形的最小边长（原图像素） */
export const MIN_CROP_SIZE = 16;

/** 铺满整幅图 */
export function fullRect(bounds: ImageSize): CropRect {
  return { height: bounds.height, left: 0, top: 0, width: bounds.width };
}

/** 把值夹到区间内 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 图像在容器内 contain 适配后的显示矩形
 * 返回值里带 scale，用于把指针位移换算成原图像素
 */
export function fitImageBox(
  container: ImageSize,
  image: ImageSize,
): { height: number; left: number; scale: number; top: number; width: number } {
  if (image.width <= 0 || image.height <= 0) {
    return { height: 0, left: 0, scale: 0, top: 0, width: 0 };
  }
  const scale = Math.min(
    container.width / image.width,
    container.height / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    height,
    left: (container.width - width) / 2,
    scale,
    top: (container.height - height) / 2,
    width,
  };
}

/** 给定比例下、能放进原图的最大矩形的尺寸 */
function largestSizeForAspect(
  bounds: ImageSize,
  aspect: number,
  minSize: number,
): ImageSize {
  const maxWidth = Math.min(bounds.width, bounds.height * aspect);
  const width = Math.max(minSize, maxWidth);
  return { height: width / aspect, width };
}

/**
 * 把矩形收进原图边界：优先整体平移，实在放不下才收缩
 * 平移优先是为了「拖动时不改变已选尺寸」，符合拖拽的直觉
 */
function keepInside(
  rect: CropRect,
  bounds: ImageSize,
  minSize: number,
): CropRect {
  const width = clamp(
    rect.width,
    Math.min(minSize, bounds.width),
    bounds.width,
  );
  const height = clamp(
    rect.height,
    Math.min(minSize, bounds.height),
    bounds.height,
  );
  return {
    height,
    left: clamp(rect.left, 0, bounds.width - width),
    top: clamp(rect.top, 0, bounds.height - height),
    width,
  };
}

/**
 * 应用比例：取该比例下能放进原图的最大矩形并居中
 * 切换比例时重置尺寸（而非保留当前尺寸），避免出现「锁了比例却大小不变」的迷惑状态
 */
export function applyAspect(
  aspect: number | undefined,
  bounds: ImageSize,
  minSize = MIN_CROP_SIZE,
): CropRect {
  if (!aspect) return fullRect(bounds);
  const size = largestSizeForAspect(bounds, aspect, minSize);
  return keepInside(
    {
      height: size.height,
      left: (bounds.width - size.width) / 2,
      top: (bounds.height - size.height) / 2,
      width: size.width,
    },
    bounds,
    minSize,
  );
}

/** 按锁定比例修正尺寸：以其中一个维度为准，另一个按比例推导 */
function applyRatio(
  width: number,
  height: number,
  aspect: number,
  axis: 'width' | 'height' | 'both',
): ImageSize {
  if (axis === 'width') return { height: width / aspect, width };
  if (axis === 'height') return { height, width: height * aspect };
  // 角手柄：两个维度都在跟随指针，取较大的那组，否则只拖一个方向时矩形不会变大
  const byWidth = { height: width / aspect, width };
  const byHeight = { height, width: height * aspect };
  return byWidth.width >= byHeight.width ? byWidth : byHeight;
}

export interface CropDragParams {
  /** 本次拖拽开始时的矩形 */
  start: CropRect;
  handle: CropHandle;
  /** 指针位移（原图像素） */
  dx: number;
  dy: number;
  bounds: ImageSize;
  /** 锁定比例；不传表示自由裁切 */
  aspect?: number;
  minSize?: number;
}

/**
 * 应用一次拖拽，返回新的裁切矩形
 *
 * 锚点约定：角手柄固定对角，边手柄固定对边并使另一维居中伸缩。
 * 先按拖动量算出目标尺寸，再受比例、边界、下限约束，最后从锚点还原位置。
 */
export function applyCropDrag({
  start,
  handle,
  dx,
  dy,
  bounds,
  aspect,
  minSize = MIN_CROP_SIZE,
}: CropDragParams): CropRect {
  if (handle === 'move') {
    return keepInside(
      { ...start, left: start.left + dx, top: start.top + dy },
      bounds,
      minSize,
    );
  }

  const anchorRight = start.left + start.width;
  const anchorBottom = start.top + start.height;
  const centerX = start.left + start.width / 2;
  const centerY = start.top + start.height / 2;

  // 1) 拖动量落到对应维度上
  let width = start.width + (handle.includes('e') ? dx : 0);
  if (handle.includes('w')) width = start.width - dx;
  let height = start.height + (handle.includes('s') ? dy : 0);
  if (handle.includes('n')) height = start.height - dy;

  // 2) 尺寸下限（先保证可用的最小矩形，再谈比例与边界）
  width = Math.max(width, Math.min(minSize, bounds.width));
  height = Math.max(height, Math.min(minSize, bounds.height));

  // 3) 锁定比例：边手柄由被拖动的那一维决定，角手柄取两者中更严格的一侧
  if (aspect) {
    const axis = handle === 'e' || handle === 'w' ? 'width' : 'height';
    const cornerAxis = 'both';
    const isCorner = handle.length === 2;
    const sized = applyRatio(
      width,
      height,
      aspect,
      isCorner ? cornerAxis : axis,
    );
    width = sized.width;
    height = sized.height;
  }

  // 4) 收进原图边界内（保持锚点，必要时收缩）
  const maxWidth = Math.min(
    bounds.width,
    aspect ? bounds.height * aspect : bounds.width,
  );
  const maxHeight = Math.min(
    bounds.height,
    aspect ? bounds.width / aspect : bounds.height,
  );
  width = Math.min(width, maxWidth);
  height = Math.min(height, maxHeight);
  if (aspect) {
    if (width / aspect > height) width = height * aspect;
    else height = width / aspect;
  }

  // 5) 从锚点还原位置
  let left: number;
  if (handle.includes('w')) left = anchorRight - width;
  else if (handle.includes('e')) left = start.left;
  else left = centerX - width / 2;

  let top: number;
  if (handle.includes('n')) top = anchorBottom - height;
  else if (handle.includes('s')) top = start.top;
  else top = centerY - height / 2;

  return keepInside({ height, left, top, width }, bounds, minSize);
}

/**
 * 键盘调整：方向键移动矩形，Shift + 方向键调整右边与下边（受比例与边界约束）
 * 让裁切不必依赖指针操作
 */
export function applyCropKey(
  start: CropRect,
  key: string,
  shift: boolean,
  bounds: ImageSize,
  aspect?: number,
  step = 8,
): CropRect | null {
  if (shift) {
    const resize: Record<
      string,
      { dx: number; dy: number; handle: CropHandle }
    > = {
      ArrowDown: { dx: 0, dy: step, handle: 's' },
      ArrowLeft: { dx: -step, dy: 0, handle: 'w' },
      ArrowRight: { dx: step, dy: 0, handle: 'e' },
      ArrowUp: { dx: 0, dy: -step, handle: 'n' },
    };
    const entry = resize[key];
    if (!entry) return null;
    return applyCropDrag({
      aspect,
      bounds,
      dx: entry.dx,
      dy: entry.dy,
      handle: entry.handle,
      start,
    });
  }

  const move: Record<string, [number, number]> = {
    ArrowDown: [0, step],
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
  };
  const delta = move[key];
  if (!delta) return null;
  return applyCropDrag({
    aspect,
    bounds,
    dx: delta[0],
    dy: delta[1],
    handle: 'move',
    start,
  });
}

/** 原图坐标 → 容器显示坐标 */
export function toDisplayRect(
  rect: CropRect,
  box: { left: number; scale: number; top: number },
): { height: number; left: number; top: number; width: number } {
  return {
    height: rect.height * box.scale,
    left: box.left + rect.left * box.scale,
    top: box.top + rect.top * box.scale,
    width: rect.width * box.scale,
  };
}
