/**
 * 分段选择：一组原生 radio 渲染成按钮条
 *
 * 用真实 radio 而非自绘角色，方向键切换、分组语义与表单关联都由浏览器承担。
 */
import { type ReactNode, useId } from 'react';
import { cx } from '../utils/cx';

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
  /** radio 分组名；同页多个分段控件时由 useId 自动区分，无需手动传 */
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
      className={cx('easyx-image-toolkit__segmented', className)}
      role="radiogroup"
    >
      {options.map((option) => (
        <label
          className="easyx-image-toolkit__segmented-item"
          key={String(option.value)}
        >
          <input
            checked={option.value === value}
            className="easyx-image-toolkit__segmented-input"
            disabled={disabled || option.disabled}
            name={groupName}
            onChange={() => onChange(option.value)}
            type="radio"
            value={String(option.value)}
          />
          <span className="easyx-image-toolkit__segmented-label">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
