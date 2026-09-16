/**
 * 类名工具与令牌作用域
 *
 * 令牌定义在 .easyx-image-toolkit 上。凡 portal 到 body 的浮层（弹窗、Tooltip）
 * 都必须在自身根节点补上该类，否则脱离宿主 DOM 层级后拿不到 CSS 变量。
 */

/** 令牌作用域类名 */
const SCOPE_CLASS = 'easyx-image-toolkit';

/** 显式暗色类名（宿主未用 data-theme 时的兜底） */
export const SCOPE_DARK_CLASS = 'easyx-image-toolkit-dark';

/** 拼接类名：过滤假值后以空格连接 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** portal 根类名：带上令牌作用域，dark 为宿主显式指定的主题 */
export function scopeClass(dark?: boolean): string {
  return cx(SCOPE_CLASS, dark ? SCOPE_DARK_CLASS : undefined);
}
