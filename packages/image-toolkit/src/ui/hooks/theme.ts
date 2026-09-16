/**
 * 令牌作用域工具
 *
 * portal 到 body 的浮层会脱离宿主 DOM 层级，`[data-theme$='dark']` 祖先与容器 class
 * 都可能丢失；CSS 只能覆盖前者，容器 class 这条路径需要把结果显式带到浮层根上。
 */
import { SCOPE_DARK_CLASS } from '../utils/cx';

/** 触发元素所处的令牌作用域是否为暗色（容器 class 路径） */
export function isScopeDark(el: Element | null): boolean {
  return el?.closest(`.${SCOPE_DARK_CLASS}`) !== null;
}
