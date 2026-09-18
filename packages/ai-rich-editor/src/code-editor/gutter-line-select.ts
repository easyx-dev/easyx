/**
 * 行号槽整行选择（VS Code 风格）
 *
 * 行号槽设为 user-select: none 是为了避免「拖出一串行号」这种假选区，
 * 但它同时把「按在行号上再横向拖入正文」变成了死区 —— 什么都选不中。
 * 这里在行号槽上补一条与主流编辑器一致的语义：按下选中整行，拖动按行扩展。
 *
 * 实现要点：
 * - 挂在 lineNumbers 的 domEventHandlers 上，直接拿到按下位置所在的 BlockInfo，
 *   不必自己在坐标与行号之间换算；
 * - `lineBlockAtHeight` 给出的是「视觉行」块，软换行后的第二行其 from 落在逻辑行中间，
 *   统一经 `doc.lineAt(...)` 归一到逻辑行，否则一行会被拆成多段；
 * - 行号只决定选中「哪些行」，选区仍落在正文偏移上，因此拖入正文后就是普通文本选区，
 *   复制、缩进等命令都可直接作用；
 * - 拖拽期间在 document 上监听，指针移出行号槽进入正文也继续按行扩展。
 */

import type { EditorState, Line } from '@codemirror/state';
import type { BlockInfo, EditorView } from '@codemirror/view';

/** 整行选区的起止（按拖拽方向决定 caret 落在哪一端） */
export function lineSelectionRange(
  state: EditorState,
  anchorFrom: number,
  headFrom: number,
): { anchor: number; head: number } {
  const anchor = state.doc.lineAt(anchorFrom);
  const head = state.doc.lineAt(headFrom);
  return anchor.from <= head.from
    ? { anchor: anchor.from, head: head.to }
    : { anchor: anchor.to, head: head.from };
}

/** 鼠标高度对应的逻辑行（视觉行块归一到逻辑行） */
function lineAtHeight(view: EditorView, clientY: number): Line {
  return view.state.doc.lineAt(
    view.lineBlockAtHeight(clientY - view.documentTop).from,
  );
}

/** lineNumbers 的 mousedown 处理器 */
export type GutterMouseDownHandler = (
  view: EditorView,
  block: BlockInfo,
  event: Event,
) => boolean;

export interface GutterLineSelection {
  /**
   * 传给 lineNumbers 的 mousedown 处理器；同时供媒体入口 gutter
   * 在非按钮空白区复用，避免行号槽左侧留下拖拽死区。
   */
  onMouseDown: GutterMouseDownHandler;
}

/** 创建行号槽整行选择处理器（每个编辑器实例一份，闭包持有拖拽状态） */
export function gutterLineSelection(): GutterLineSelection {
  let dragging: {
    view: EditorView;
    doc: Document;
    anchorFrom: number;
  } | null = null;

  const apply = (view: EditorView, anchorFrom: number, headFrom: number) => {
    view.dispatch({
      selection: lineSelectionRange(view.state, anchorFrom, headFrom),
      userEvent: 'select.pointer',
    });
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!dragging) return;
    // 松手发生在编辑器外（例如预览 iframe 里）时收不到 mouseup，
    // 用 buttons 兜底，避免之后无按键移动还继续扩选
    if (event.buttons === 0 || !dragging.view.dom.isConnected) {
      stopDrag();
      return;
    }
    const line = lineAtHeight(dragging.view, event.clientY);
    apply(dragging.view, dragging.anchorFrom, line.from);
  };

  const stopDrag = () => {
    if (!dragging) return;
    dragging.doc.removeEventListener('mousemove', onMouseMove);
    dragging.doc.removeEventListener('mouseup', stopDrag);
    dragging = null;
  };

  const onMouseDown: GutterMouseDownHandler = (view, block, event) => {
    const mouse = event as MouseEvent;
    if (mouse.button !== 0) return false;

    const line = view.state.doc.lineAt(block.from);
    // Shift 按下时沿用原选区的锚点，与正文里的 Shift 点选一致
    const anchorFrom =
      mouse.shiftKey && !view.state.selection.main.empty
        ? view.state.doc.lineAt(view.state.selection.main.anchor).from
        : line.from;

    stopDrag();
    apply(view, anchorFrom, line.from);
    dragging = { view, doc: view.contentDOM.ownerDocument, anchorFrom };
    dragging.doc.addEventListener('mousemove', onMouseMove);
    dragging.doc.addEventListener('mouseup', stopDrag);
    view.focus();
    return true;
  };

  return { onMouseDown };
}
