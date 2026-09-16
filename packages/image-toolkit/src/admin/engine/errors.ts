/**
 * 图片处理包的公共错误类型
 */

/** 引擎加载失败（下载失败、wasm 初始化失败、Worker 创建失败） */
export class ImageEngineError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImageEngineError';
  }
}

/** 引擎未就绪或配置缺失 */
export class ImageEngineConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageEngineConfigError';
  }
}

/** 把未知异常转成可展示的错误信息 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
