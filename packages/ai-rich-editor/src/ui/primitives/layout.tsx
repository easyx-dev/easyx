/**
 * 纯展示型原语：文本、标签、分区
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

export interface SectionProps {
  /** 分区标题 */
  title: ReactNode;
  /** 标题下的补充说明 */
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 分区：标题 + 说明 + 内容，用于把设置项成组呈现 */
export function Section({
  title,
  description,
  children,
  className,
}: SectionProps) {
  return (
    <section className={cx('easyx-ai-rich-editor__section', className)}>
      <div className="easyx-ai-rich-editor__section-head">
        <h3 className="easyx-ai-rich-editor__section-title">{title}</h3>
        {description !== undefined && (
          <p className="easyx-ai-rich-editor__section-desc">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
