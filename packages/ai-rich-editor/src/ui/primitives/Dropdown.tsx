/**
 * 下拉菜单：触发元素 + portal 菜单，floating-ui 定位
 *
 * 支持方向键在菜单项间移动、Esc 关闭并把焦点还给触发元素。
 */
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom';
import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cx, isScopeDark, scopeClass } from '../cx';
import { useDismissableLayer } from '../hooks/overlay';

export interface DropdownItem {
  key: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  /** 触发元素（注入点击与展开态） */
  trigger: ReactElement<Record<string, unknown>>;
  items: ReadonlyArray<DropdownItem>;
  onSelect: (key: string) => void;
  placement?: 'bottom-start' | 'bottom-end';
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  placement = 'bottom-end',
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      anchorRef.current?.querySelector<HTMLElement>('button')?.focus();
    }
  }, []);

  useDismissableLayer(menuRef, open, () => close(false));

  // 打开时定位并把焦点移到首项
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    setDark(isScopeDark(anchor));
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    return autoUpdate(anchor, menu, () => {
      void computePosition(anchor, menu, {
        placement,
        middleware: [offset(4), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
      });
    });
  }, [open, placement]);

  /** 上下键在菜单项之间移动焦点 */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    ).filter((node) => !(node as HTMLButtonElement).disabled);
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? nodes[(index + 1) % nodes.length]
        : nodes[(index - 1 + nodes.length) % nodes.length];
    next.focus();
  };

  return (
    <>
      <span className="easyx-ai-rich-editor__dropdown" ref={anchorRef}>
        {cloneElement(trigger, {
          'aria-expanded': open,
          'aria-haspopup': 'menu',
          onClick: () => setOpen((prev) => !prev),
        })}
      </span>
      {open &&
        createPortal(
          <div
            className={cx(scopeClass(dark), 'easyx-ai-rich-editor__menu')}
            onKeyDown={handleKeyDown}
            ref={menuRef}
            role="menu"
          >
            {items.map((item) => (
              <button
                className="easyx-ai-rich-editor__menu-item"
                disabled={item.disabled}
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  close();
                }}
                role="menuitem"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
