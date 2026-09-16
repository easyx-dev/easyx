/**
 * 行内提示：对话错误等需要用户注意的情形
 */
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { IconErrorCircle, IconInfoCircle, IconWarningTriangle } from '../icons';

export type AlertType = 'info' | 'warning' | 'error';

const ICONS = {
  info: IconInfoCircle,
  warning: IconWarningTriangle,
  error: IconErrorCircle,
};

export interface AlertProps {
  type?: AlertType;
  title?: ReactNode;
  description?: ReactNode;
  showIcon?: boolean;
  className?: string;
}

export function Alert({
  type = 'info',
  title,
  description,
  showIcon,
  className,
}: AlertProps) {
  const Icon = ICONS[type];
  return (
    <div
      className={cx(
        'easyx-ai-rich-editor__alert',
        `easyx-ai-rich-editor__alert--${type}`,
        className,
      )}
      role={type === 'error' ? 'alert' : 'status'}
    >
      {showIcon && (
        <span className="easyx-ai-rich-editor__alert-icon">
          <Icon />
        </span>
      )}
      <div className="easyx-ai-rich-editor__alert-body">
        {title !== undefined && (
          <div className="easyx-ai-rich-editor__alert-title">{title}</div>
        )}
        {description !== undefined && (
          <div className="easyx-ai-rich-editor__alert-desc">{description}</div>
        )}
      </div>
    </div>
  );
}
