/**
 * 主题暗色判定 hook
 *
 * 判定优先级与包内样式一致：容器 class（easyx-ai-rich-editor-dark）
 * → 最近的宿主 [data-theme] 祖先（值以 dark 结尾，如 dark / admin-dark）
 * → 未声明主题时跟随系统 prefers-color-scheme。
 * 三处任一变化都实时联动（属性监听 + 媒体查询订阅）。
 *
 * 注意：这里用 closest() 判定，包含元素自身；而包内样式用的是后代选择器
 * `[data-theme$='dark'] .easyx-ai-rich-editor`，要求 data-theme 在祖先上。
 * 二者只在「data-theme 恰好落在编辑器根元素本身」时才会分叉，
 * 当前公开 API 无法把该属性放到根元素上，故保持一致；改动根元素属性时需同步核对样式。
 */
import { type RefObject, useEffect, useState } from 'react';

const DARK_CLASS = 'easyx-ai-rich-editor-dark';
const ROOT_CLASS = 'easyx-ai-rich-editor';
const THEME_ATTR = 'data-theme';

/** 读取当前是否暗色；el 为编辑器内部任意元素 */
function detectIsDark(el: Element | null): boolean {
  if (typeof document === 'undefined') return false;

  const root = el?.closest(`.${ROOT_CLASS}`) ?? null;
  if (root?.classList.contains(DARK_CLASS)) return true;

  // 宿主主题挂在编辑器容器自身或其祖先上，值形如 admin-dark 或 dark
  const themed = root?.closest(`[${THEME_ATTR}]`);
  const declared = themed?.getAttribute(THEME_ATTR);
  if (declared) return declared.endsWith('dark');

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/**
 * 订阅暗色主题，随容器 class / 宿主 data-theme / 系统偏好变化实时联动
 * @param ref 编辑器内部元素引用；省略时按文档根判定
 */
export function useIsDark(ref?: RefObject<HTMLElement | null>): boolean {
  const [isDark, setIsDark] = useState(() =>
    detectIsDark(ref?.current ?? null),
  );

  useEffect(() => {
    const update = () => setIsDark(detectIsDark(ref?.current ?? null));
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [THEME_ATTR, 'class'],
      subtree: true,
    });

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', update);

    return () => {
      observer.disconnect();
      media?.removeEventListener('change', update);
    };
  }, [ref]);

  return isDark;
}
