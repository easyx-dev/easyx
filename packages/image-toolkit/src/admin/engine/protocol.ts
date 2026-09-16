/**
 * 引擎 Worker 与主线程之间的消息协议
 */
import type {
  ImageCrop,
  ImageMeta,
  ImageOperation,
  ImageOutputFormat,
  ImageProcessResult,
} from '../../types';

/** 引擎加载阶段：instantiating 阶段无法给出百分比，但必须暴露以解释「为什么卡住了」 */
export type ImageEngineStage =
  | 'idle'
  | 'downloading'
  | 'instantiating'
  | 'ready'
  | 'error';

/** 引擎加载状态（订阅者据此渲染进度与重试入口） */
export type ImageEngineState =
  | { stage: 'idle' }
  | {
      stage: 'downloading';
      /** 已接收字节数（fetch 解压后的长度） */
      loaded: number;
      /** 声明总长度；响应带 Content-Encoding 时不可比，为 null */
      total: number | null;
      /** 进度比例；total 为 null 时为 null（调用方应展示已下载量而非百分比） */
      ratio: number | null;
    }
  | { stage: 'instantiating' }
  | { stage: 'ready' }
  | { stage: 'error'; message: string };

/** 无损优化的可选参数（契约定义在此，实现与调用方共用） */
export interface LosslessOptions {
  /** 是否剥离元数据（EXIF/ICC） */
  strip: boolean;
  /** 可选裁切：裁切只取像素子集，保留区像素不变，仍属无损 */
  crop?: ImageCrop;
  /**
   * 目标格式；省略则保持原格式。
   * 显式指定目标格式时要求该格式逐像素无损（如 webp），避免把「转格式」变成有损重编码
   */
  format?: ImageOutputFormat;
}

/** 主线程 → Worker */
export type EngineRequest =
  | { id: number; type: 'init'; wasmBytes: Uint8Array }
  | { id: number; type: 'probe'; bytes: Uint8Array }
  | {
      id: number;
      type: 'transform';
      bytes: Uint8Array;
      operation: ImageOperation;
    }
  | {
      id: number;
      type: 'optimize';
      bytes: Uint8Array;
      options: LosslessOptions;
    };

/** Worker → 主线程 */
export type EngineResponse =
  | { kind: 'init'; id: number }
  | { kind: 'probe'; id: number; meta: ImageMeta | null }
  | { kind: 'transform'; id: number; result: ImageProcessResult }
  | { kind: 'optimize'; id: number; result: ImageProcessResult | null }
  | { kind: 'error'; id: number; message: string };
