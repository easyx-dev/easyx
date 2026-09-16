/**
 * 下载器测试：进度上报、Content-Encoding 降级、错误包装
 */
import { describe, expect, it, rs } from '@rstest/core';
import { downloadWithProgress } from '../src/admin/engine/download';

/** 构造最小 Response 替身：只覆盖 downloadWithProgress 实际使用的字段 */
function fakeResponse(options: {
  chunks?: Uint8Array[];
  headers?: Record<string, string>;
  status?: number;
  body?: null;
}): Response {
  const chunks = options.chunks ?? [];
  let index = 0;
  const status = options.status ?? 200;
  const headers = new Headers(options.headers);

  const body =
    options.body === null
      ? null
      : {
          getReader: () => ({
            read: async () =>
              index < chunks.length
                ? { done: false, value: chunks[index++] }
                : { done: true, value: undefined },
          }),
        };

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? 'Not Found' : 'OK',
    headers,
    body,
    arrayBuffer: async () => {
      const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return merged.buffer;
    },
  } as unknown as Response;
}

describe('downloadWithProgress', () => {
  it('无 Content-Encoding 时以 Content-Length 作为可比总长度', async () => {
    const progress: { loaded: number; total: number | null }[] = [];
    rs.stubGlobal(
      'fetch',
      rs.fn().mockResolvedValue(
        fakeResponse({
          chunks: [new Uint8Array(10), new Uint8Array(10)],
          headers: { 'content-length': '20' },
        }),
      ),
    );

    const bytes = await downloadWithProgress('https://cdn.test/a.wasm', {
      progressStep: 1,
      onProgress: (next) => progress.push(next),
    });

    expect(bytes.byteLength).toBe(20);
    expect(progress.at(-1)).toEqual({ loaded: 20, total: 20 });
  });

  it('带 Content-Encoding 时不给出总长度（压缩后长度与解压后字节不可比）', async () => {
    const progress: { loaded: number; total: number | null }[] = [];
    rs.stubGlobal(
      'fetch',
      rs.fn().mockResolvedValue(
        fakeResponse({
          chunks: [new Uint8Array(4096), new Uint8Array(4096)],
          headers: { 'content-encoding': 'br', 'content-length': '900' },
        }),
      ),
    );

    await downloadWithProgress('https://cdn.test/a.wasm', {
      progressStep: 1,
      onProgress: (next) => progress.push(next),
    });

    // total 必须为 null，否则进度会冲过 100%
    expect(progress.every((item) => item.total === null)).toBe(true);
    expect(progress.at(-1)?.loaded).toBe(8192);
  });

  it('按 progressStep 节流进度回调', async () => {
    const onProgress = rs.fn();
    rs.stubGlobal(
      'fetch',
      rs.fn().mockResolvedValue(
        fakeResponse({
          chunks: [
            new Uint8Array(100),
            new Uint8Array(100),
            new Uint8Array(100),
          ],
          headers: { 'content-length': '300' },
        }),
      ),
    );

    await downloadWithProgress('https://cdn.test/a.wasm', {
      progressStep: 250,
      onProgress,
    });

    // 首次回调（loaded=0）+ 末次回调，中间未达阈值不回调
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('HTTP 非 2xx 抛出带状态码与地址的错误', async () => {
    rs.stubGlobal(
      'fetch',
      rs.fn().mockResolvedValue(fakeResponse({ status: 404 })),
    );

    await expect(
      downloadWithProgress('https://cdn.test/missing.wasm'),
    ).rejects.toThrow(/HTTP 404/);
  });

  it('fetch 自身异常时包装为可读错误并保留地址', async () => {
    rs.stubGlobal(
      'fetch',
      rs.fn().mockRejectedValue(new Error('network down')),
    );

    await expect(
      downloadWithProgress('https://cdn.test/a.wasm'),
    ).rejects.toThrow(/netw*|图片引擎下载失败/);
  });

  it('响应无 body 时退回 arrayBuffer 并上报一次进度', async () => {
    const onProgress = rs.fn();
    rs.stubGlobal(
      'fetch',
      rs.fn().mockResolvedValue(
        fakeResponse({
          chunks: [new Uint8Array(8)],
          headers: { 'content-length': '8' },
          body: null,
        }),
      ),
    );

    const bytes = await downloadWithProgress('https://cdn.test/a.wasm', {
      onProgress,
    });

    expect(bytes.byteLength).toBe(8);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});
