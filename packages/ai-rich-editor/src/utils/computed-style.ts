/**
 * 计算样式摘要（用于预览右键定向修改的上下文）
 *
 * 只把「能影响模型判断」的少量属性摘出来，避免把整份 computed style 塞进上下文。
 * 传入只读访问器而非 DOM 元素，是为了保持纯函数、可单测；DOM 侧用
 * `frame.contentWindow.getComputedStyle(el)` 的结果即可（同源预览可读）。
 */

/** 摘要包含的属性（顺序即输出顺序） */
export const SUMMARY_STYLE_PROPS: readonly string[] = [
  'display',
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'line-height',
  'text-align',
  'margin',
  'padding',
  'border',
  'border-radius',
];

/** 可读取计算值的访问器（CSSStyleDeclaration.getPropertyValue） */
export interface ComputedStyleReader {
  getPropertyValue(property: string): string;
}

/** 视为噪音的取值：默认值 / 零值 / 全透明 */
const NOISE_VALUES = new Set([
  'none',
  'normal',
  'auto',
  '0px',
  'rgba(0, 0, 0, 0)',
  'transparent',
]);

/**
 * 生成 `color: rgb(102, 102, 102); font-size: 16px; …` 形式的摘要。
 * 空值与常见噪音值（`none` / `normal` / `0px` / 全透明）会被跳过；全部跳过时返回空串。
 */
export function summarizeComputedStyle(style: ComputedStyleReader): string {
  const parts: string[] = [];
  for (const prop of SUMMARY_STYLE_PROPS) {
    const value = style.getPropertyValue(prop).trim();
    if (!value || NOISE_VALUES.has(value)) continue;
    parts.push(`${prop}: ${value}`);
  }
  return parts.join('; ');
}
