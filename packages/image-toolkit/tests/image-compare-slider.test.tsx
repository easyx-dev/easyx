// @rstest-environment jsdom
/**
 * 拖动对比组件测试：以固定容器尺寸驱动，覆盖舞台几何、分隔线拖动与键盘调整
 *
 * jsdom 无布局引擎，需桩掉 offsetWidth/offsetHeight 与 getBoundingClientRect 才能
 * 让组件进入可比对状态；舞台比容器窄，因此两者的矩形刻意不同，
 * 以钉住「分隔线百分比以舞台为基准」这一不变量。
 */

import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ImageCompareSlider } from '../src/ui/components/ImageCompareSlider';

const CONTAINER = { height: 400, width: 800 };
/** 舞台在容器内居中，宽度只有容器的一半 */
const STAGE = { height: 400, left: 200, width: 400 };

beforeEach(() => {
  // 组件用 offsetWidth/offsetHeight 测容器（不受 transform 影响），jsdom 恒为 0
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => CONTAINER.width,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => CONTAINER.height,
  });
  rs.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const isStage = this.classList?.contains(
        'easyx-image-toolkit__compare-stage',
      );
      const box = isStage ? STAGE : { height: 400, left: 0, width: 800 };
      return {
        ...box,
        bottom: box.height,
        right: box.left + box.width,
        toJSON: () => ({}),
        x: box.left,
        y: 0,
      } as DOMRect;
    },
  );
});

afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
});

/** 取得分隔线（role=slider）当前值 */
function handleValue(): number {
  const handle = screen.getByRole('slider', { name: '对比位置' });
  return Number(handle.getAttribute('aria-valuenow'));
}

/** 舞台元素（分隔线的父节点） */
function stage(): HTMLElement {
  return screen.getByRole('slider', { name: '对比位置' })
    .parentElement as HTMLElement;
}

describe('ImageCompareSlider', () => {
  it('没有处理结果时只显示原图，不出现分隔线', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ height: 400, width: 800 }}
        resultUrl={null}
        resultSize={null}
        resultSourceRect={null}
        height={400}
      />,
    );

    expect(screen.getByAltText('原图')).toBeDefined();
    expect(screen.queryByRole('slider', { name: '对比位置' })).toBeNull();
  });

  it('有处理结果时显示两张图与分隔线，初始位置 50%', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ height: 400, width: 800 }}
        resultUrl="blob:result"
        resultSize={{ height: 200, width: 400 }}
        resultSourceRect={null}
        height={400}
      />,
    );

    expect(screen.getByAltText('原图')).toBeDefined();
    expect(screen.getByAltText('处理后')).toBeDefined();
    expect(handleValue()).toBe(50);
    expect(screen.getByText('原图')).toBeDefined();
    expect(screen.getByText('处理后')).toBeDefined();
  });

  it('舞台收缩到处理结果的适配矩形（分隔线全程落在图像上）', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ height: 1000, width: 1000 }}
        resultUrl="blob:result"
        resultSize={{ height: 250, width: 250 }}
        resultSourceRect={{ height: 500, left: 0, top: 0, width: 500 }}
        height={400}
      />,
    );

    // 容器 800×400 contain 结果 250×250 → 舞台 400×400（而不是撑满容器）
    expect(stage().style.width).toBe('400px');
    expect(stage().style.height).toBe('400px');
  });

  it('原图按裁切区缩放并与舞台对齐（同区域对比）', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ height: 1000, width: 1000 }}
        resultUrl="blob:result"
        resultSize={{ height: 250, width: 250 }}
        resultSourceRect={{ height: 500, left: 100, top: 50, width: 500 }}
        height={400}
      />,
    );

    // 舞台 400 → 缩放系数 400/500 = 0.8；原图 1000 → 800
    const sourceImg = screen.getByAltText('原图');
    expect(sourceImg.style.width).toBe('800px');
    expect(sourceImg.style.height).toBe('800px');
    // 裁切区左上角对齐舞台左上角 → 原图左移 100×0.8、上移 50×0.8
    expect(sourceImg.style.left).toBe('-80px');
    expect(sourceImg.style.top).toBe('-40px');
  });

  it('拖动分隔线按舞台比例更新位置', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ height: 400, width: 800 }}
        resultUrl="blob:result"
        resultSize={{ height: 400, width: 800 }}
        resultSourceRect={null}
        height={400}
      />,
    );

    const target = stage();
    // 舞台 left=200、width=400；clientX=300 → (300-200)/400 = 25%
    fireEvent.pointerDown(target, { clientX: 300, pointerId: 1 });
    expect(handleValue()).toBe(25);

    fireEvent.pointerMove(target, { clientX: 500, pointerId: 1 });
    expect(handleValue()).toBe(75);

    fireEvent.pointerUp(target, { clientX: 500, pointerId: 1 });
    // 抬起后移动不应再改变位置
    fireEvent.pointerMove(target, { clientX: 200, pointerId: 1 });
    expect(handleValue()).toBe(75);
  });

  it('拖动超出舞台时钳制到 0-100', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ height: 400, width: 800 }}
        resultUrl="blob:result"
        resultSize={{ height: 400, width: 800 }}
        resultSourceRect={null}
        height={400}
      />,
    );

    const target = stage();
    fireEvent.pointerDown(target, { clientX: -500, pointerId: 1 });
    expect(handleValue()).toBe(0);

    fireEvent.pointerMove(target, { clientX: 5000, pointerId: 1 });
    expect(handleValue()).toBe(100);
  });

  it('裁剪套在与舞台等大的 wrapper 上（百分比基准必须与分隔线一致）', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ height: 1000, width: 1000 }}
        resultUrl="blob:result"
        // 偏移裁切：原图元素宽度/偏移都不等于舞台，若直接在 img 上裁剪会与分隔线错位
        resultSize={{ height: 250, width: 250 }}
        resultSourceRect={{ height: 500, left: 0, top: 0, width: 500 }}
        height={400}
      />,
    );

    const handle = screen.getByRole('slider', { name: '对比位置' });
    const clipWrapper = screen.getByAltText('原图')
      .parentElement as HTMLElement;

    // img 自身不再承载 clip-path
    expect(screen.getByAltText('原图').style.clipPath).toBe('');

    // 承载裁剪的元素必须铺满舞台，否则百分比基准与分隔线不一致
    expect(clipWrapper).not.toBe(handle.parentElement);
    expect(clipWrapper.getAttribute('style')).toMatch(/inset:\s*0/);
    expect(clipWrapper.style.clipPath).toBe('inset(0 50% 0 0)');
  });

  it('支持键盘调整（无障碍）', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ height: 400, width: 800 }}
        resultUrl="blob:result"
        resultSize={{ height: 400, width: 800 }}
        resultSourceRect={null}
        height={400}
      />,
    );

    const handle = screen.getByRole('slider', { name: '对比位置' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handleValue()).toBe(52);

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handleValue()).toBe(50);

    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handleValue()).toBe(0);

    fireEvent.keyDown(handle, { key: 'End' });
    expect(handleValue()).toBe(100);
  });
});
