/**
 * 浮层通用行为：外部点击 / Esc 关闭、焦点循环
 *
 * 下拉菜单、Tooltip、模态框共用同一套判定，避免各自实现出不一致的关闭时机。
 * 不提供滚动锁：包内浮层要么是就地渲染的模态框，要么是不阻塞滚动的菜单/提示。
 */
import { type RefObject, useEffect } from 'react';

/** 可获得焦点的元素 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * 点击浮层外部或按 Esc 时关闭
 * 以 mousedown 判定，避免在浮层内拖拽（如选中文本）后于外部松开被误关
 *
 * `ignore` 用于排除锚点/触发元素：它们内部的 mousedown 不算外部点击，
 * 开合交给锚点自己处理。这不只是语义问题 —— React 会在同一次 DOM 事件内
 * 同步 flush 副作用，若浮层由某次 mousedown 打开（如代码面板的 gutter 入口），
 * 不排除该元素就会让这次 mousedown 命中「外部点击」，浮层刚挂载就被关掉。
 */
export function useDismissableLayer(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onDismiss: () => void,
  ignore?: HTMLElement | null,
): void {
  useEffect(() => {
    if (!enabled) return;
    const onMouseDown = (event: MouseEvent) => {
      const node = ref.current;
      if (!node) return;
      const target = event.target as Node;
      if (node.contains(target)) return;
      if (ignore?.contains(target)) return;
      onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, enabled, onDismiss, ignore]);
}

/** 焦点锁在容器内循环，并在卸载时归还给打开前的元素 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null;
    const container = ref.current;
    const first = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? container)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !container) return;
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstItem || active === container)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [ref, enabled]);
}
