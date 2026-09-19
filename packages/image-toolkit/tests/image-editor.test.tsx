// @rstest-environment jsdom
/**
 * 编辑内容区测试：只负责内容本身（源图读取、格式判定、主题作用域），
 * 保存动作由宿主实现，故这里也钉住「组件内不出现保存按钮」
 */

import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, render, screen } from '@testing-library/react';
import { ImageEditor } from '../src/ui/components/ImageEditor';

afterEach(() => {
  cleanup();
  rs.unstubAllGlobals();
});

/** 32 字节的 BMP 头：能被嗅探为 bmp，但不在可编辑格式内 */
function bmpBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes[0] = 0x42; // 'B'
  bytes[1] = 0x4d; // 'M'
  return bytes;
}

function stubSourceResponse(response: unknown): void {
  rs.stubGlobal(
    'fetch',
    rs.fn(async () => response),
  );
}

function stubSourceBytes(bytes: Uint8Array): void {
  stubSourceResponse({
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
  });
}

const baseProps = { src: '/uploads/cover.bmp' };

describe('ImageEditor', () => {
  it('根节点自带令牌作用域，且不渲染保存动作', async () => {
    stubSourceBytes(bmpBytes());
    const { container } = render(<ImageEditor {...baseProps} />);

    const root = container.querySelector('.easyx-image-toolkit__editor-panel');
    expect(root?.classList.contains('easyx-image-toolkit')).toBe(true);
    // 保存 / 下载属于宿主职责，组件内不应出现
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
    expect(screen.queryByRole('button', { name: '下载' })).toBeNull();

    await screen.findByText('BMP 格式不支持编辑');
  });

  it('theme="dark" 时在根节点带暗色类', async () => {
    stubSourceBytes(bmpBytes());
    const { container } = render(<ImageEditor {...baseProps} theme="dark" />);

    const root = container.querySelector('.easyx-image-toolkit__editor-panel');
    expect(root?.classList.contains('easyx-image-toolkit-dark')).toBe(true);

    await screen.findByText('BMP 格式不支持编辑');
  });

  it('读取原图失败时给出错误提示', async () => {
    stubSourceResponse({ ok: false, status: 404 });
    render(<ImageEditor {...baseProps} />);

    await screen.findByText('读取原图失败');
  });

  it('源图不可编辑时也回报空结果，避免宿主保留上一个源的产物', async () => {
    stubSourceBytes(bmpBytes());
    const onResultChange = rs.fn();
    render(<ImageEditor {...baseProps} onResultChange={onResultChange} />);

    await screen.findByText('BMP 格式不支持编辑');

    const calls = onResultChange.mock.calls;
    expect(calls[calls.length - 1]?.[0]).toMatchObject({
      result: null,
      pending: false,
    });
  });
});
