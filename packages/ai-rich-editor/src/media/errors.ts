/**
 * 媒体相关错误
 *
 * 包内不持有错误 UI：错误实例经 `onError` 上报，用户可见的文案一律经
 * `onNotify('error', …)` 呈现（两者的组装见 ui/feedback.ts 的 createErrorReporter）。
 */
import { mediaKindLabel } from './routing';
import type { MediaKind } from './types';

/** 对应类型的上传接口未配置 */
export class MediaNotConfiguredError extends Error {
  readonly kind: MediaKind;

  constructor(kind: MediaKind) {
    super(`未配置${mediaKindLabel(kind)}上传接口`);
    this.name = 'MediaNotConfiguredError';
    this.kind = kind;
  }
}

/** 地址未通过协议白名单 */
export class InvalidMediaUrlError extends Error {
  readonly url: string;
  /** 生效的协议清单（默认 + 宿主追加） */
  readonly allowedSchemes: readonly string[];

  constructor(url: string, allowedSchemes: readonly string[]) {
    super(`地址协议不被允许（可用：${allowedSchemes.join(' / ')} 或相对路径）`);
    this.name = 'InvalidMediaUrlError';
    this.url = url;
    this.allowedSchemes = allowedSchemes;
  }
}

/** 把任意抛出物归一成 Error，保证 onError 拿到的始终是 Error */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string' && error.trim()) return new Error(error);
  return new Error('操作失败，请重试');
}
