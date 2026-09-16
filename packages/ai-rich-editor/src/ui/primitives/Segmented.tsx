/**
 * 分段选择：一组原生 radio 渲染成按钮条
 *
 * 用真实 radio 而非自绘角色，方向键切换与分组语义由浏览器承担。
 */
import { type ReactNode, useId } from 'react';
import { cx } from '../cx';

export interface SegmentedOption<T extends string | number> {
  label: ReactNode;
  value: T;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** 整体禁用（与单个选项的 disabled 取或） */
  disabled?: boolean;
  /** radio 分组名；同页多个分段控件由 useId 自动区分 */
  name?: string;
  className?: string;
  'aria-label'?: string;
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  disabled,
  name,
  className,
  'aria-label': ariaLabel,
}: SegmentedProps<T>) {
  const autoName = useId();
  const groupName = name ?? autoName;

  return (
    <div
      aria-label={ariaLabel}
      className={cx('easyx-ai-rich-editor__segmented', className)}
      role="radiogroup"
    >
      {options.map((option) => (
        <label
          className="easyx-ai-rich-editor__segmented-item"
          key={String(option.value)}
        >
          <input
            checked={option.value === value}
            className="easyx-ai-rich-editor__segmented-input"
            disabled={disabled || option.disabled}
            name={groupName}
            onChange={() => onChange(option.value)}
            type="radio"
            value={String(option.value)}
          />
          <span className="easyx-ai-rich-editor__segmented-label">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
