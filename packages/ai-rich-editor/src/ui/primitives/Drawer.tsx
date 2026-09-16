/**
 * 抽屉：右侧滑出面板，portal + 遮罩 + 焦点管理
 *
 * 关闭即卸载；打开期间锁背景滚动，Esc 与遮罩点击均可关闭。
 */
import { type ReactNode, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { scopeClass } from '../cx';
import {
  useDismissableLayer,
  useFocusTrap,
  useScrollLock,
} from '../hooks/overlay';
import { IconClose } from '../icons';
import { Button } from './Button';

export interface DrawerProps {
  open: boolean;
  title: ReactNode;
  /** 面板宽度（px） */
  width?: number;
  /** 头部右侧操作区（如取消 / 保存） */
  extra?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function Drawer({
  open,
  title,
  width = 420,
  extra,
  onClose,
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDismissableLayer(panelRef, open, onClose);
  useFocusTrap(panelRef, open);
  useScrollLock(open);

  if (!open) return null;

  return createPortal(
    <div className={scopeClass(false)}>
      <div className="easyx-ai-rich-editor__drawer-overlay" />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="easyx-ai-rich-editor__drawer"
        ref={panelRef}
        role="dialog"
        style={{ width }}
        tabIndex={-1}
      >
        <header className="easyx-ai-rich-editor__drawer-head">
          <h2 className="easyx-ai-rich-editor__drawer-title" id={titleId}>
            {title}
          </h2>
          <div className="easyx-ai-rich-editor__drawer-actions">
            {extra}
            <Button
              aria-label="关闭"
              icon={<IconClose />}
              iconOnly
              onClick={onClose}
              size="sm"
              variant="text"
            />
          </div>
        </header>
        <div className="easyx-ai-rich-editor__drawer-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
