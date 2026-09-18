/**
 * 光标行媒体入口（CodeMirror gutter）
 *
 * 为什么用原生 gutter 而不是绝对定位的 React 按钮：
 * - 入口位置随行号走，滚动、视口、行高都由 CodeMirror 自己算，不用手工对齐；
 * - 只在光标所在行渲染，行号槽不需要为它预留空白（预留会挤掉可拖选区域）。
 *
 * 关键实现点：
 * - `lineMarkerChange`：CodeMirror 默认只在文档/视口变化时重绘 gutter，
 *   光标行变化必须由该钩子显式声明，否则标记不跟随光标；
 * - `initialSpacer`：入口滚出视口时用它占位，避免 gutter 宽度塌陷导致内容横向跳动；
 * - `GutterMarker` 单例 + 默认 `compare`：标记内容不变时复用 DOM，不闪烁。
 */
import type { EditorState } from '@codemirror/state';
import { GutterMarker, gutter, type ViewUpdate } from '@codemirror/view';

/** 加号图标（与 ui/icons 的 IconPlus 同形，gutter 里直接建 DOM 故内联一份） */
const PLUS_ICON =
  '<svg aria-hidden="true" height="13" viewBox="0 0 24 24" width="13" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>';

/** 光标所在行的起始偏移 */
export function cursorLineFrom(state: EditorState): number {
  return state.doc.lineAt(state.selection.main.head).from;
}

/**
 * 光标行是否发生变化
 *
 * CodeMirror 默认只在文档/视口变化时重绘 gutter，光标行变化必须由
 * `lineMarkerChange` 显式声明；抽成纯函数以便单测钉住这条重绘契约。
 */
export function cursorLineChanged(update: ViewUpdate): boolean {
  return cursorLineFrom(update.startState) !== cursorLineFrom(update.state);
}

/** 创建入口按钮 DOM */
export function createAddButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'easyx-ai-rich-editor__code-add';
  button.setAttribute('aria-label', '插入媒体');
  button.title = '插入媒体';
  button.innerHTML = PLUS_ICON;
  return button;
}

/** 行标记：单例复用，内容恒定 */
class AddMediaMarker extends GutterMarker {
  elementClass = 'easyx-ai-rich-editor__gutter-add-marker';

  toDOM(): HTMLElement {
    return createAddButton();
  }
}

const addMarker = new AddMediaMarker();

export interface CursorAddGutterOptions {
  /** 点击入口：position 为该行起点，anchor 为入口按钮（供浮层定位） */
  onRequestInsert: (position: number, anchor: HTMLElement) => void;
}

/** 光标行媒体入口 gutter（置于行号槽左侧时需排在 lineNumbers 之前） */
export function cursorAddGutter({ onRequestInsert }: CursorAddGutterOptions) {
  return gutter({
    class: 'easyx-ai-rich-editor__gutter-add',
    domEventHandlers: {
      mousedown: (_view, line, event) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest('button');
        if (!anchor) return false;
        onRequestInsert(line.from, anchor);
        return true;
      },
    },
    initialSpacer: () => addMarker,
    lineMarker: (view, line) =>
      line.from === cursorLineFrom(view.state) ? addMarker : null,
    lineMarkerChange: cursorLineChanged,
  });
}
