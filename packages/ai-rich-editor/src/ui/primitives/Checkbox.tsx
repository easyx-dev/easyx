/**
 * 勾选框：原生 checkbox + 自绘方框
 *
 * 原生控件视觉隐藏但保留键盘与无障碍语义，方框与对勾由 CSS 绘制；
 * 传入标签内容时，整块区域可点，用于顶栏的紧凑开关。
 * 其余属性透传到 label 供包裹层（如 Tooltip）注入事件；`aria-describedby`
 * 例外，落到原生控件上，才能被辅助技术随勾选框一并播报。
 */
import type { LabelHTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

export interface CheckboxProps
  extends Omit<
    LabelHTMLAttributes<HTMLLabelElement>,
    'onChange' | 'children' | 'aria-label'
  > {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 标签内容，与方框共同构成可点区域 */
  children?: ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  className,
  ...rest
}: CheckboxProps) {
  return (
    <label
      className={cx('easyx-ai-rich-editor__checkbox', className)}
      {...rest}
    >
      <input
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        checked={checked}
        className="easyx-ai-rich-editor__checkbox-input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="easyx-ai-rich-editor__checkbox-box" />
      {children !== undefined && children !== null && (
        <span className="easyx-ai-rich-editor__checkbox-label">{children}</span>
      )}
    </label>
  );
}
