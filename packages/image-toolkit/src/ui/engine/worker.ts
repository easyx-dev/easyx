/**
 * 引擎 Worker：持有 wasm 实例并执行图片处理，避免阻塞主线程
 */
import { initializeImageMagick } from '@imagemagick/magick-wasm';
import { toErrorMessage } from './errors';
import { optimizeLosslessly, probeImage, transformImage } from './operations';
import type { EngineRequest, EngineResponse } from './protocol';

/**
 * Worker 全局作用域的最小类型
 * 不引入 lib.webworker，避免与 tsconfig 的 DOM lib 冲突
 */
interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

const scope = self as unknown as WorkerScope;

let initialized = false;

function respond(message: EngineResponse, transfer?: Transferable[]): void {
  scope.postMessage(message, transfer ?? []);
}

scope.onmessage = async (event: MessageEvent): Promise<void> => {
  const message = event.data as EngineRequest;

  if (!initialized && message.type !== 'init') {
    respond({ kind: 'error', id: message.id, message: '图片引擎尚未初始化' });
    return;
  }

  try {
    switch (message.type) {
      case 'init': {
        await initializeImageMagick(message.wasmBytes);
        initialized = true;
        respond({ kind: 'init', id: message.id });
        return;
      }
      case 'probe': {
        respond({
          kind: 'probe',
          id: message.id,
          meta: probeImage(message.bytes),
        });
        return;
      }
      case 'transform': {
        const result = transformImage(message.bytes, message.operation);
        respond({ kind: 'transform', id: message.id, result }, [
          result.data.buffer,
        ]);
        return;
      }
      case 'optimize': {
        const result = optimizeLosslessly(message.bytes, message.options);
        respond(
          { kind: 'optimize', id: message.id, result },
          result ? [result.data.buffer] : [],
        );
        return;
      }
    }
  } catch (error) {
    respond({ kind: 'error', id: message.id, message: toErrorMessage(error) });
  }
};
