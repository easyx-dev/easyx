/**
 * 按钮：默认描边 / 主要 / 文字 / 链接 四种外观
 *
 * loading 时不置 disabled（否则会丢色变灰），而是摘掉 onClick 并标记 aria-disabled，
 * 既保留视觉又不会误触。
 */
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../cx';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> {
  variant?: 'default' | 'primary' | 'text' | 'link';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  /** 生成中：显示转圈并屏蔽点击 */
  loading?: boolean;
  /** 撑满一行 */
  block?: boolean;
  /** 纯图标按钮：方形、无内边距 */
  iconOnly?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  loading,
  block,
  iconOnly,
  type = 'button',
  className,
  children,
  disabled,
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={cx(
        'easyx-ai-rich-editor__btn',
        `easyx-ai-rich-editor__btn--${variant}`,
        size === 'sm' && 'easyx-ai-rich-editor__btn--sm',
        iconOnly && 'easyx-ai-rich-editor__btn--icon',
        block && 'easyx-ai-rich-editor__btn--block',
        loading && 'easyx-ai-rich-editor__btn--loading',
        className,
      )}
      disabled={disabled}
      onClick={loading ? undefined : onClick}
      ref={ref}
      type={type}
      {...rest}
    >
      {loading && <span className="easyx-ai-rich-editor__spinner" />}
      {icon}
      {children}
    </button>
  );
}
