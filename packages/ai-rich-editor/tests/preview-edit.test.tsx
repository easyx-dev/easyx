/**
 * 预览右键编辑浮层测试：目标展示（单个 / 多选）、发送与关闭交互
 */
// @rstest-environment jsdom

import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PreviewEditMenu } from '../src/components/PreviewEditMenu';

afterEach(() => cleanup());

const target = { elementId: 0, targetHtml: '<p>x</p>', selectUnique: false };

describe('PreviewEditMenu', () => {
  it('无锚点或没有目标时什么都不渲染', () => {
    const { container } = render(
      <PreviewEditMenu
        anchor={null}
        dark={false}
        onClose={() => {}}
        onSubmit={() => {}}
        targets={[]}
      />,
    );
    expect(
      container.querySelector('.easyx-ai-rich-editor__preview-edit'),
    ).toBeNull();

    const { container: second } = render(
      <PreviewEditMenu
        anchor={{ x: 0, y: 0 }}
        dark={false}
        onClose={() => {}}
        onSubmit={() => {}}
        targets={[]}
      />,
    );
    expect(
      second.querySelector('.easyx-ai-rich-editor__preview-edit'),
    ).toBeNull();
  });

  it('展示目标并点击发送回调指令', () => {
    const onSubmit = rs.fn();
    render(
      <PreviewEditMenu
        anchor={{ x: 10, y: 20 }}
        dark={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        targets={[target]}
      />,
    );
    expect(screen.getByText('用 AI 修改此处')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('描述要怎么改，回车发送…'), {
      target: { value: '把标题改大' },
    });
    fireEvent.click(screen.getByText('发送'));
    expect(onSubmit).toHaveBeenCalledWith('把标题改大');
  });

  it('回车发送、Shift+Enter 换行', () => {
    const onSubmit = rs.fn();
    render(
      <PreviewEditMenu
        anchor={{ x: 0, y: 0 }}
        dark={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        targets={[target]}
      />,
    );
    const input = screen.getByPlaceholderText('描述要怎么改，回车发送…');
    fireEvent.change(input, { target: { value: '换风格' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('换风格');
  });

  it('Esc 触发关闭', () => {
    const onClose = rs.fn();
    render(
      <PreviewEditMenu
        anchor={{ x: 0, y: 0 }}
        dark={false}
        onClose={onClose}
        onSubmit={() => {}}
        targets={[target]}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('展示选区文本摘要', () => {
    render(
      <PreviewEditMenu
        anchor={{ x: 0, y: 0 }}
        dark={false}
        onClose={() => {}}
        onSubmit={() => {}}
        targets={[{ ...target, selectedText: '标题', selectUnique: true }]}
      />,
    );
    expect(screen.getByText('选区：标题')).toBeTruthy();
  });

  it('多选时展示数量与增减提示', () => {
    render(
      <PreviewEditMenu
        anchor={{ x: 0, y: 0 }}
        dark={false}
        onClose={() => {}}
        onSubmit={() => {}}
        targets={[
          target,
          { elementId: 3, targetHtml: '<p>y</p>', selectUnique: false },
        ]}
      />,
    );
    expect(screen.getByText('已选 2 个元素')).toBeTruthy();
    expect(screen.getByText('Shift + 右键可增减元素')).toBeTruthy();
  });

  it('增减目标（anchor 引用变化）不会清空已输入的指令', () => {
    const props = {
      dark: false,
      onClose: () => {},
      onSubmit: () => {},
    };
    const { rerender } = render(
      <PreviewEditMenu anchor={{ x: 0, y: 0 }} targets={[target]} {...props} />,
    );
    const input = screen.getByPlaceholderText(
      '描述要怎么改，回车发送…',
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '让这两个一致' } });

    // 模拟 Shift + 右键追加目标：anchor 是新对象、targets 变长
    rerender(
      <PreviewEditMenu
        anchor={{ x: 1, y: 1 }}
        targets={[
          target,
          { elementId: 3, targetHtml: '<p>y</p>', selectUnique: false },
        ]}
        {...props}
      />,
    );
    expect(
      screen.getByPlaceholderText('描述要怎么改，回车发送…'),
    ).toHaveProperty('value', '让这两个一致');
  });

  it('关闭后重新打开会清空输入', () => {
    const props = {
      dark: false,
      onClose: () => {},
      onSubmit: () => {},
    };
    const { rerender } = render(
      <PreviewEditMenu anchor={{ x: 0, y: 0 }} targets={[target]} {...props} />,
    );
    fireEvent.change(screen.getByPlaceholderText('描述要怎么改，回车发送…'), {
      target: { value: '临时指令' },
    });

    rerender(<PreviewEditMenu anchor={null} targets={[]} {...props} />);
    rerender(
      <PreviewEditMenu anchor={{ x: 0, y: 0 }} targets={[target]} {...props} />,
    );
    expect(
      screen.getByPlaceholderText('描述要怎么改，回车发送…'),
    ).toHaveProperty('value', '');
  });
});
