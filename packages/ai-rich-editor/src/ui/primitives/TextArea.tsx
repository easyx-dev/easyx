/**
 * 多行文本输入：原生 textarea + 统一外观
 */
import type { Ref } from 'react';
import { cx } from '../cx';

export interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  /** 可见行数（决定初始高度） */
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  placeholder,
  disabled,
  id,
  'aria-label': ariaLabel,
  className,
  ref,
}: TextAreaProps) {
  return (
    <textarea
      aria-label={ariaLabel}
      className={cx('easyx-ai-rich-editor__textarea', className)}
      disabled={disabled}
      id={id}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={ref}
      rows={rows}
      value={value}
    />
  );
}
