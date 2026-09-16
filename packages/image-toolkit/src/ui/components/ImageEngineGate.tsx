/**
 * 图片引擎门控：就绪后渲染子内容，加载中展示进度，失败提供重试入口
 */

import { type ReactNode, useEffect } from 'react';
import type { ImageEngineState } from '../engine/protocol';
import { useImageEngine } from '../hooks/useImageEngine';
import { Alert, Button, Progress, Stack, Text } from '../primitives';
import { formatBytes } from '../utils/format-bytes';

export interface ImageEngineGateProps {
  children: ReactNode;
}

/** 拼装加载中的提示文案：无可靠总长度时只展示已下载量 */
function buildLoadingHint(state: ImageEngineState): string {
  if (state.stage === 'instantiating') return '正在初始化图片引擎…';
  if (state.stage === 'downloading') {
    const loaded = formatBytes(state.loaded);
    return state.total === null
      ? `正在下载图片引擎 ${loaded}`
      : `正在下载图片引擎 ${loaded} / ${formatBytes(state.total)}`;
  }
  return '正在准备图片引擎…';
}

export function ImageEngineGate({ children }: ImageEngineGateProps) {
  const engine = useImageEngine();
  const { ensure } = engine;

  // 挂载即触发加载（并发调用由客户端去重），避免门控停在 idle 上空转
  useEffect(() => {
    ensure().catch(() => {
      // 失败态由 engine.stage 呈现，此处吞掉以避免未处理的 rejection
    });
  }, [ensure]);

  if (engine.stage === 'ready') return <>{children}</>;

  if (engine.stage === 'error') {
    return (
      <Alert
        action={
          <Button onClick={() => void engine.retry()} size="sm">
            重试
          </Button>
        }
        description={engine.message}
        showIcon
        title="图片引擎加载失败"
        type="error"
      />
    );
  }

  const percent =
    engine.stage === 'downloading' && engine.ratio !== null
      ? Math.round(engine.ratio * 100)
      : null;

  return (
    <Stack size="sm">
      <Progress aria-label="图片引擎加载进度" percent={percent} />
      <Text size="xs" tone="secondary">
        {buildLoadingHint(engine)}
      </Text>
    </Stack>
  );
}
