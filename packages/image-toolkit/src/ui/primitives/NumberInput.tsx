/**
 * 数字输入：原生 number 输入框 + 单位后缀
 *
 * 输入过程中保留用户的原始文本（draft），失焦或回车时才夹取到 min/max 并回写，
 * 避免输入「16」时被立刻夹到下限。
 */
import { type ReactNode, useState } from 'react';
import { cx } from '../utils/cx';

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** 单位等后缀，如 px */
  suffix?: ReactNode;
  /** 控件宽度（px） */
  width?: number;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  suffix,
  width,
  id,
  'aria-label': ariaLabel,
  className,
}: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  /** 提交：夹取到区间内并取整（宽高等均为整数像素） */
  const commit = (raw: string) => {
    setDraft(null);
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    next = Math.round(next);
    if (next !== value) onChange(next);
  };

  return (
    <span
      className={cx(
        'easyx-image-toolkit__number',
        disabled && 'easyx-image-toolkit__number--disabled',
        className,
      )}
      style={width === undefined ? undefined : { width }}
    >
      <input
        aria-label={ariaLabel}
        className="easyx-image-toolkit__number-input"
        disabled={disabled}
        id={id}
        inputMode="numeric"
        max={max}
        min={min}
        onBlur={(event) => commit(event.target.value)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          }
        }}
        step={step}
        type="number"
        value={draft ?? String(value)}
      />
      {suffix !== undefined && (
        <span className="easyx-image-toolkit__number-suffix">{suffix}</span>
      )}
    </span>
  );
}
