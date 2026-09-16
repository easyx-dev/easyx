/**
 * 加载指示：有子内容时盖一层遮罩，无子内容时作为独立占位
 */
import type { ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface SpinProps {
  spinning?: boolean;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
  'aria-label'?: string;
  className?: string;
}

export function Spin({
  spinning = true,
  size = 'md',
  children,
  'aria-label': ariaLabel = '加载中',
  className,
}: SpinProps) {
  if (!spinning) return <>{children}</>;

  const indicator = (
    <span
      aria-hidden="true"
      className={cx(
        'easyx-image-toolkit__spinner',
        size !== 'md' && `easyx-image-toolkit__spinner--${size}`,
      )}
    />
  );

  if (children === undefined || children === null) {
    return (
      <div
        aria-label={ariaLabel}
        className="easyx-image-toolkit__spin-center"
        role="status"
      >
        {indicator}
      </div>
    );
  }

  return (
    <div className={cx('easyx-image-toolkit__spin-wrap', className)}>
      {children}
      <div
        aria-label={ariaLabel}
        className="easyx-image-toolkit__spin-mask"
        role="status"
      >
        {indicator}
      </div>
    </div>
  );
}
