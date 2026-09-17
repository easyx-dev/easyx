/**
 * 裁切几何单测：边界、下限、锚点与比例锁定
 *
 * 这些规则用交互验证成本高（要真的拖到越界、拖到最小、拖各个角），
 * 因此单独抽成纯函数并用单测钉死。
 */

import { describe, expect, it } from '@rstest/core';
import {
  applyAspect,
  applyCropDrag,
  applyCropKey,
  fitImageBox,
  fullRect,
  MIN_CROP_SIZE,
  toDisplayRect,
} from '../src/ui/components/crop-geometry';

/** 常规测试画幅：1600×1000 的横图 */
const BOUNDS = { height: 1000, width: 1600 };

describe('fullRect / fitImageBox', () => {
  it('铺满整幅图', () => {
    expect(fullRect(BOUNDS)).toEqual({
      height: 1000,
      left: 0,
      top: 0,
      width: 1600,
    });
  });

  it('contain 适配：横图按高度受限，并在容器内居中', () => {
    // 容器 800×400，图 1600×1000 → scale 取较小者 0.4
    expect(fitImageBox({ height: 400, width: 800 }, BOUNDS)).toEqual({
      height: 400,
      left: 80,
      scale: 0.4,
      top: 0,
      width: 640,
    });
  });
});

describe('applyAspect', () => {
  it('不传比例时回到整幅图', () => {
    expect(applyAspect(undefined, BOUNDS)).toEqual(fullRect(BOUNDS));
  });

  it('1:1 取能放下的最大正方形并居中', () => {
    // 1000 是高度上限，正方形边长不能超过它
    expect(applyAspect(1, BOUNDS)).toEqual({
      height: 1000,
      left: 300,
      top: 0,
      width: 1000,
    });
  });

  it('16:9 由宽度撑满、上下留边', () => {
    const rect = applyAspect(16 / 9, BOUNDS);
    expect(Math.round(rect.width)).toBe(1600);
    expect(Math.round(rect.height)).toBe(900);
    expect(Math.round(rect.left)).toBe(0);
    expect(Math.round(rect.top)).toBe(50);
  });
});

describe('applyCropDrag：移动', () => {
  const start = { height: 400, left: 100, top: 100, width: 400 };

  it('按位移平移', () => {
    expect(
      applyCropDrag({
        bounds: BOUNDS,
        dx: 200,
        dy: 50,
        handle: 'move',
        start,
      }),
    ).toEqual({ height: 400, left: 300, top: 150, width: 400 });
  });

  it('顶到边界后停住，且不改变尺寸', () => {
    const rect = applyCropDrag({
      bounds: BOUNDS,
      dx: 5000,
      dy: -5000,
      handle: 'move',
      start,
    });
    expect(rect).toEqual({ height: 400, left: 1200, top: 0, width: 400 });
  });
});

describe('applyCropDrag：边手柄', () => {
  const start = { height: 400, left: 100, top: 100, width: 400 };

  it('右边界外扩：左边界不动', () => {
    const rect = applyCropDrag({
      bounds: BOUNDS,
      dx: 100,
      dy: 0,
      handle: 'e',
      start,
    });
    expect(rect).toEqual({ height: 400, left: 100, top: 100, width: 500 });
  });

  it('左边界内收：右边界不动', () => {
    const rect = applyCropDrag({
      bounds: BOUNDS,
      dx: 50,
      dy: 0,
      handle: 'w',
      start,
    });
    // 原右边界 500，新宽度 350
    expect(rect).toEqual({ height: 400, left: 150, top: 100, width: 350 });
  });

  it('上边界内收：下边界不动', () => {
    const rect = applyCropDrag({
      bounds: BOUNDS,
      dx: 0,
      dy: 50,
      handle: 'n',
      start,
    });
    // 原下边界 500，新高度 350
    expect(rect).toEqual({ height: 350, left: 100, top: 150, width: 400 });
  });

  it('反向拖过头时收缩到最小边长', () => {
    const rect = applyCropDrag({
      bounds: BOUNDS,
      dx: -1000,
      dy: 0,
      handle: 'e',
      start,
    });
    expect(rect.width).toBe(MIN_CROP_SIZE);
    expect(rect.left).toBe(100);
  });
});

describe('applyCropDrag：角手柄（固定对角）', () => {
  const start = { height: 400, left: 100, top: 100, width: 400 };

  it('右下角外扩：左上角不动', () => {
    const rect = applyCropDrag({
      bounds: BOUNDS,
      dx: 100,
      dy: 60,
      handle: 'se',
      start,
    });
    expect(rect).toEqual({ height: 460, left: 100, top: 100, width: 500 });
  });

  it('左上角外扩：右下角不动', () => {
    const rect = applyCropDrag({
      bounds: BOUNDS,
      dx: -50,
      dy: -50,
      handle: 'nw',
      start,
    });
    expect(rect).toEqual({ height: 450, left: 50, top: 50, width: 450 });
  });
});

describe('applyCropDrag：锁定比例', () => {
  const square = { height: 400, left: 300, top: 300, width: 400 };

  it('角手柄只拖一个方向也会等比放大（否则锁比例后拖不动）', () => {
    const rect = applyCropDrag({
      aspect: 1,
      bounds: BOUNDS,
      dx: 100,
      dy: 0,
      handle: 'se',
      start: square,
    });
    expect(rect).toEqual({ height: 500, left: 300, top: 300, width: 500 });
  });

  it('边手柄由被拖动的维度决定，另一维以中心对称伸缩', () => {
    const rect = applyCropDrag({
      aspect: 1,
      bounds: BOUNDS,
      dx: 200,
      dy: 0,
      handle: 'e',
      start: square,
    });
    // 宽度 600 → 高度 600，垂直中心保持在 500
    expect(rect).toEqual({ height: 600, left: 300, top: 200, width: 600 });
  });

  it('比例锁定时尺寸不会越过画幅（1:1 受短边限制）', () => {
    const rect = applyCropDrag({
      aspect: 1,
      bounds: BOUNDS,
      dx: 5000,
      dy: 5000,
      handle: 'se',
      start: square,
    });
    expect(rect.width).toBe(1000);
    expect(rect.height).toBe(1000);
    expect(rect.left).toBe(300);
    expect(rect.top).toBe(0);
  });

  it('16:9 由宽度推导高度，且不越下界', () => {
    const rect = applyCropDrag({
      aspect: 16 / 9,
      bounds: BOUNDS,
      dx: 0,
      dy: 5000,
      handle: 's',
      start: { height: 360, left: 0, top: 0, width: 640 },
    });
    expect(Math.round(rect.height)).toBe(900);
    expect(Math.round(rect.width)).toBe(1600);
    expect(rect.top).toBe(0);
  });
});

describe('applyCropKey', () => {
  const start = { height: 400, left: 100, top: 100, width: 400 };

  it('方向键平移，Shift + 方向键改尺寸', () => {
    expect(applyCropKey(start, 'ArrowRight', false, BOUNDS)?.left).toBe(108);
    expect(applyCropKey(start, 'ArrowUp', false, BOUNDS)?.top).toBe(92);
    expect(applyCropKey(start, 'ArrowRight', true, BOUNDS)?.width).toBe(408);
    expect(applyCropKey(start, 'ArrowDown', true, BOUNDS)?.height).toBe(408);
  });

  it('非方向键返回 null（由调用方决定是否阻止默认行为）', () => {
    expect(applyCropKey(start, 'Enter', false, BOUNDS)).toBeNull();
  });
});

describe('toDisplayRect', () => {
  it('把原图坐标映射到容器坐标', () => {
    expect(
      toDisplayRect(
        { height: 500, left: 100, top: 50, width: 500 },
        { left: 80, scale: 0.4, top: 0 },
      ),
    ).toEqual({ height: 200, left: 120, top: 20, width: 200 });
  });
});
