// @rstest-environment jsdom
/**
 * 拖动对比组件测试：以固定容器尺寸驱动，覆盖分隔线拖动与键盘调整
 *
 * jsdom 无布局引擎，需桩掉 getBoundingClientRect 才能让组件进入可比对状态。
 */

import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ImageCompareSlider } from '../src/ui/components/ImageCompareSlider';

const CONTAINER = { left: 0, top: 0, width: 800, height: 400 };

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
  rs.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    ...CONTAINER,
    right: CONTAINER.width,
    bottom: CONTAINER.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
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

describe('ImageCompareSlider', () => {
  it('没有处理结果时只显示原图，不出现分隔线', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ width: 800, height: 400 }}
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
        sourceSize={{ width: 800, height: 400 }}
        resultUrl="blob:result"
        resultSize={{ width: 400, height: 200 }}
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

  it('拖动分隔线按容器比例更新位置', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ width: 800, height: 400 }}
        resultUrl="blob:result"
        resultSize={{ width: 800, height: 400 }}
        resultSourceRect={null}
        height={400}
      />,
    );

    const handle = screen.getByRole('slider', { name: '对比位置' });
    const container = handle.parentElement as HTMLElement;

    fireEvent.pointerDown(container, { clientX: 200, pointerId: 1 });
    expect(handleValue()).toBe(25);

    fireEvent.pointerMove(container, { clientX: 600, pointerId: 1 });
    expect(handleValue()).toBe(75);

    fireEvent.pointerUp(container, { clientX: 600, pointerId: 1 });
    // 抬起后移动不应再改变位置
    fireEvent.pointerMove(container, { clientX: 100, pointerId: 1 });
    expect(handleValue()).toBe(75);
  });

  it('拖动超出容器时钳制到 0-100', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ width: 800, height: 400 }}
        resultUrl="blob:result"
        resultSize={{ width: 800, height: 400 }}
        resultSourceRect={null}
        height={400}
      />,
    );

    const handle = screen.getByRole('slider', { name: '对比位置' });
    const container = handle.parentElement as HTMLElement;

    fireEvent.pointerDown(container, { clientX: -500, pointerId: 1 });
    expect(handleValue()).toBe(0);

    fireEvent.pointerMove(container, { clientX: 5000, pointerId: 1 });
    expect(handleValue()).toBe(100);
  });

  it('裁剪套在容器尺寸的 wrapper 上（百分比基准必须与分隔线一致）', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ width: 1000, height: 1000 }}
        resultUrl="blob:result"
        // 偏移裁切：原图元素宽度/偏移都不等于容器，若直接在 img 上裁剪会与分隔线错位
        resultSize={{ width: 250, height: 250 }}
        resultSourceRect={{ left: 0, top: 0, width: 500, height: 500 }}
        height={400}
      />,
    );

    const handle = screen.getByRole('slider', { name: '对比位置' });
    const container = handle.parentElement as HTMLElement;
    const sourceImg = screen.getByAltText('原图');
    const clipWrapper = sourceImg.parentElement as HTMLElement;

    // img 自身不再承载 clip-path
    expect(sourceImg.style.clipPath).toBe('');

    // 承载裁剪的元素必须铺满容器，否则百分比基准与分隔线不一致
    expect(clipWrapper).not.toBe(container);
    expect(clipWrapper.getAttribute('style')).toMatch(/inset:\s*0/);
    expect(clipWrapper.style.clipPath).toBe('inset(0 50% 0 0)');
  });

  it('支持键盘调整（无障碍）', () => {
    render(
      <ImageCompareSlider
        sourceUrl="/uploads/cover.png"
        sourceSize={{ width: 800, height: 400 }}
        resultUrl="blob:result"
        resultSize={{ width: 800, height: 400 }}
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
