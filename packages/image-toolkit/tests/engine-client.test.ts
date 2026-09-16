/**
 * 引擎客户端测试：加载状态机、并发去重、Worker 生命周期与错误处理
 *
 * 用 FakeWorker 替代真实 Worker，直接驱动消息回包，从而在 jsdom 下覆盖
 * 浏览器端的请求/响应编排逻辑（真实 wasm 处理由 Node spike 与 e2e 覆盖）。
 */
import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  downloadWithProgress: rs.fn(),
  resolveEngineWasmUrl: rs.fn(),
}));

rs.mock('../src/admin/engine/download', () => ({
  downloadWithProgress: mocks.downloadWithProgress,
}));

rs.mock('../src/admin/engine/config', () => ({
  resolveEngineWasmUrl: mocks.resolveEngineWasmUrl,
}));

import {
  ensureImageEngine,
  getImageEngineState,
  isImageEngineReady,
  optimizeImageLosslessly,
  probeImage,
  resetImageEngine,
  subscribeImageEngine,
  transformImage,
} from '../src/admin/engine/client';
import type {
  EngineRequest,
  ImageEngineState,
} from '../src/admin/engine/protocol';

/** 可编程的 Worker 替身：记录出站消息并支持手工回包 */
class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: EngineRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message as EngineRequest);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** 模拟 Worker 回包 */
  respond(message: unknown): void {
    this.onmessage?.({ data: message } as MessageEvent);
  }

  /** 最后一条出站消息 */
  last(): EngineRequest {
    return this.posted[this.posted.length - 1];
  }
}

/** 记录状态变化 */
function recordStates(): { states: ImageEngineState[]; stop: () => void } {
  const states: ImageEngineState[] = [];
  const stop = subscribeImageEngine((state) => states.push(state));
  return { states, stop };
}

/** 完成一次成功的加载握手，返回 Worker 替身 */
async function setupReadyEngine(): Promise<FakeWorker> {
  mocks.resolveEngineWasmUrl.mockResolvedValue('https://cdn.test/magick.wasm');
  mocks.downloadWithProgress.mockResolvedValue(new Uint8Array([1, 2, 3]));

  const loading = ensureImageEngine();
  await rs.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  const worker = FakeWorker.instances[0];
  await rs.waitFor(() => expect(worker.posted).toHaveLength(1));
  worker.respond({ kind: 'init', id: worker.last().id });
  await loading;
  return worker;
}

describe('ensureImageEngine', () => {
  beforeEach(() => {
    rs.stubGlobal('Worker', FakeWorker);
    FakeWorker.instances = [];
    mocks.downloadWithProgress.mockReset();
    mocks.resolveEngineWasmUrl.mockReset();
    resetImageEngine();
  });

  it('并发调用只触发一次下载、只创建一个 Worker', async () => {
    const worker = await setupReadyEngine();

    // 再调用一次应直接命中已就绪状态
    await ensureImageEngine();

    expect(mocks.downloadWithProgress).toHaveBeenCalledTimes(1);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker.posted).toHaveLength(1);
    expect(isImageEngineReady()).toBe(true);
  });

  it('按 downloading → instantiating → ready 推进状态（订阅时先回调当前 idle）', async () => {
    const { states, stop } = recordStates();
    await setupReadyEngine();
    stop();

    expect(states.map((state) => state.stage)).toEqual([
      'idle',
      'downloading',
      'instantiating',
      'ready',
    ]);
  });

  it('把下载进度与比例透传到状态供 UI 展示', async () => {
    mocks.resolveEngineWasmUrl.mockResolvedValue(
      'https://cdn.test/magick.wasm',
    );
    mocks.downloadWithProgress.mockImplementation(async (_url, options) => {
      options.onProgress?.({ loaded: 1024, total: 2048 });
      options.onProgress?.({ loaded: 2048, total: 2048 });
      return new Uint8Array([1]);
    });

    const { states, stop } = recordStates();
    const loading = ensureImageEngine();
    await rs.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    const worker = FakeWorker.instances[0];
    await rs.waitFor(() => expect(worker.posted).toHaveLength(1));
    worker.respond({ kind: 'init', id: worker.last().id });
    await loading;
    stop();

    const downloading = states.filter((state) => state.stage === 'downloading');
    expect(downloading).toContainEqual({
      stage: 'downloading',
      loaded: 1024,
      total: 2048,
      ratio: 0.5,
    });
    expect(downloading.at(-1)).toMatchObject({
      stage: 'downloading',
      loaded: 2048,
      ratio: 1,
    });
  });

  it('加载失败进入 error 状态并释放 Worker，重试后可恢复', async () => {
    mocks.resolveEngineWasmUrl.mockRejectedValueOnce(new Error('配置缺失'));

    await expect(ensureImageEngine()).rejects.toThrow('配置缺失');
    expect(getImageEngineState()).toMatchObject({
      stage: 'error',
      message: '配置缺失',
    });

    const worker = await setupReadyEngine();
    expect(worker.terminated).toBe(false);
    expect(isImageEngineReady()).toBe(true);
  });

  it('Worker 运行时异常会拒绝在途请求', async () => {
    await setupReadyEngine();
    const pending = probeImage(new Uint8Array([1]));
    await rs.waitFor(() =>
      expect(FakeWorker.instances[0].posted).toHaveLength(2),
    );

    FakeWorker.instances[0].onerror?.({ message: 'boom' } as ErrorEvent);

    await expect(pending).rejects.toThrow(/boom/);
  });
});

describe('resetImageEngine', () => {
  beforeEach(() => {
    rs.stubGlobal('Worker', FakeWorker);
    FakeWorker.instances = [];
    mocks.downloadWithProgress.mockReset();
    mocks.resolveEngineWasmUrl.mockReset();
    resetImageEngine();
  });

  it('终止 Worker 并回到 idle', async () => {
    const worker = await setupReadyEngine();
    resetImageEngine();

    expect(worker.terminated).toBe(true);
    expect(getImageEngineState()).toEqual({ stage: 'idle' });
    expect(isImageEngineReady()).toBe(false);
  });
});

describe('probeImage', () => {
  beforeEach(() => {
    rs.stubGlobal('Worker', FakeWorker);
    FakeWorker.instances = [];
    mocks.downloadWithProgress.mockReset();
    mocks.resolveEngineWasmUrl.mockReset();
    resetImageEngine();
  });

  it('返回 Worker 给出的元数据', async () => {
    const worker = await setupReadyEngine();
    const pending = probeImage(new Uint8Array([1]));
    await rs.waitFor(() => expect(worker.posted).toHaveLength(2));

    worker.respond({
      kind: 'probe',
      id: worker.last().id,
      meta: { width: 100, height: 50, format: 'png', hasAlpha: false },
    });

    await expect(pending).resolves.toEqual({
      width: 100,
      height: 50,
      format: 'png',
      hasAlpha: false,
    });
  });

  it('Worker 回错误响应时拒绝并带上信息', async () => {
    const worker = await setupReadyEngine();
    const pending = probeImage(new Uint8Array([1]));
    await rs.waitFor(() => expect(worker.posted).toHaveLength(2));

    worker.respond({
      kind: 'error',
      id: worker.last().id,
      message: '解码失败',
    });

    await expect(pending).rejects.toThrow('解码失败');
  });
});

describe('transformImage', () => {
  beforeEach(() => {
    rs.stubGlobal('Worker', FakeWorker);
    FakeWorker.instances = [];
    mocks.downloadWithProgress.mockReset();
    mocks.resolveEngineWasmUrl.mockReset();
    resetImageEngine();
  });

  it('发送归一化后的操作（取整并补默认 fit）', async () => {
    const worker = await setupReadyEngine();
    const pending = transformImage(new Uint8Array([1]), {
      crop: { left: 10.4, top: 20.6, width: 300.2, height: 200.8 },
      resize: { width: 800 },
      format: 'webp',
      quality: 82.5,
    });
    await rs.waitFor(() => expect(worker.posted).toHaveLength(2));

    const request = worker.last();
    expect(request.type).toBe('transform');
    if (request.type === 'transform') {
      expect(request.operation).toEqual({
        crop: { left: 10, top: 21, width: 300, height: 201 },
        resize: { width: 800, fit: 'inside' },
        format: 'webp',
        quality: 83,
      });
    }

    worker.respond({
      kind: 'transform',
      id: request.id,
      result: {
        data: new Uint8Array([9]),
        mimeType: 'image/webp',
        meta: { width: 800, height: 400, format: 'webp', hasAlpha: false },
        sizeBefore: 1,
        sizeAfter: 1,
      },
    });
    await expect(pending).resolves.toMatchObject({ mimeType: 'image/webp' });
  });

  it('空操作在发出请求前即被拒绝', async () => {
    const worker = await setupReadyEngine();

    await expect(transformImage(new Uint8Array([1]), {})).rejects.toThrow(
      '未指定任何图片处理操作',
    );
    expect(worker.posted).toHaveLength(1);
  });

  it('非法操作参数直接抛给调用方，不发出请求', async () => {
    const worker = await setupReadyEngine();

    await expect(
      transformImage(new Uint8Array([1]), {
        // NaN 属结构非法（与越界负值不同，后者会被钳制）
        crop: { left: Number.NaN, top: 0, width: 10, height: 10 },
      }),
    ).rejects.toThrow();
    expect(worker.posted).toHaveLength(1);
  });
});

describe('optimizeImageLosslessly', () => {
  beforeEach(() => {
    rs.stubGlobal('Worker', FakeWorker);
    FakeWorker.instances = [];
    mocks.downloadWithProgress.mockReset();
    mocks.resolveEngineWasmUrl.mockReset();
    resetImageEngine();
  });

  it('透传无损优化参数并把 null 结果原样返回给调用方', async () => {
    const worker = await setupReadyEngine();
    const pending = optimizeImageLosslessly(new Uint8Array([1]), {
      strip: true,
      format: 'webp',
      crop: { left: 10, top: 20, width: 100, height: 80 },
    });
    await rs.waitFor(() => expect(worker.posted).toHaveLength(2));

    const request = worker.last();
    expect(request.type).toBe('optimize');
    if (request.type === 'optimize') {
      expect(request.options).toEqual({
        strip: true,
        format: 'webp',
        crop: { left: 10, top: 20, width: 100, height: 80 },
      });
    }

    worker.respond({ kind: 'optimize', id: request.id, result: null });

    await expect(pending).resolves.toBeNull();
  });

  it('裁切参数同样经过归一化（负坐标钳制、取整）', async () => {
    const worker = await setupReadyEngine();
    const pending = optimizeImageLosslessly(new Uint8Array([1]), {
      strip: false,
      crop: { left: -5.4, top: 10.6, width: 100.2, height: 80.8 },
    });
    await rs.waitFor(() => expect(worker.posted).toHaveLength(2));

    const request = worker.last();
    if (request.type === 'optimize') {
      expect(request.options.crop).toEqual({
        left: 0,
        top: 11,
        width: 100,
        height: 81,
      });
    }
    worker.respond({ kind: 'optimize', id: request.id, result: null });
    await pending;
  });
});
