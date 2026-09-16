/**
 * 折叠块：基于原生 details/summary，展开态与键盘操作由浏览器承担
 */
import type { ReactNode } from 'react';
import { cx } from '../cx';

export interface CollapseProps {
  title: ReactNode;
  /** 是否展开 */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function Collapse({
  title,
  defaultOpen = false,
  children,
  className,
}: CollapseProps) {
  return (
    <details
      className={cx('easyx-ai-rich-editor__collapse', className)}
      open={defaultOpen}
    >
      <summary className="easyx-ai-rich-editor__collapse-summary">
        {title}
      </summary>
      <div className="easyx-ai-rich-editor__collapse-body">{children}</div>
    </details>
  );
}
