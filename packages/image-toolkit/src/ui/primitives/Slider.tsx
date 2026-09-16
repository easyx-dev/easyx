/**
 * 滑杆：原生 range + 就地数值回显
 *
 * 数值回显常驻而非拖拽气泡：省掉浮层定位与焦点打断，触屏上也更易读。
 */
import { cx } from '../utils/cx';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** 数值回显格式，默认直接展示数字 */
  format?: (value: number) => string;
  'aria-label'?: string;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  format,
  'aria-label': ariaLabel,
  className,
}: SliderProps) {
  return (
    <div className={cx('easyx-image-toolkit__slider', className)}>
      <input
        aria-label={ariaLabel}
        className="easyx-image-toolkit__slider-input"
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <span className="easyx-image-toolkit__slider-value">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
