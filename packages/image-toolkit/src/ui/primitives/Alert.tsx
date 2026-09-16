/**
 * 行内提示：错误与需要用户行动的提示才用，普通说明走 Hint
 */
import type { ReactNode } from 'react';
import { cx } from '../utils/cx';
import {
  IconErrorCircle,
  IconInfoCircle,
  IconSuccessCircle,
  IconWarningTriangle,
} from './icons';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

const ICONS: Record<AlertType, typeof IconInfoCircle> = {
  info: IconInfoCircle,
  success: IconSuccessCircle,
  warning: IconWarningTriangle,
  error: IconErrorCircle,
};

export interface AlertProps {
  type?: AlertType;
  title?: ReactNode;
  description?: ReactNode;
  showIcon?: boolean;
  /** 右侧动作区，如「重试」 */
  action?: ReactNode;
  className?: string;
}

export function Alert({
  type = 'info',
  title,
  description,
  showIcon,
  action,
  className,
}: AlertProps) {
  const Icon = ICONS[type];
  return (
    <div
      className={cx(
        'easyx-image-toolkit__alert',
        `easyx-image-toolkit__alert--${type}`,
        className,
      )}
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
    >
      {showIcon && (
        <span className="easyx-image-toolkit__alert-icon">
          <Icon />
        </span>
      )}
      <div className="easyx-image-toolkit__alert-body">
        {title !== undefined && (
          <div className="easyx-image-toolkit__alert-title">{title}</div>
        )}
        {description !== undefined && (
          <div className="easyx-image-toolkit__alert-desc">{description}</div>
        )}
      </div>
      {action !== undefined && (
        <div className="easyx-image-toolkit__alert-action">{action}</div>
      )}
    </div>
  );
}
