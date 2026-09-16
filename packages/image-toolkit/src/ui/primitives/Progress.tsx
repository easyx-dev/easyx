/**
 * 进度条：percent 为 null 时切到不确定态（下载总长未知的场景）
 */
import { cx } from '../utils/cx';

export interface ProgressProps {
  /** 进度百分比；null 表示总长未知 */
  percent?: number | null;
  'aria-label'?: string;
  className?: string;
}

export function Progress({
  percent = null,
  'aria-label': ariaLabel,
  className,
}: ProgressProps) {
  const indeterminate = percent === null;
  return (
    <div
      aria-label={ariaLabel}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={indeterminate ? undefined : Math.round(percent)}
      className={cx('easyx-image-toolkit__progress', className)}
      role="progressbar"
    >
      <div className="easyx-image-toolkit__progress-track">
        <div
          className={cx(
            'easyx-image-toolkit__progress-bar',
            indeterminate && 'easyx-image-toolkit__progress-bar--indeterminate',
          )}
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
      {!indeterminate && (
        <span className="easyx-image-toolkit__progress-value">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}
