/**
 * 内联 SVG 图标
 *
 * 全部以 currentColor 上色、以 em 无关的固定像素尺寸渲染，由调用方通过
 * font-size 或 size 控制大小。集中在一个文件里，避免为几个图标引入图标库。
 */
import type { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** 图标边长（px） */
  size?: number;
}

/** 线性图标共用描边属性 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.8,
} as const;

/** 填充图标共用属性 */
const filled = { fill: 'currentColor' } as const;

export function IconClose({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconCaretDown({ size = 14, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconInfoCircle({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...filled}
      {...rest}
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Zm1.1 11.3h-2.2v-7h2.2v7Z" />
    </svg>
  );
}

export function IconWarningTriangle({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...filled}
      {...rest}
    >
      <path d="M12 2.6c.6 0 1.2.3 1.5.9l8.3 14.4c.7 1.2-.2 2.7-1.5 2.7H3.7c-1.3 0-2.2-1.5-1.5-2.7L10.5 3.5c.3-.6.9-.9 1.5-.9Zm0 5.2a1.2 1.2 0 0 0-1.2 1.3l.2 4.6a1 1 0 0 0 2 0l.2-4.6A1.2 1.2 0 0 0 12 7.8Zm0 8a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z" />
    </svg>
  );
}

export function IconErrorCircle({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...filled}
      {...rest}
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.5 12.1a1 1 0 0 1-1.4 1.4L12 13.4l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1-2.1-2.1a1 1 0 0 1 1.4-1.4l2.1 2.1 2.1-2.1a1 1 0 0 1 1.4 1.4L13.4 12l2.1 2.1Z" />
    </svg>
  );
}

export function IconSuccessCircle({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...filled}
      {...rest}
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.6 5.6a1 1 0 0 1-1.4 0L7.3 12.9a1 1 0 0 1 1.4-1.4l1.7 1.7 4.9-4.9a1 1 0 0 1 1.4 1.4Z" />
    </svg>
  );
}
