/**
 * 下拉选择：原生 select + 自绘箭头
 *
 * 选项值允许 null（如「不降色（真彩）」），原生 value 只能用字符串，
 * 故统一经 serialize 映射，null 对应空串。
 */
import { cx } from '../utils/cx';
import { IconCaretDown } from './icons';

export interface SelectOption<T extends string | number | null> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number | null> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  disabled?: boolean;
  /** 控件宽度（px） */
  width?: number;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/** 选项值 → 原生 select 的字符串值（null 用空串表示） */
function serialize(value: string | number | null): string {
  return value === null ? '' : String(value);
}

export function Select<T extends string | number | null>({
  value,
  onChange,
  options,
  disabled,
  width,
  id,
  'aria-label': ariaLabel,
  className,
}: SelectProps<T>) {
  return (
    <span className={cx('easyx-image-toolkit__select', className)}>
      <select
        aria-label={ariaLabel}
        className="easyx-image-toolkit__select-input"
        disabled={disabled}
        id={id}
        onChange={(event) => {
          const matched = options.find(
            (option) => serialize(option.value) === event.target.value,
          );
          if (matched) onChange(matched.value);
        }}
        style={width === undefined ? undefined : { width }}
        value={serialize(value)}
      >
        {options.map((option) => (
          <option
            disabled={option.disabled}
            key={serialize(option.value)}
            value={serialize(option.value)}
          >
            {option.label}
          </option>
        ))}
      </select>
      <span className="easyx-image-toolkit__select-caret">
        <IconCaretDown />
      </span>
    </span>
  );
}
