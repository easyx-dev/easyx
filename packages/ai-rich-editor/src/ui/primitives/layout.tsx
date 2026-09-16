/**
 * 纯展示型原语：文本、说明小字、字段行、间隔容器、标签
 *
 * 这几者没有交互逻辑，合并在一个文件里；带交互的原语各自独立成文件。
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

type Tone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'warning'
  | 'danger'
  | 'success'
  | 'primary';

export interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  /** 语气（决定颜色） */
  tone?: Tone;
  /** 字号档位 */
  size?: 'xs' | 'sm' | 'md';
  /** 块级展示 */
  block?: boolean;
}

/** 文本：颜色/字号由语气与档位决定，默认继承父级 */
export function Text({
  tone = 'default',
  size = 'md',
  block,
  className,
  ...rest
}: TextProps) {
  return (
    <span
      className={cx(
        'easyx-ai-rich-editor__text',
        tone !== 'default' && `easyx-ai-rich-editor__text--${tone}`,
        size !== 'md' && `easyx-ai-rich-editor__text--${size}`,
        block && 'easyx-ai-rich-editor__text--block',
        className,
      )}
      {...rest}
    />
  );
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** 排列方向，默认纵向 */
  direction?: 'column' | 'row';
  /** 间距档位 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 允许换行（横向排列时） */
  wrap?: boolean;
  /** 主轴对齐 */
  justify?: 'start' | 'between';
}

/** 间隔容器：以 gap 表达间距，替代散落的 margin */
export function Stack({
  direction = 'column',
  size = 'md',
  wrap,
  justify = 'start',
  className,
  ...rest
}: StackProps) {
  return (
    <div
      className={cx(
        'easyx-ai-rich-editor__stack',
        size !== 'md' && `easyx-ai-rich-editor__stack--${size}`,
        direction === 'row' && 'easyx-ai-rich-editor__stack--row',
        wrap && 'easyx-ai-rich-editor__stack--wrap',
        justify !== 'start' && `easyx-ai-rich-editor__stack--${justify}`,
        className,
      )}
      {...rest}
    />
  );
}

export interface TagProps {
  tone?: 'default' | 'primary';
  children: ReactNode;
  className?: string;
}

/** 标签：设置面板的「生效状态」等短标记 */
export function Tag({ tone = 'default', children, className }: TagProps) {
  return (
    <span
      className={cx(
        'easyx-ai-rich-editor__tag',
        tone !== 'default' && `easyx-ai-rich-editor__tag--${tone}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface FieldProps {
  /** 字段名；传入 htmlFor 时与控件关联 */
  label?: ReactNode;
  /** 关联控件的 id */
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/** 字段行：标签在上、控件在下 */
export function Field({ label, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cx('easyx-ai-rich-editor__field', className)}>
      {label !== undefined && (
        <label className="easyx-ai-rich-editor__field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      <div className="easyx-ai-rich-editor__field-control">{children}</div>
    </div>
  );
}
