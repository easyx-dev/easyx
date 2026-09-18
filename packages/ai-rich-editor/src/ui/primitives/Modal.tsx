/**
 * 模态框：就地渲染在挂载点内（不 portal），遮罩覆盖宿主容器
 *
 * 与抽屉的区别：模态框属于「组件内的一块界面」，而不是脱离宿主层级的浮层，
 * 因此不锁 body 滚动、不重建令牌作用域 —— 主题与布局都由所在容器决定。
 * 高度随内容自适应、以 maxHeightRatio 封顶，超出后仅内容区滚动，短内容不留空。
 * 关闭即卸载；Esc、遮罩点击均可关闭，焦点在面板内循环并在关闭时归还。
 */
import { type ReactNode, useId, useRef } from 'react';
import { useDismissableLayer, useFocusTrap } from '../hooks/overlay';
import { IconClose } from '../icons';
import { Button } from './Button';

/** 对话框宽度上限（px） */
const DEFAULT_MAX_WIDTH = 800;
/** 对话框高度上限（占容器比例） */
const DEFAULT_MAX_HEIGHT_RATIO = 0.9;

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  /** 底部常驻操作区（如取消 / 保存），内容滚动时保持可见 */
  footer?: ReactNode;
  /** 高度上限占容器的比例 */
  maxHeightRatio?: number;
  /** 宽度上限（px） */
  maxWidth?: number;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({
  open,
  title,
  footer,
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
  maxWidth = DEFAULT_MAX_WIDTH,
  onClose,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDismissableLayer(panelRef, open, onClose);
  useFocusTrap(panelRef, open);

  if (!open) return null;

  return (
    <div className="easyx-ai-rich-editor__modal">
      <div className="easyx-ai-rich-editor__modal-overlay" />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="easyx-ai-rich-editor__modal-panel"
        ref={panelRef}
        role="dialog"
        style={{ maxHeight: `${maxHeightRatio * 100}%`, maxWidth }}
        tabIndex={-1}
      >
        <header className="easyx-ai-rich-editor__modal-head">
          <h2 className="easyx-ai-rich-editor__modal-title" id={titleId}>
            {title}
          </h2>
          <Button
            aria-label="关闭"
            icon={<IconClose />}
            iconOnly
            onClick={onClose}
            size="sm"
            variant="text"
          />
        </header>
        <div className="easyx-ai-rich-editor__modal-body">{children}</div>
        {footer !== undefined && (
          <footer className="easyx-ai-rich-editor__modal-foot">{footer}</footer>
        )}
      </div>
    </div>
  );
}
