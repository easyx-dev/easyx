/**
 * 纯展示型原语：文本、说明小字、字段行、间隔容器、标签、分割线
 *
 * 这几者没有交互逻辑，合并在一个文件里；带交互的原语各自独立成文件。
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils/cx';

type Tone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'warning'
  | 'danger'
  | 'success';

export interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  /** 语气（决定颜色） */
  tone?: Tone;
  /** 字号档位 */
  size?: 'xs' | 'sm' | 'md';
}

/** 文本：颜色/字号由语气与档位决定，默认继承父级 */
export function Text({
  tone = 'default',
  size = 'md',
  className,
  ...rest
}: TextProps) {
  return (
    <span
      className={cx(
        'easyx-image-toolkit__text',
        tone !== 'default' && `easyx-image-toolkit__text--${tone}`,
        size !== 'md' && `easyx-image-toolkit__text--${size}`,
        className,
      )}
      {...rest}
    />
  );
}

export interface HintProps {
  /** 语气：默认次级灰，警示用 warning，阻断用 danger */
  tone?: 'secondary' | 'warning' | 'danger';
  children: ReactNode;
  className?: string;
}

/** 说明小字：面板内一行提示，比 Alert 更轻 */
export function Hint({ tone = 'secondary', children, className }: HintProps) {
  return (
    <span
      className={cx(
        'easyx-image-toolkit__hint',
        tone !== 'secondary' && `easyx-image-toolkit__hint--${tone}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface FieldProps {
  /** 字段名（分段控件等自带 aria-label 的控件无需再关联） */
  label?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 字段行：标签在上、控件在下，用于控制栏内成组的表单 */
export function Field({ label, children, className }: FieldProps) {
  return (
    <div className={cx('easyx-image-toolkit__field', className)}>
      {label !== undefined && (
        <span className="easyx-image-toolkit__field-label">{label}</span>
      )}
      <div className="easyx-image-toolkit__field-control">{children}</div>
    </div>
  );
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** 排列方向，默认纵向 */
  direction?: 'column' | 'row';
  /** 间距档位 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 允许换行（横向排列时） */
  wrap?: boolean;
}

/** 间隔容器：以 gap 表达间距，替代散落的 margin */
export function Stack({
  direction = 'column',
  size = 'md',
  wrap,
  className,
  ...rest
}: StackProps) {
  return (
    <div
      className={cx(
        'easyx-image-toolkit__stack',
        size !== 'md' && `easyx-image-toolkit__stack--${size}`,
        direction === 'row' && 'easyx-image-toolkit__stack--row',
        wrap && 'easyx-image-toolkit__stack--wrap',
        className,
      )}
      {...rest}
    />
  );
}

export interface TagProps {
  tone?: 'default' | 'primary' | 'success' | 'warning';
  children: ReactNode;
  className?: string;
}

/** 标签：体积增减、处理状态等短标记 */
export function Tag({ tone = 'default', children, className }: TagProps) {
  return (
    <span
      className={cx(
        'easyx-image-toolkit__tag',
        tone !== 'default' && `easyx-image-toolkit__tag--${tone}`,
        className,
      )}
    >
      {children}
    </span>
  );
}
