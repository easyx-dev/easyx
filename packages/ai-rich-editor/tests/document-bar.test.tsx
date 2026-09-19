// @rstest-environment jsdom
/**
 * 对话文档条测试：解析态展示、移除与失败重试
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DocumentBar } from '../src/chat/DocumentBar';
import type { PendingDocument } from '../src/parsers/document-state';

afterEach(() => cleanup());

function makeDocument(
  overrides: Partial<PendingDocument> = {},
): PendingDocument {
  return {
    id: 'd1',
    name: 'a.pdf',
    size: 1024,
    file: new File(['x'], 'a.pdf'),
    status: 'parsing',
    ...overrides,
  };
}

describe('DocumentBar', () => {
  it('解析中显示状态且可移除', () => {
    const onRemove = rs.fn();
    render(<DocumentBar documents={[makeDocument()]} onRemove={onRemove} />);
    expect(screen.getByText('解析中…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '移除 a.pdf' }));
    expect(onRemove).toHaveBeenCalledWith('d1');
  });

  it('已解析显示页数与字数', () => {
    render(
      <DocumentBar
        documents={[
          makeDocument({
            status: 'ready',
            result: { kind: 'pdf', text: '四个字。', pageCount: 2 },
          }),
        ]}
      />,
    );
    expect(screen.getByText('2 页 · 4 字')).toBeTruthy();
  });

  it('失败时显示原因并支持重试', () => {
    const onRetry = rs.fn();
    render(
      <DocumentBar
        documents={[
          makeDocument({ status: 'error', error: '解析失败：a.pdf' }),
        ]}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('解析失败：a.pdf')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重试 a.pdf' }));
    expect(onRetry).toHaveBeenCalledWith('d1');
  });

  it('禁用时隐藏操作按钮', () => {
    render(
      <DocumentBar
        disabled
        documents={[makeDocument({ status: 'error', error: '失败' })]}
        onRemove={rs.fn()}
        onRetry={rs.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '重试 a.pdf' })).toBeNull();
    expect(screen.queryByRole('button', { name: '移除 a.pdf' })).toBeNull();
  });
});
