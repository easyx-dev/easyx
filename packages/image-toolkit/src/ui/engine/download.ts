/**
 * 带进度的 wasm 下载器
 *
 * 关键坑：fetch 的 body 是**解压后**的字节流，而 Content-Length 是**压缩后**的长度。
 * wasm 通常会被 gzip/brotli 预压缩传输，两者基准不同会让进度冲过 100%。
 * 因此响应带 Content-Encoding 时不提供百分比，只上报已下载字节数。
 */
import { ImageEngineError, toErrorMessage } from './errors';

export interface DownloadProgress {
  /** 已接收字节数（解压后） */
  loaded: number;
  /** 声明总长度；不可比时为 null */
  total: number | null;
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  /** 进度上报的字节增量阈值，默认 256 KB */
  progressStep?: number;
}

/** 解析可信的声明总长度：带 Content-Encoding 时不可比，返回 null */
function resolveTotal(response: Response): number | null {
  if (response.headers.get('content-encoding')) return null;
  const declared = Number(response.headers.get('content-length'));
  if (!Number.isFinite(declared) || declared <= 0) return null;
  return declared;
}

/**
 * 下载字节并上报进度
 * 失败时抛出 ImageEngineError，调用方负责降级到错误态
 */
export async function downloadWithProgress(
  url: string,
  options: DownloadOptions = {},
): Promise<Uint8Array> {
  const { onProgress, signal, progressStep = 256 * 1024 } = options;

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    throw new ImageEngineError(
      `图片引擎下载失败：${toErrorMessage(error)}（地址 ${url}）`,
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new ImageEngineError(
      `图片引擎下载失败：HTTP ${response.status} ${response.statusText}（地址 ${url}）`,
    );
  }

  const total = resolveTotal(response);
  const body = response.body;
  if (!body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onProgress?.({ loaded: buffer.byteLength, total });
    return buffer;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastReported = 0;
  onProgress?.({ loaded, total });

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    if (loaded - lastReported >= progressStep) {
      lastReported = loaded;
      onProgress?.({ loaded, total });
    }
  }
  // 收尾必报最终值，但避免与最后一次中间上报重复
  if (loaded !== lastReported) onProgress?.({ loaded, total });

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}
