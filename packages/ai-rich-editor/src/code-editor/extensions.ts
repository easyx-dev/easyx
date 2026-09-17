/**
 * 代码面板的扩展装配
 *
 * 只保留 HTML 片段编辑真正需要的能力：行号、当前行、多选区、撤销、括号匹配、
 * 补全（标签/属性/内嵌 CSS 与 JS）、查找替换、语法高亮。
 * 不引入 lint / 折叠 / 语言服务等重能力。
 */
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
} from '@codemirror/language';
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from '@codemirror/search';
import {
  type Compartment,
  EditorState,
  type Extension,
} from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { codePhrases } from './phrases';
import { codeHighlighting } from './theme';

/** 缩进宽度：与包内 HTML 片段的书写风格一致 */
const INDENT_UNIT = '  ';

export interface CodeExtensionsOptions {
  /** 亮暗对应的 Compartment，主题切换时由调用方 reconfigure */
  darkTheme: Compartment;
  /** 当前是否暗色 */
  isDark: boolean;
  /** 文档内容变化（用户输入或程序改动）时回调 */
  onDocChange: (doc: string) => void;
}

/** 装配代码编辑器扩展 */
export function createCodeExtensions({
  darkTheme,
  isDark,
  onDocChange,
}: CodeExtensionsOptions): Extension[] {
  return [
    // 视觉与交互基线
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    rectangularSelection(),
    crosshairCursor(),
    EditorView.lineWrapping,

    // 编辑行为
    history(),
    indentOnInput(),
    indentUnit.of(INDENT_UNIT),
    EditorState.tabSize.of(INDENT_UNIT.length),
    bracketMatching(),
    closeBrackets(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),

    // HTML 语法：内嵌 <style>/<script> 的 CSS 与 JS 解析与补全由此一并获得
    html(),

    // 补全：autocompletion() 自带 completionKeymap，无需重复绑定
    autocompletion(),
    // 查找替换：面板置于顶部，与常见代码编辑器一致
    search({ top: true }),
    highlightSelectionMatches(),

    codeHighlighting,
    // 查找面板 / 补全列表 / 行跳转的中文文案
    codePhrases,
    // CodeMirror 内置扩展（光标 / 选区 / 当前行 / 面板）的亮暗变体由该 facet 决定，
    // 它读不到 CSS 变量，只能由调用方转达；语法高亮与结构色仍走 CSS 变量
    darkTheme.of(EditorView.darkTheme.of(isDark)),

    EditorView.contentAttributes.of({
      'aria-label': 'HTML 代码编辑器',
      spellcheck: 'false',
      autocorrect: 'off',
      autocapitalize: 'off',
    }),

    EditorView.updateListener.of((update) => {
      if (update.docChanged) onDocChange(update.state.doc.toString());
    }),
  ];
}
