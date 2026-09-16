/**
 * 自动预览 Hook：设置变化后防抖触发一次处理，并丢弃过期响应
 *
 * - 保留上一次成功结果，处理中不闪白
 * - 请求带序号，慢的旧结果不会覆盖新结果
 * - 失败进入 error 态并提供 refresh 重试
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isImageOperationEffective } from '../../operation';
import type {
  ImageCrop,
  ImageFormat,
  ImageProcessResult,
  ImageSize,
} from '../../types';
import {
  buildLosslessOptions,
  buildOperation,
  type EditorSettings,
  resolveSourceRect,
} from '../editor-settings';
import { optimizeImageLosslessly, transformImage } from '../engine/client';
import { toErrorMessage } from '../engine/errors';

export interface UseImagePreviewOptions {
  /** 源图字节；null 表示尚未就绪 */
  bytes: Uint8Array | null;
  sourceSize: ImageSize | null;
  sourceFormat: ImageFormat | null;
  /** 编辑器设置；null 表示尚未就绪，此时不做任何处理 */
  settings: EditorSettings | null;
  /** 防抖毫秒数 */
  debounceMs?: number;
}

export interface ImagePreviewState {
  /** 最近一次成功的处理结果；null 表示无变更或该格式不支持 */
  result: ImageProcessResult | null;
  /** 该结果对应的原图区域（拖动对比的同区域对齐） */
  resultSourceRect: ImageCrop | null;
  /** 是否有处理在进行中 */
  pending: boolean;
  /** 处理失败信息 */
  error: string | null;
  /** 设置未产生任何实际变更（画面即原图，无可保存内容） */
  noop: boolean;
  /** 无损优化不支持该格式（引擎返回 null，需给出说明而非静默无反应） */
  unsupported: boolean;
}

/** 按设置执行一次处理；操作无实际变更时标记 noop 且不调用引擎 */
async function processWithSettings(
  bytes: Uint8Array,
  settings: EditorSettings,
  sourceSize: ImageSize,
  sourceFormat: ImageFormat,
): Promise<{
  result: ImageProcessResult | null;
  sourceRect: ImageCrop | null;
  noop: boolean;
  unsupported: boolean;
}> {
  const sourceRect = resolveSourceRect(settings, sourceSize);

  if (settings.mode === 'lossless') {
    const result = await optimizeImageLosslessly(
      bytes,
      buildLosslessOptions(settings),
    );
    return {
      result,
      sourceRect,
      noop: false,
      unsupported: result === null,
    };
  }

  const operation = buildOperation(settings, sourceSize, sourceFormat);
  // 无实际变更时不做处理：否则会产出比原图更大、且没有保存意义的「结果」
  if (!isImageOperationEffective(operation)) {
    return { result: null, sourceRect, noop: true, unsupported: false };
  }

  return {
    result: await transformImage(bytes, operation),
    sourceRect,
    noop: false,
    unsupported: false,
  };
}

export function useImagePreview({
  bytes,
  sourceSize,
  sourceFormat,
  settings,
  debounceMs = 500,
}: UseImagePreviewOptions): ImagePreviewState & { refresh: () => void } {
  const [state, setState] = useState<ImagePreviewState>({
    result: null,
    resultSourceRect: null,
    pending: false,
    error: null,
    noop: true,
    unsupported: false,
  });

  const sequenceRef = useRef(0);
  const mountedRef = useRef(true);
  // 通过 ref 读取最新设置，避免把闭包过期问题带进依赖数组
  const latestRef = useRef({ bytes, sourceSize, sourceFormat, settings });
  latestRef.current = { bytes, sourceSize, sourceFormat, settings };

  // 设置序列化作为依赖：对象身份每次渲染都会变，必须比较内容
  const settingsKey = JSON.stringify(settings);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (): Promise<void> => {
    const current = latestRef.current;
    if (!current.bytes || !current.sourceSize || !current.settings) return;
    if (current.sourceFormat === null) return;

    const sequence = ++sequenceRef.current;
    setState((previous) => ({ ...previous, pending: true, error: null }));

    try {
      const { result, sourceRect, noop, unsupported } =
        await processWithSettings(
          current.bytes,
          current.settings,
          current.sourceSize,
          current.sourceFormat,
        );
      // 过期响应直接丢弃，避免旧结果覆盖新结果
      if (!mountedRef.current || sequence !== sequenceRef.current) return;
      setState({
        result,
        resultSourceRect: sourceRect,
        pending: false,
        error: null,
        noop,
        unsupported,
      });
    } catch (error) {
      if (!mountedRef.current || sequence !== sequenceRef.current) return;
      setState((previous) => ({
        ...previous,
        pending: false,
        error: toErrorMessage(error),
      }));
    }
  }, []);

  // settingsKey 变化即重新防抖处理（依赖配置的内容标识而非对象身份，否则每次渲染都会重置防抖）；
  // sourceFormat 仅用于 UI 提示，不参与处理
  useEffect(() => {
    if (!bytes || !sourceSize || !sourceFormat) return;
    const timer = setTimeout(() => {
      void run();
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [bytes, sourceSize, sourceFormat, settingsKey, debounceMs, run]);

  return { ...state, refresh: () => void run() };
}
