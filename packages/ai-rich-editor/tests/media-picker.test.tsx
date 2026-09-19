// @rstest-environment jsdom
/**
 * 媒体选择浮层测试
 *
 * 关注三件事：入口按能力出现、网络地址走白名单、媒体库条目按类型回调。
 * 无任何能力时点击触发元素只报错、不打开空面板。
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MediaPicker } from '../src/components/MediaPicker';
import { InvalidMediaUrlError } from '../src/media/errors';
import type { MediaConfig } from '../src/media/types';

afterEach(() => cleanup());

function imageConfig(): MediaConfig {
  return {
    image: {
      upload: async (file) => ({ id: '1', url: '/a.png', name: file.name }),
    },
  };
}

function renderPicker(props: {
  media?: MediaConfig;
  allowUrl?: boolean;
  deferUpload?: boolean;
  allowedUrlSchemes?: readonly string[];
}) {
  const onPick = rs.fn();
  const onError = rs.fn();
  render(
    <MediaPicker
      allowUrl={props.allowUrl}
      allowedUrlSchemes={props.allowedUrlSchemes}
      deferUpload={props.deferUpload}
      media={props.media}
      onError={onError}
      onPick={onPick}
      trigger={<button type="button">打开</button>}
    />,
  );
  return { onError, onPick };
}

describe('入口可用性', () => {
  it('无任何能力时点击只报错', () => {
    const { onError } = renderPicker({});
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    expect((onError.mock.calls[0][0] as Error).message).toBe(
      '未配置媒体上传或媒体库接口',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('只配置上传时只有一个入口，不渲染页签栏', () => {
    renderPicker({ media: imageConfig() });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByRole('button', { name: /选择文件/ })).toBeTruthy();
  });

  it('allowUrl 与媒体库各自补出入口', () => {
    const media = imageConfig();
    media.image!.getList = async () => ({ items: [], total: 0 });
    renderPicker({ allowUrl: true, media });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});

describe('网络地址', () => {
  it('合法地址回调给调用方', () => {
    const { onPick } = renderPicker({ allowUrl: true });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    fireEvent.change(screen.getByPlaceholderText('粘贴图片/文件链接…'), {
      target: { value: 'https://cdn.test/a.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: '插入' }));
    expect(onPick).toHaveBeenCalledWith({
      type: 'url',
      url: 'https://cdn.test/a.png',
    });
  });

  it('非白名单协议被拦下并提示', () => {
    const { onPick, onError } = renderPicker({ allowUrl: true });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    fireEvent.change(screen.getByPlaceholderText('粘贴图片/文件链接…'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(screen.getByRole('button', { name: '插入' }));
    expect(onPick).not.toHaveBeenCalled();
    const error = onError.mock.calls[0][0] as Error;
    expect(error).toBeInstanceOf(InvalidMediaUrlError);
    expect(error.message).toContain('地址协议不被允许');
  });

  it('宿主追加的协议可放行，且危险协议仍被拦下', () => {
    const { onPick } = renderPicker({
      allowUrl: true,
      allowedUrlSchemes: ['ipfs:', 'app'],
    });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    const input = screen.getByPlaceholderText('粘贴图片/文件链接…');
    fireEvent.change(input, { target: { value: 'ipfs://Qm123' } });
    fireEvent.click(screen.getByRole('button', { name: '插入' }));
    expect(onPick).toHaveBeenCalledWith({ type: 'url', url: 'ipfs://Qm123' });

    // 已打开的浮层已关闭，重新打开验证危险协议
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    fireEvent.change(screen.getByPlaceholderText('粘贴图片/文件链接…'), {
      target: { value: 'data:text/html,<script>' },
    });
    fireEvent.click(screen.getByRole('button', { name: '插入' }));
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});

describe('上传', () => {
  it('延迟上传模式只回调文件，不做上传', async () => {
    const upload = rs.fn(async (file: File) => ({
      id: '1',
      url: '/a.png',
      name: file.name,
    }));
    const { onPick } = renderPicker({
      deferUpload: true,
      media: { image: { upload } },
    });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    const input = document.querySelector<HTMLInputElement>(
      '.easyx-ai-rich-editor__media-file',
    );
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    expect(onPick).toHaveBeenCalledWith({
      type: 'upload',
      file,
      kind: 'image',
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it('立即上传模式回调带回上传结果', async () => {
    const { onPick } = renderPicker({ media: imageConfig() });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    const input = document.querySelector<HTMLInputElement>(
      '.easyx-ai-rich-editor__media-file',
    );
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    await rs.waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(onPick.mock.calls[0][0]).toMatchObject({
      type: 'upload',
      kind: 'image',
      item: { url: '/a.png' },
    });
  });
});

describe('媒体库', () => {
  it('选择条目时回调推断出的类型与条目', async () => {
    const media: MediaConfig = {
      image: {
        upload: async () => ({ id: '1', url: '/a.png', name: 'a.png' }),
        getList: async () => ({
          items: [{ id: '9', url: '/m/a.mp4', name: 'a.mp4' }],
          total: 1,
        }),
      },
    };
    const { onPick } = renderPicker({ media });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    fireEvent.click(screen.getByRole('tab', { name: /媒体库/ }));
    const item = await screen.findByRole('button', { name: '选择 a.mp4' });
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledWith({
      type: 'library',
      kind: 'video',
      item: { id: '9', url: '/m/a.mp4', name: 'a.mp4' },
    });
  });
});
