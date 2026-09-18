/**
 * 包内兜底的通知与错误处理
 *
 * 两条通道各司其职，错误会同时走两条：
 * - 通知（onNotify）：给人看的文案，兜底为内置轻提示（错误的可见提示也从这里出）
 * - 错误（onError）：给程序看的错误实例，兜底为 console.error（不上浮任何 UI）
 */
import type { AiRichErrorHandler, AiRichNotify } from '../types';
import { toast } from './toast';

/** 缺省通知：包内置轻提示 */
export const defaultOnNotify: AiRichNotify = (type, content) => {
  toast(type, content);
};

/** 缺省错误处理：只打日志，不做任何用户可见的打扰 */
export const defaultOnError: AiRichErrorHandler = (error) => {
  console.error('[easyx-ai-rich-editor]', error);
};

export interface ErrorReporterOptions {
  /** 可见提示通道（缺省用内置轻提示） */
  notify?: AiRichNotify;
  /** 上报通道（缺省只 console.error） */
  onError?: AiRichErrorHandler;
}

/**
 * 组装错误处理：先以通知形式让用户看见，再上报错误实例
 *
 * 包内所有错误路径都汇到这里，保证「可见提示」与「程序上报」不会漏掉任何一条。
 */
export function createErrorReporter({
  notify,
  onError,
}: ErrorReporterOptions = {}): AiRichErrorHandler {
  return (error) => {
    (notify ?? defaultOnNotify)('error', error.message);
    (onError ?? defaultOnError)(error);
  };
}
