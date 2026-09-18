/**
 * 内联 SVG 图标
 *
 * 全部以 currentColor 上色、由调用方通过父级 font-size 或 size 控制大小。
 * 集中一处，避免为几个图标引入图标库。
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

export function IconReload({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

export function IconExternalLink({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

export function IconCopy({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <rect height="13" rx="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconSetting({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.6 15H3.4a2 2 0 1 1 0-4h.2A1.7 1.7 0 0 0 4.8 8.1L4.7 8a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3.9a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function IconCode({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

export function IconRobot({ size = 18, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <rect height="10" rx="3" width="16" x="4" y="9" />
      <path d="M12 5V9M9 14h.01M15 14h.01M2 13v3M22 13v3" />
    </svg>
  );
}

export function IconTrash({ size = 14, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

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

export function IconArrowUp({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function IconStop({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...filled}
      {...rest}
    >
      <rect height="10" rx="2" width="10" x="7" y="7" />
    </svg>
  );
}

export function IconInfoCircle({ size = 15, ...rest }: IconProps) {
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

export function IconWarningTriangle({ size = 15, ...rest }: IconProps) {
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

export function IconErrorCircle({ size = 15, ...rest }: IconProps) {
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

export function IconPlus({ size = 14, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconPaperclip({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M21 11.5 12.9 19.6a5 5 0 0 1-7.1-7.1l8.1-8.1a3.4 3.4 0 0 1 4.8 4.8l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4" />
    </svg>
  );
}

export function IconUpload({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M12 16V4M6 10l6-6 6 6" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function IconLink({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}

export function IconGallery({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <path d="m3 15 4.5-4.5a1.5 1.5 0 0 1 2.1 0L15 16M14 14l1.5-1.5a1.5 1.5 0 0 1 2.1 0L21 16M9 8.5h.01" />
    </svg>
  );
}

export function IconImage({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="m3 16 5-5 5 5 3-3 5 5M9.5 9h.01" />
    </svg>
  );
}

export function IconVideo({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <rect height="14" rx="2" width="13" x="2" y="5" />
      <path d="m15 10 6-3.5v11L15 14" />
    </svg>
  );
}

export function IconAudio({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M10 16V5l10-2v11" />
      <circle cx="7" cy="17" r="3" />
      <circle cx="17" cy="14" r="3" />
    </svg>
  );
}

export function IconFile({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="M14 3v5h5" />
      <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5Z" />
    </svg>
  );
}

export function IconSearch({ size = 15, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconChevronLeft({ size = 14, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function IconChevronRight({ size = 14, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...stroke}
      {...rest}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** 媒体类型 → 图标（附件列表与媒体库条目共用） */
export const MEDIA_KIND_ICONS = {
  audio: IconAudio,
  attachment: IconFile,
  image: IconImage,
  video: IconVideo,
} as const;
