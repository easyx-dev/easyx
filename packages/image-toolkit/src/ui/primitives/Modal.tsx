/**
 * 弹窗：portal + 遮罩 + 焦点管理
 *
 * 关闭即卸载（不保留隐藏 DOM），因此内部裁切器等测量容器尺寸的组件不会在隐藏态
 * 算出 0 尺寸的裁切区。
 */
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { cx, scopeClass } from '../utils/cx';
import { Button } from './Button';
import { IconClose } from './icons';

/** 可获得焦点的元素 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  /**
   * 显式主题：弹窗渲染在 portal 中，宿主若把 data-theme 挂在 html 之外的祖先上，
   * 该祖先不会被弹窗继承；此时用本属性指定
   */
  theme?: 'light' | 'dark';
  /** 面板宽度，默认 min(720px, 92vw) */
  width?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Tab 键在面板内循环，避免焦点跑到底层页面 */
function trapTab(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Tab') return;
  const panel = event.currentTarget;
  const items = Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function Modal({
  open,
  title,
  theme,
  width,
  onClose,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // 打开时把焦点移入面板，关闭时归还给打开前的元素
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel)?.focus();
    return () => previous?.focus?.();
  }, [open]);

  // 打开期间锁背景滚动
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cx(
        scopeClass(theme === 'dark'),
        'easyx-image-toolkit__overlay',
      )}
      onMouseDown={(event) => {
        // 用 mousedown 判断，避免在面板内拖拽（如裁切）后在遮罩上松开误关闭
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="easyx-image-toolkit__modal"
        onKeyDown={trapTab}
        ref={panelRef}
        role="dialog"
        style={
          width === undefined
            ? undefined
            : ({ '--easyx-image-toolkit-modal-width': width } as CSSProperties)
        }
        tabIndex={-1}
      >
        <div className="easyx-image-toolkit__modal-head">
          <h2 className="easyx-image-toolkit__modal-title" id={titleId}>
            {title}
          </h2>
          <Button
            aria-label="关闭"
            icon={<IconClose />}
            iconOnly
            onClick={onClose}
            variant="text"
          />
        </div>
        <div className="easyx-image-toolkit__modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
