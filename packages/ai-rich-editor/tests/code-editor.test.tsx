/**
 * 代码编辑器测试：外部 value 的落地策略（纯函数）、扩展装配，以及 CodeEditor 的受控同步
 */
// @rstest-environment jsdom

import { history, undo } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CodeEditor } from '../src/code-editor/CodeEditor';
import {
  planDocSync,
  resolveCaretTarget,
  writeDocSync,
} from '../src/code-editor/doc-sync';
import { createCodeExtensions } from '../src/code-editor/extensions';
import { cursorLineChanged } from '../src/code-editor/gutter-add';
import { lineSelectionRange } from '../src/code-editor/gutter-line-select';
import { InvalidMediaUrlError } from '../src/media/errors';

// jsdom 未实现 Range 的布局测量，而 CodeMirror 计算选区矩形时会调用
const rangeProto = Range.prototype as Range & {
  getClientRects?: () => DOMRectList;
};
if (!rangeProto.getClientRects) {
  rangeProto.getClientRects = () => [] as unknown as DOMRectList;
}

afterEach(() => cleanup());

/** 从渲染结果读取文档内容：CodeMirror 每行渲染为一个 .cm-line */
function readDoc(): string {
  return Array.from(document.querySelectorAll('.cm-line'))
    .map((el) => el.textContent ?? '')
    .join('\n');
}

/** 行号槽内的媒体入口按钮（gutter 带 aria-hidden，只能用选择器取） */
function addButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    '.easyx-ai-rich-editor__code-add',
  );
  if (!button) throw new Error('媒体入口未渲染');
  return button;
}

/** 可见的媒体入口（排除 initialSpacer 的测量占位元素） */
function visibleAddButtons(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('.easyx-ai-rich-editor__code-add'),
  ).filter(
    (button) =>
      button.closest<HTMLElement>('.cm-gutterElement')?.style.visibility !==
      'hidden',
  );
}

describe('planDocSync', () => {
  it('内容一致时不做任何改动', () => {
    expect(planDocSync('<div>a</div>', '<div>a</div>')).toEqual({
      type: 'noop',
    });
  });

  it('目标内容是当前内容的前缀延伸时只追加尾部', () => {
    expect(planDocSync('<div>', '<div>a</div>')).toEqual({
      type: 'append',
      insert: 'a</div>',
    });
  });

  it('用户删掉尾部后仍按追加处理', () => {
    expect(planDocSync('ab', 'abc')).toEqual({ type: 'append', insert: 'c' });
  });

  it('目标内容与当前内容不是前缀关系时整篇替换', () => {
    expect(planDocSync('<div>a</div>', '<p>b</p>')).toEqual({
      type: 'replace',
      doc: '<p>b</p>',
    });
  });

  it('空文档收到任意内容都视为追加', () => {
    expect(planDocSync('', '<p>b</p>')).toEqual({
      type: 'append',
      insert: '<p>b</p>',
    });
  });
});

describe('resolveCaretTarget', () => {
  it('整篇替换后光标落到新内容末尾', () => {
    const doc = '<p>new</p>';
    expect(
      resolveCaretTarget(
        { type: 'replace', doc },
        { head: 3, empty: true },
        11,
      ),
    ).toBe(doc.length);
  });

  it('光标原本停在末尾时跟随追加', () => {
    expect(
      resolveCaretTarget(
        { type: 'append', insert: 'abc' },
        { head: 10, empty: true },
        10,
      ),
    ).toBe(13);
  });

  it('光标在中间时追加不动光标', () => {
    expect(
      resolveCaretTarget(
        { type: 'append', insert: 'abc' },
        { head: 4, empty: true },
        10,
      ),
    ).toBeNull();
  });

  it('末尾存在选区时不跟随追加', () => {
    expect(
      resolveCaretTarget(
        { type: 'append', insert: 'abc' },
        { head: 10, empty: false },
        10,
      ),
    ).toBeNull();
  });
});

describe('writeDocSync', () => {
  /** 建一个最小编辑器，给定文档与光标位置 */
  function mount(doc: string, caret: number) {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc }),
    });
    view.dispatch({ selection: { anchor: caret } });
    return view;
  }

  it('追加时保持文档中段的光标不动', () => {
    const view = mount('<div>a</div>', 5);
    expect(writeDocSync(view, '<div>a</div><p>b</p>')).toBe(true);
    expect(view.state.doc.toString()).toBe('<div>a</div><p>b</p>');
    expect(view.state.selection.main.head).toBe(5);
    view.destroy();
  });

  it('光标停在末尾时跟随追加到新末尾', () => {
    const view = mount('<div>a</div>', 12);
    writeDocSync(view, '<div>a</div><p>b</p>');
    expect(view.state.selection.main.head).toBe(20);
    view.destroy();
  });

  it('整篇替换后光标落到新内容末尾', () => {
    const view = mount('<div>a</div>', 5);
    writeDocSync(view, '<p>other</p>');
    expect(view.state.doc.toString()).toBe('<p>other</p>');
    expect(view.state.selection.main.head).toBe('<p>other</p>'.length);
    view.destroy();
  });

  it('内容一致时不写入', () => {
    const view = mount('<div>a</div>', 3);
    expect(writeDocSync(view, '<div>a</div>')).toBe(false);
    expect(view.state.selection.main.head).toBe(3);
    view.destroy();
  });

  it('外部写入不进撤销栈', () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '<div>a</div>',
        extensions: [history()],
      }),
    });
    writeDocSync(view, '<div>a</div><p>b</p>');
    writeDocSync(view, '<p>other</p>');
    expect(undo(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('<p>other</p>');
    view.destroy();
  });
});

describe('createCodeExtensions', () => {
  function mount(options: {
    isDark: boolean;
    onDocChange?: (doc: string) => void;
  }) {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '<div class="a">x</div>',
        extensions: createCodeExtensions({
          darkTheme: new Compartment(),
          isDark: options.isDark,
          onDocChange: options.onDocChange ?? (() => {}),
        }),
      }),
    });
    return view;
  }

  it('文档变化时回调新内容', () => {
    const onDocChange = rs.fn();
    const view = mount({ isDark: false, onDocChange });
    view.dispatch({ changes: { from: 0, insert: '<!-- hi -->' } });
    expect(onDocChange).toHaveBeenCalledWith(
      '<!-- hi --><div class="a">x</div>',
    );
    view.destroy();
  });

  it('暗色判定传入 CodeMirror 的暗色 facet', () => {
    const dark = mount({ isDark: true });
    expect(dark.state.facet(EditorView.darkTheme)).toBe(true);
    dark.destroy();

    const light = mount({ isDark: false });
    expect(light.state.facet(EditorView.darkTheme)).toBe(false);
    light.destroy();
  });

  it('查找面板与行号槽可正常挂载（官方默认装配）', () => {
    const view = mount({ isDark: false });
    openSearchPanel(view);
    expect(document.querySelector('.cm-panel.cm-search')).toBeTruthy();
    expect(document.querySelector('.cm-lineNumbers')).toBeTruthy();
    view.destroy();
  });
});

describe('createCodeExtensions 的文件拖入', () => {
  /** 挂载一个带落点回调的编辑器 */
  function mountDrop(onFilesDropped?: (files: File[], pos: number) => boolean) {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '<div>a</div>',
        extensions: createCodeExtensions({
          darkTheme: new Compartment(),
          isDark: false,
          onDocChange: () => {},
          onFilesDropped,
        }),
      }),
    });
    return view;
  }

  /** jsdom 无 DragEvent 构造，手工造一个带 dataTransfer 的事件 */
  function dispatchFiles(view: EditorView, files: File[]) {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.assign(event, {
      clientX: 0,
      clientY: 0,
      dataTransfer: { files, types: ['Files'] },
    });
    view.contentDOM.dispatchEvent(event);
  }

  it('拖入文件时接管事件并带上落点', () => {
    const onFilesDropped = rs.fn(() => true);
    const view = mountDrop(onFilesDropped);
    try {
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      dispatchFiles(view, [file]);
      expect(onFilesDropped).toHaveBeenCalledTimes(1);
      expect(onFilesDropped.mock.calls[0][0]).toEqual([file]);
      expect(typeof onFilesDropped.mock.calls[0][1]).toBe('number');
    } finally {
      view.destroy();
    }
  });

  it('未配置落点回调时不接管，也不改动文档', () => {
    const view = mountDrop();
    try {
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      dispatchFiles(view, [file]);
      expect(view.state.doc.toString()).toBe('<div>a</div>');
    } finally {
      view.destroy();
    }
  });
});

describe('cursorLineChanged', () => {
  /** 建一个带更新监听的最小编辑器，收集每次 update */
  function mountWithUpdates(doc: string) {
    const updates: ViewUpdate[] = [];
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        extensions: [EditorView.updateListener.of((u) => updates.push(u))],
      }),
    });
    return { updates, view };
  }

  it('光标换行返回 true（gutter 据此重绘标记）', () => {
    const { updates, view } = mountWithUpdates('<p>a</p>\n<p>b</p>');
    try {
      view.dispatch({ selection: { anchor: view.state.doc.line(2).from } });
      expect(cursorLineChanged(updates.at(-1) as ViewUpdate)).toBe(true);
    } finally {
      view.destroy();
    }
  });

  it('同一行内移动光标返回 false（避免无谓重绘）', () => {
    const { updates, view } = mountWithUpdates('<p>abcdef</p>\n<p>b</p>');
    try {
      view.dispatch({ selection: { anchor: 5 } });
      expect(cursorLineChanged(updates.at(-1) as ViewUpdate)).toBe(false);
    } finally {
      view.destroy();
    }
  });
});

describe('lineSelectionRange', () => {
  const state = EditorState.create({ doc: '<p>a</p>\n<p>b</p>\n<p>c</p>' });

  it('自上而下选中整行范围', () => {
    const first = state.doc.line(1);
    const third = state.doc.line(3);
    expect(lineSelectionRange(state, first.from, third.from)).toEqual({
      anchor: first.from,
      head: third.to,
    });
  });

  it('自下而上时 caret 落在上端', () => {
    const first = state.doc.line(1);
    const second = state.doc.line(2);
    expect(lineSelectionRange(state, second.to, first.from)).toEqual({
      anchor: second.to,
      head: first.from,
    });
  });
});

describe('CodeEditor', () => {
  it('挂载时渲染传入的 value', () => {
    render(<CodeEditor value={'<div>a</div>\n<p>b</p>'} />);
    expect(document.querySelector('.cm-editor')).toBeTruthy();
    expect(readDoc()).toBe('<div>a</div>\n<p>b</p>');
  });

  it('流式追加只补尾部且不回吐 onChange', () => {
    const onChange = rs.fn();
    const { rerender } = render(
      <CodeEditor onChange={onChange} value={'<div>a'} />,
    );
    rerender(<CodeEditor onChange={onChange} value={'<div>ab</div>'} />);
    expect(readDoc()).toBe('<div>ab</div>');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('外部整体替换写入文档且不回吐 onChange', () => {
    const onChange = rs.fn();
    const { rerender } = render(
      <CodeEditor onChange={onChange} value={'<div>a</div>'} />,
    );
    rerender(<CodeEditor onChange={onChange} value={'<p>b</p>'} />);
    expect(readDoc()).toBe('<p>b</p>');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('传入相同内容不触发多余改动', () => {
    const { rerender } = render(<CodeEditor value={'<div>a</div>'} />);
    const content = document.querySelector('.cm-content');
    rerender(<CodeEditor value={'<div>a</div>'} />);
    expect(document.querySelector('.cm-content')).toBe(content);
    expect(readDoc()).toBe('<div>a</div>');
  });

  it('卸载时销毁编辑器实例', () => {
    const { unmount } = render(<CodeEditor value={'<div>a</div>'} />);
    unmount();
    expect(document.querySelector('.cm-editor')).toBeNull();
  });

  it('光标行的行号左侧有媒体入口，插入网络地址即写入文档', () => {
    const { container } = render(<CodeEditor value={'<div>a</div>'} />);
    fireEvent.mouseDown(addButton(container));
    fireEvent.change(screen.getByPlaceholderText('粘贴图片/文件链接…'), {
      target: { value: 'https://cdn.test/a.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: '插入' }));
    expect(readDoc()).toBe(
      '<img src="https://cdn.test/a.png" alt="" style="max-width:100%;height:auto;"><div>a</div>',
    );
  });

  it('媒体入口只有一处，且插入落在光标处', () => {
    const { container } = render(
      <CodeEditor value={'<p>a</p>\n<p>b</p>\n<p>c</p>'} />,
    );
    expect(visibleAddButtons(container)).toHaveLength(1);

    const view = EditorView.findFromDOM(
      container.querySelector('.cm-content') as HTMLElement,
    );
    view?.dispatch({ selection: { anchor: view.state.doc.line(3).from } });
    // 换行后入口被重建但依旧唯一（跟随光标行的前提是只有一处入口）
    expect(visibleAddButtons(container)).toHaveLength(1);
  });

  it('媒体入口地址不合法时只上报错误，不动文档', () => {
    const onError = rs.fn();
    const { container } = render(
      <CodeEditor onError={onError} value={'<div>a</div>'} />,
    );
    fireEvent.mouseDown(addButton(container));
    fireEvent.change(screen.getByPlaceholderText('粘贴图片/文件链接…'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(screen.getByRole('button', { name: '插入' }));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(InvalidMediaUrlError);
    expect(readDoc()).toBe('<div>a</div>');
  });
});
