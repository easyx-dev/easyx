/**
 * 轻提示：模块级单例，直接挂 DOM 到 body
 *
 * 不依赖 React 组件树 —— 提示可能由包内任意位置的默认回调触发（如复制代码），
 * 用一个常驻宿主元素最省事，也避免要求宿主先挂载某个 Provider。
 * 宿主与每条提示都带上令牌作用域类，脱离宿主 DOM 后样式依然成立。
 */
import { SCOPE_CLASS } from './cx';

export type ToastType = 'success' | 'warning' | 'error';

/** 单条提示的存活时长（ms） */
const DURATION = 2400;

/** 同时最多保留的提示条数 */
const MAX_VISIBLE = 3;

let host: HTMLDivElement | null = null;

/** 取得（必要时创建）常驻宿主元素 */
function ensureHost(): HTMLDivElement {
  if (host && document.body.contains(host)) return host;
  host = document.createElement('div');
  host.className = `${SCOPE_CLASS} easyx-ai-rich-editor__toast-host`;
  document.body.appendChild(host);
  return host;
}

/** 弹出一条轻提示，到时自动移除 */
export function toast(type: ToastType, content: string): void {
  if (typeof document === 'undefined') return;

  const item = document.createElement('div');
  item.className = `easyx-ai-rich-editor__toast easyx-ai-rich-editor__toast--${type}`;
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  item.textContent = content;

  const box = ensureHost();
  box.appendChild(item);
  while (box.childElementCount > MAX_VISIBLE) box.firstElementChild?.remove();

  window.setTimeout(() => item.remove(), DURATION);
}
