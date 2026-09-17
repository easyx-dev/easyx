/**
 * 代码面板的语法高亮配色
 *
 * 高亮类名由 CodeMirror 运行时生成（哈希类名），无法在 SCSS 里书写选择器，
 * 因此配色只能在这里声明；但色值一律引用 CSS 变量，主题切换仍由样式层完成，
 * 宿主覆盖 --easyx-ai-rich-editor-code-* 即可定制高亮配色。
 */
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/** 语法高亮配色：tag → CSS 变量（亮暗取值由 _variables.scss 提供） */
const highlightStyle = HighlightStyle.define([
  // 标签名（HTML 元素、CSS 选择器）
  { tag: tags.tagName, color: 'var(--easyx-ai-rich-editor-code-tag)' },
  { tag: tags.typeName, color: 'var(--easyx-ai-rich-editor-code-tag)' },
  // 属性名与变量名
  { tag: tags.attributeName, color: 'var(--easyx-ai-rich-editor-code-attr)' },
  { tag: tags.variableName, color: 'var(--easyx-ai-rich-editor-code-attr)' },
  {
    tag: tags.function(tags.variableName),
    color: 'var(--easyx-ai-rich-editor-code-attr)',
  },
  // 字符串与属性值
  { tag: tags.string, color: 'var(--easyx-ai-rich-editor-code-string)' },
  {
    tag: tags.special(tags.string),
    color: 'var(--easyx-ai-rich-editor-code-string)',
  },
  {
    tag: tags.attributeValue,
    color: 'var(--easyx-ai-rich-editor-code-string)',
  },
  // CSS 属性与对象成员
  {
    tag: tags.propertyName,
    color: 'var(--easyx-ai-rich-editor-code-property)',
  },
  { tag: tags.labelName, color: 'var(--easyx-ai-rich-editor-code-property)' },
  // 关键字
  { tag: tags.keyword, color: 'var(--easyx-ai-rich-editor-code-keyword)' },
  {
    tag: tags.controlKeyword,
    color: 'var(--easyx-ai-rich-editor-code-keyword)',
  },
  {
    tag: tags.definitionKeyword,
    color: 'var(--easyx-ai-rich-editor-code-keyword)',
  },
  {
    tag: tags.operatorKeyword,
    color: 'var(--easyx-ai-rich-editor-code-keyword)',
  },
  // 数字、单位与颜色值
  { tag: tags.number, color: 'var(--easyx-ai-rich-editor-code-number)' },
  { tag: tags.unit, color: 'var(--easyx-ai-rich-editor-code-number)' },
  { tag: tags.color, color: 'var(--easyx-ai-rich-editor-code-number)' },
  // 注释
  {
    tag: tags.comment,
    color: 'var(--easyx-ai-rich-editor-code-comment)',
    fontStyle: 'italic',
  },
  // 标点与括号：弱化，避免抢占视觉焦点
  { tag: tags.punctuation, color: 'var(--easyx-ai-rich-editor-code-punct)' },
  { tag: tags.bracket, color: 'var(--easyx-ai-rich-editor-code-punct)' },
  { tag: tags.separator, color: 'var(--easyx-ai-rich-editor-code-punct)' },
  // 语法错误（极少出现，用于兜底提示）
  { tag: tags.invalid, color: 'var(--easyx-ai-rich-editor-danger)' },
]);

/** 语法高亮扩展 */
export const codeHighlighting = syntaxHighlighting(highlightStyle);
