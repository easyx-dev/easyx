/**
 * 开关：原生 checkbox + CSS 轨道
 */
import type { ReactNode } from 'react';
import { cx } from '../cx';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 开状态文案（显示在轨道右侧） */
  checkedChildren?: ReactNode;
  unCheckedChildren?: ReactNode;
  'aria-label'?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  disabled,
  checkedChildren,
  unCheckedChildren,
  'aria-label': ariaLabel,
  className,
}: SwitchProps) {
  const text = checked ? checkedChildren : unCheckedChildren;
  return (
    <label className={cx('easyx-ai-rich-editor__switch', className)}>
      <input
        aria-label={ariaLabel}
        aria-checked={checked}
        checked={checked}
        className="easyx-ai-rich-editor__switch-input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        role="switch"
        type="checkbox"
      />
      <span className="easyx-ai-rich-editor__switch-track" />
      {text !== undefined && text !== null && (
        <span className="easyx-ai-rich-editor__switch-text">{text}</span>
      )}
    </label>
  );
}
