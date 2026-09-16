/**
 * 元素尺寸观测 Hook
 *
 * 用 offsetWidth/offsetHeight 而非 getBoundingClientRect：后者包含 CSS transform，
 * antd 弹窗的 zoom 动画（transform: scale）会让首次测量偏小，而 transform 不触发
 * ResizeObserver，尺寸会永久停在动画中间值。offset* 是布局尺寸，不受 transform 影响。
 *
 * jsdom 无 ResizeObserver，此时只保留首次同步测量。
 */
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { ImageSize } from '../../types';

export function useElementSize<T extends HTMLElement>(): [
  RefObject<T | null>,
  ImageSize,
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ImageSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = (): void => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
