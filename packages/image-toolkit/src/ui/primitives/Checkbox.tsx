/**
 * 勾选框：原生 checkbox + CSS 对勾
 */
import type { ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  children,
  className,
}: CheckboxProps) {
  return (
    <label className={cx('easyx-image-toolkit__checkbox', className)}>
      <input
        checked={checked}
        className="easyx-image-toolkit__checkbox-input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {children}
    </label>
  );
}
