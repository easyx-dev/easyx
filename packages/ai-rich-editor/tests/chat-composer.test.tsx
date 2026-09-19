// @rstest-environment jsdom
/**
 * 对话输入区测试
 *
 * 附件链路的关键约定：粘贴文件交给调用方、附件条可移除、上传中不可发送、
 * 只带附件（无文字）也允许发送。
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatComposer } from '../src/chat/ChatComposer';
import type { PendingAttachment } from '../src/media/attachment';

afterEach(() => cleanup());

function fileAttachment(name: string, type: string): PendingAttachment {
  return {
    id: name,
    kind: type.startsWith('image/') ? 'image' : 'attachment',
    name,
    size: 1024,
    progress: 0,
    file: new File(['x'], name, { type }),
  };
}

function renderComposer(overrides: Record<string, unknown> = {}) {
  const props = {
    loading: false,
    onAddFiles: rs.fn(),
    onChange: rs.fn(),
    onRemoveAttachment: rs.fn(),
    onSubmit: rs.fn(),
    value: '',
    ...overrides,
  };
  render(<ChatComposer {...props} />);
  return props;
}

describe('附件添加', () => {
  it('粘贴图片时把文件交给调用方且不插入文本', () => {
    const { onAddFiles } = renderComposer();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.paste(screen.getByLabelText('对话输入'), {
      clipboardData: { files: [file] },
    });
    expect(onAddFiles).toHaveBeenCalledWith([file]);
  });

  it('无文件的粘贴不触发附件回调', () => {
    const { onAddFiles } = renderComposer();
    fireEvent.paste(screen.getByLabelText('对话输入'), {
      clipboardData: { files: [] },
    });
    expect(onAddFiles).not.toHaveBeenCalled();
  });
});

describe('附件条', () => {
  it('渲染文件名与移除按钮', () => {
    const { onRemoveAttachment } = renderComposer({
      attachments: [fileAttachment('a.png', 'image/png')],
    });
    expect(screen.getByText('a.png')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '移除 a.png' }));
    expect(onRemoveAttachment).toHaveBeenCalledWith('a.png');
  });

  it('上传中隐藏移除按钮', () => {
    renderComposer({
      attachments: [fileAttachment('a.png', 'image/png')],
      uploading: true,
    });
    expect(screen.queryByRole('button', { name: '移除 a.png' })).toBeNull();
  });
});

describe('发送', () => {
  it('回车发送去掉首尾空白后的文本', () => {
    const { onSubmit } = renderComposer({ value: '  你好  ' });
    fireEvent.keyDown(screen.getByLabelText('对话输入'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('  你好  ');
  });

  it('输入法合成期间的回车不发送', () => {
    const { onSubmit } = renderComposer({ value: '拼音' });
    fireEvent.keyDown(screen.getByLabelText('对话输入'), {
      isComposing: true,
      key: 'Enter',
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('只带附件（无文字）也可发送', () => {
    const { onSubmit } = renderComposer({
      attachments: [fileAttachment('a.png', 'image/png')],
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('上传中发送按钮变为上传态且不可点击', () => {
    renderComposer({ uploading: true, value: '你好' });
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
    expect(screen.getByRole('button', { name: '上传中' })).toBeTruthy();
  });
});

describe('文档入口', () => {
  it('配置 documentAccept 时出现添加文档按钮', () => {
    renderComposer({ documentAccept: '.docx,.pdf' });
    expect(screen.getByRole('button', { name: '添加文档' })).toBeTruthy();
  });

  it('未配置时不出现文档入口', () => {
    renderComposer();
    expect(screen.queryByRole('button', { name: '添加文档' })).toBeNull();
  });

  it('解析中发送按钮变为解析态', () => {
    renderComposer({ parsing: true, value: '你好' });
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
    expect(screen.getByRole('button', { name: '解析中' })).toBeTruthy();
  });

  it('只带已就绪文档（无文字）也可发送', () => {
    const { onSubmit } = renderComposer({
      documents: [
        {
          file: new File(['x'], 'a.pdf'),
          id: 'd1',
          name: 'a.pdf',
          result: { kind: 'pdf', text: '正文' },
          size: 1024,
          status: 'ready',
        },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
