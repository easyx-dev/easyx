/**
 * 令牌作用域类名
 *
 * 令牌定义在 .easyx-ai-rich-editor-scope 上；主容器与所有 portal 到 body 的浮层
 * （抽屉、下拉、Tooltip、轻提示）都要带上它，否则脱离宿主 DOM 层级后拿不到 CSS 变量。
 */

/** 令牌作用域类名 */
export const SCOPE_CLASS = 'easyx-ai-rich-editor-scope';

/** 显式暗色类名 */
const SCOPE_DARK_CLASS = 'easyx-ai-rich-editor-scope-dark';

/** 拼接类名：过滤假值后以空格连接 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** portal 根类名：带上令牌作用域，dark 为显式指定的主题 */
export function scopeClass(dark?: boolean): string {
  return cx(SCOPE_CLASS, dark ? SCOPE_DARK_CLASS : undefined);
}

/** 元素所处的令牌作用域是否为暗色（容器 class 路径；data-theme 路径由 CSS 负责） */
export function isScopeDark(el: Element | null): boolean {
  return el?.closest(`.${SCOPE_DARK_CLASS}`) !== null;
}
