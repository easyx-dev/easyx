/**
 * 图片引擎加载状态订阅 Hook
 */
import { useCallback, useSyncExternalStore } from 'react';
import {
  ensureImageEngine,
  getImageEngineState,
  resetImageEngine,
  subscribeImageEngine,
} from '../engine/client';
import type { ImageEngineState } from '../engine/protocol';

export type UseImageEngineResult = ImageEngineState & {
  /** 引擎是否已就绪 */
  ready: boolean;
  /** 触发加载；已就绪时立即完成 */
  ensure: () => Promise<void>;
  /** 重置并重新加载（加载失败后使用） */
  retry: () => Promise<void>;
};

/** 订阅图片引擎加载状态，用于渲染进度、错误与重试入口 */
export function useImageEngine(): UseImageEngineResult {
  const state = useSyncExternalStore(
    subscribeImageEngine,
    getImageEngineState,
    getImageEngineState,
  );

  const retry = useCallback(() => {
    resetImageEngine();
    return ensureImageEngine();
  }, []);

  return {
    ...state,
    ready: state.stage === 'ready',
    ensure: ensureImageEngine,
    retry,
  };
}
