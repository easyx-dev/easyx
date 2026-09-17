/**
 * 代码编辑器测试：外部 value 的落地策略（纯函数）、扩展装配，以及 CodeEditor 的受控同步
 */
// @rstest-environment jsdom

import { history, undo } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, render } from '@testing-library/react';
import { CodeEditor } from '../src/code-editor/CodeEditor';
import {
  planDocSync,
  resolveCaretTarget,
  writeDocSync,
} from '../src/code-editor/doc-sync';
import { createCodeExtensions } from '../src/code-editor/extensions';

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

  it('查找面板与行号槽可正常挂载，文案为中文', () => {
    const view = mount({ isDark: false });
    openSearchPanel(view);
    expect(document.querySelector('.cm-panel.cm-search')).toBeTruthy();
    expect(document.querySelector('.cm-lineNumbers')).toBeTruthy();
    expect(view.state.phrase('Find')).toBe('查找');
    expect(view.state.phrase('match case')).toBe('区分大小写');
    view.destroy();
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
});
