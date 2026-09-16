/**
 * 引擎主线程客户端：加载状态机（单例 + 去重 + 订阅）、Worker 生命周期与调用 API
 *
 * 分工：主线程负责下载（可直接上报进度），Worker 负责 wasm 实例化与图片处理。
 */
import {
  isImageOperationEffective,
  normalizeImageOperation,
} from '../../operation';
import type {
  ImageMeta,
  ImageOperation,
  ImageProcessResult,
} from '../../types';
import { resolveEngineWasmUrl } from './config';
import { type DownloadProgress, downloadWithProgress } from './download';
import {
  ImageEngineConfigError,
  ImageEngineError,
  toErrorMessage,
} from './errors';
import type {
  EngineRequest,
  EngineResponse,
  ImageEngineState,
  LosslessOptions,
} from './protocol';

let state: ImageEngineState = { stage: 'idle' };
const listeners = new Set<(next: ImageEngineState) => void>();

let engineWorker: Worker | null = null;
let inflightLoad: Promise<void> | null = null;
let nextRequestId = 1;

interface PendingRequest {
  resolve: (response: EngineResponse) => void;
  reject: (error: Error) => void;
}

const pendingRequests = new Map<number, PendingRequest>();

function publish(next: ImageEngineState): void {
  state = next;
  for (const listener of listeners) listener(next);
}

/** 订阅引擎加载状态：立即回调当前状态，返回取消订阅函数 */
export function subscribeImageEngine(
  listener: (next: ImageEngineState) => void,
): () => void {
  listener(state);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 读取当前加载状态 */
export function getImageEngineState(): ImageEngineState {
  return state;
}

/** 引擎是否已就绪 */
export function isImageEngineReady(): boolean {
  return state.stage === 'ready';
}

function failAllPending(error: Error): void {
  for (const entry of pendingRequests.values()) entry.reject(error);
  pendingRequests.clear();
}

function handleMessage(event: MessageEvent<EngineResponse>): void {
  const response = event.data;
  const entry = pendingRequests.get(response.id);
  if (!entry) return;
  pendingRequests.delete(response.id);
  if (response.kind === 'error')
    entry.reject(new ImageEngineError(response.message));
  else entry.resolve(response);
}

function acquireWorker(): Worker {
  if (engineWorker) return engineWorker;

  // 静态相对路径，基准是产物中的 dist/admin/index.js，指向 dist/admin/engine/worker.js。
  // 宿主打包器据此把 Worker 打成独立产物；本包构建期已关闭该表达式解析（见 rslib.config.ts）。
  const worker = new Worker(new URL('./engine/worker.js', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = handleMessage;
  worker.onerror = (event) => {
    failAllPending(
      new ImageEngineError(
        `图片引擎 Worker 异常：${event.message || '未知错误'}`,
      ),
    );
  };
  engineWorker = worker;
  return worker;
}

function releaseWorker(): void {
  if (!engineWorker) return;
  engineWorker.terminate();
  engineWorker = null;
}

/** 发送请求并等待对应响应 */
function request<TResponse extends EngineResponse>(
  build: (id: number) => EngineRequest,
): Promise<TResponse> {
  const worker = engineWorker;
  if (!worker) {
    return Promise.reject(new ImageEngineError('图片引擎尚未加载'));
  }
  const message = build(nextRequestId++);
  return new Promise<TResponse>((resolve, reject) => {
    pendingRequests.set(message.id, {
      resolve: (response) => resolve(response as TResponse),
      reject,
    });
    worker.postMessage(message);
  });
}

async function loadEngine(): Promise<void> {
  releaseWorker();
  failAllPending(new ImageEngineError('图片引擎已重置'));

  try {
    publish({ stage: 'downloading', loaded: 0, total: null, ratio: null });

    const wasmUrl = await resolveEngineWasmUrl();
    const wasmBytes = await downloadWithProgress(wasmUrl, {
      onProgress: ({ loaded, total }: DownloadProgress) => {
        publish({
          stage: 'downloading',
          loaded,
          total,
          ratio: total ? Math.min(loaded / total, 1) : null,
        });
      },
    });

    publish({ stage: 'instantiating' });
    acquireWorker();
    await request<Extract<EngineResponse, { kind: 'init' }>>((id) => ({
      id,
      type: 'init',
      wasmBytes,
    }));

    publish({ stage: 'ready' });
  } catch (error) {
    releaseWorker();
    publish({ stage: 'error', message: toErrorMessage(error) });
    if (
      error instanceof ImageEngineError ||
      error instanceof ImageEngineConfigError
    ) {
      throw error;
    }
    throw new ImageEngineError(toErrorMessage(error), { cause: error });
  }
}

/** 确保引擎就绪：并发调用共享同一次加载；失败后 inflight 会重置以允许重试 */
export function ensureImageEngine(): Promise<void> {
  if (state.stage === 'ready') return Promise.resolve();
  if (inflightLoad) return inflightLoad;

  inflightLoad = loadEngine().catch((error: unknown) => {
    inflightLoad = null;
    throw error;
  });
  return inflightLoad;
}

/** 重置引擎（加载失败后重试前调用） */
export function resetImageEngine(): void {
  releaseWorker();
  failAllPending(new ImageEngineError('图片引擎已重置'));
  inflightLoad = null;
  publish({ stage: 'idle' });
}

/** 读取图片元数据；非图片或无法解码时返回 null */
export async function probeImage(bytes: Uint8Array): Promise<ImageMeta | null> {
  await ensureImageEngine();
  const response = await request<Extract<EngineResponse, { kind: 'probe' }>>(
    (id) => ({ id, type: 'probe', bytes }),
  );
  return response.meta;
}

/** 应用处理操作（裁切 / 缩放 / 旋转 / 转格式）；入参会被归一化，非法参数抛 ImageOperationError */
export async function transformImage(
  bytes: Uint8Array,
  operation: ImageOperation,
): Promise<ImageProcessResult> {
  const normalized = normalizeImageOperation(operation);
  if (!isImageOperationEffective(normalized)) {
    throw new ImageEngineError('未指定任何图片处理操作');
  }

  await ensureImageEngine();
  const response = await request<
    Extract<EngineResponse, { kind: 'transform' }>
  >((id) => ({ id, type: 'transform', bytes, operation: normalized }));
  return response.result;
}

/**
 * 无损优化：可选裁切 + 无损重编码，可转 WebP
 * 返回 null 表示该格式不支持无损优化 —— 调用方应保留原图
 */
export async function optimizeImageLosslessly(
  bytes: Uint8Array,
  options: LosslessOptions,
): Promise<ImageProcessResult | null> {
  // 裁切复用同一套归一化，保证与 transformImage 的校验语义一致
  const normalized = normalizeImageOperation({ crop: options.crop });

  await ensureImageEngine();
  const response = await request<Extract<EngineResponse, { kind: 'optimize' }>>(
    (id) => ({
      id,
      type: 'optimize',
      bytes,
      options: {
        strip: options.strip,
        format: options.format,
        crop: normalized.crop,
      },
    }),
  );
  return response.result;
}
