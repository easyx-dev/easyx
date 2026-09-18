// @rstest-environment jsdom
/**
 * 媒体库面板测试
 *
 * 关注三点：只请求一次（宿主内联 media 会不断重建 getList 身份）、空列表给空态、
 * 加载失败除面板内提示外还要进错误通道。
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, render, screen } from '@testing-library/react';
import { MediaLibraryPanel } from '../src/components/MediaLibraryPanel';
import type { AiRichMediaListResult } from '../src/media/types';

afterEach(() => cleanup());

const ITEMS: AiRichMediaListResult = {
  items: [{ id: '1', url: '/a.png', name: 'a.png', size: 1024 }],
  total: 1,
};

describe('MediaLibraryPanel', () => {
  it('展示时拉一次首页并渲染条目', async () => {
    const getList = rs.fn(async () => ITEMS);
    render(<MediaLibraryPanel getList={getList} onPick={() => {}} />);

    expect(
      await screen.findByRole('button', { name: '选择 a.png' }),
    ).toBeTruthy();
    expect(getList).toHaveBeenCalledTimes(1);
    expect(getList.mock.calls[0][0]).toEqual({
      keyword: undefined,
      page: 1,
      pageSize: 12,
    });
  });

  it('宿主重建 getList 身份时不重复请求', async () => {
    const first = rs.fn(async () => ITEMS);
    const { rerender } = render(
      <MediaLibraryPanel getList={first} onPick={() => {}} />,
    );
    await screen.findByRole('button', { name: '选择 a.png' });

    const second = rs.fn(async () => ITEMS);
    rerender(<MediaLibraryPanel getList={second} onPick={() => {}} />);
    rerender(
      <MediaLibraryPanel
        getList={rs.fn(async () => ITEMS)}
        onPick={() => {}}
      />,
    );

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('列表为空时给出空态文案', async () => {
    render(
      <MediaLibraryPanel
        getList={async () => ({ items: [], total: 0 })}
        onPick={() => {}}
      />,
    );
    expect(await screen.findByText('暂无媒体，试试搜索或上传')).toBeTruthy();
  });

  it('加载失败时面板内提示并上报错误', async () => {
    const onError = rs.fn();
    render(
      <MediaLibraryPanel
        getList={async () => {
          throw new Error('网络错误');
        }}
        onError={onError}
        onPick={() => {}}
      />,
    );
    expect(await screen.findByText('加载失败，请重试')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('网络错误');
  });
});
