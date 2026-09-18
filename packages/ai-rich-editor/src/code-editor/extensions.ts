/**
 * 代码面板的扩展装配
 *
 * 基线是 CodeMirror 官方默认：按 basicSetup 的组合装配（行号、特殊字符、撤销、
 * 括号匹配/闭合、自动补全、矩形选择、当前行高亮、选区匹配、折叠、查找快捷键、
 * 多光标），另加 HTML 语言、软换行、`indentWithTab` 与令牌语法高亮。
 *
 * 说明：不引入 `codemirror` 元包，而是用包内已有的 @codemirror/* 依赖拼出同一组合 ——
 * 元包会带进另一份 @codemirror/state，导致 instanceof 校验失败、编辑器直接装配不起来。
 * 相比官方 basicSetup 的差异：
 * - 少 `lintKeymap`（包内不做 lint）；
 * - 高亮不用 `defaultHighlightStyle`（面向浅色背景的固定色），改用 theme.ts 的令牌高亮，
 *   随亮暗主题切换；
 * - 补 `indentWithTab`（basicSetup 不含，Tab 会回退成移动焦点）。
 *
 * 在此基线上额外接回媒体插入（两条路径）：
 * - 行号左侧、跟随光标行的 gutter 入口（gutter-add.ts）；
 * - 文件拖入内容区，按落点插入片段。
 * 其余自研能力（行号槽整行选择、中文文案）仍未装配，代码保留在
 * gutter-line-select.ts / phrases.ts，需要时加回下面的扩展列表即可。
 */
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
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
  foldGutter,
  foldKeymap,
  indentOnInput,
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import {
  type Compartment,
  EditorState,
  type Extension,
} from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { cursorAddGutter, cursorLineFrom } from './gutter-add';
import { codeHighlighting } from './theme';

export interface CodeExtensionsOptions {
  /** 亮暗对应的 Compartment，主题切换时由调用方 reconfigure */
  darkTheme: Compartment;
  /** 当前是否暗色 */
  isDark: boolean;
  /** 文档内容变化（用户输入或程序改动）时回调 */
  onDocChange: (doc: string) => void;
  /**
   * 文件拖入内容区：接管后返回 true（阻止 CodeMirror 默认的文本落点处理）。
   * 位置为拖放点对应的文档偏移，调用方据此插入媒体片段。
   */
  onFilesDropped?: (files: File[], pos: number) => boolean;
  /** 点击行号左侧的媒体入口：position 为该行起点，anchor 为入口按钮 */
  onRequestMediaInsert?: (position: number, anchor: HTMLElement) => void;
  /** 光标所在行变化（供调用方收起依赖该行的界面） */
  onCursorLineChange?: (lineFrom: number) => void;
}

/** 装配代码编辑器扩展：CodeMirror 默认组合 + HTML 语言 + 软换行 + 媒体插入 */
export function createCodeExtensions({
  darkTheme,
  isDark,
  onDocChange,
  onFilesDropped,
  onRequestMediaInsert,
  onCursorLineChange,
}: CodeExtensionsOptions): Extension[] {
  return [
    // 行号左侧的媒体入口：排在 lineNumbers 之前才会显示在其左侧
    ...(onRequestMediaInsert
      ? [cursorAddGutter({ onRequestInsert: onRequestMediaInsert })]
      : []),

    // —— CodeMirror 默认组合（等价 basicSetup）——
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),

    // 文件拖入：交给调用方上传并在落点插入媒体片段；非文件拖拽保持 CodeMirror 默认行为
    ...(onFilesDropped
      ? [
          EditorView.domEventHandlers({
            dragover: (event) => {
              if (!event.dataTransfer?.types.includes('Files')) return false;
              // 必须阻止默认行为，否则浏览器不允许 drop
              event.preventDefault();
              return true;
            },
            drop: (event, view) => {
              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return false;
              event.preventDefault();
              const pos =
                view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
                view.state.selection.main.from;
              return onFilesDropped(Array.from(files), pos);
            },
          }),
        ]
      : []),

    // —— HTML 片段编辑需要的最小补充 ——
    html(),
    EditorView.lineWrapping,
    // 语法高亮走令牌（随亮暗切换），不用 CodeMirror 默认的浅色高亮配色
    codeHighlighting,

    // CodeMirror 内置扩展（光标 / 选区 / 当前行 / 面板）的亮暗变体由该 facet 决定，
    // 它读不到 CSS 变量，只能由调用方转达
    darkTheme.of(EditorView.darkTheme.of(isDark)),

    EditorView.contentAttributes.of({
      'aria-label': 'HTML 代码编辑器',
      spellcheck: 'false',
      autocorrect: 'off',
      autocapitalize: 'off',
    }),

    EditorView.updateListener.of((update) => {
      if (update.docChanged) onDocChange(update.state.doc.toString());
      if (onCursorLineChange && (update.selectionSet || update.docChanged)) {
        onCursorLineChange(cursorLineFrom(update.state));
      }
    }),
  ];
}
