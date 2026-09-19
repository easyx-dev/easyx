/**
 * 文档解析错误
 *
 * 与其他能力一致：错误只抛实例，用户可见文案经 onNotify 呈现、程序上报走 onError。
 */

/** 不支持的文档格式（如旧版 .doc 二进制、或扩展名不在 accept 内） */
export class UnsupportedDocumentError extends Error {
  readonly fileName: string;

  constructor(fileName: string) {
    super(`暂不支持解析该文档格式：${fileName}`);
    this.name = 'UnsupportedDocumentError';
    this.fileName = fileName;
  }
}

/** 解析过程失败（依赖加载失败、文件损坏等） */
export class DocumentParseError extends Error {
  readonly fileName: string;

  constructor(fileName: string, cause?: unknown) {
    super(`文档解析失败：${fileName}`);
    this.name = 'DocumentParseError';
    this.fileName = fileName;
    if (cause !== undefined) this.cause = cause;
  }
}
