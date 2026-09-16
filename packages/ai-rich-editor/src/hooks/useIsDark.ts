/**
 * 主题暗色判定 hook
 *
 * 判定优先级与包内样式一致：令牌作用域上的暗色 class（easyx-ai-rich-editor-scope-dark）
 * → 最近的宿主 [data-theme] 祖先（值以 dark 结尾，如 dark / admin-dark）
 * → 未声明主题时跟随系统 prefers-color-scheme。
 * 三处任一变化都实时联动（属性监听 + 媒体查询订阅）。
 *
 * 说明：Monaco 读不到 CSS 变量，只能由本 hook 把判定结果交给它，因此这份判定
 * 必须与 src/styles/_variables.scss 的 theme-scope 保持一致。
 */
import { type RefObject, useEffect, useState } from 'react';

const DARK_CLASS = 'easyx-ai-rich-editor-scope-dark';
const ROOT_CLASS = 'easyx-ai-rich-editor-scope';
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
