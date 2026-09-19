/**
 * 图片编辑内容区：裁切、缩放、压缩全部在浏览器内完成
 *
 * 只产出内容本身，不含任何容器外壳（遮罩、标题、关闭、ESC、锁滚动、焦点循环、portal），
 * 由宿主自行放入对话框、抽屉或页面。根节点自带令牌作用域类，脱离宿主 DOM 层级也能取到样式。
 *
 * 组件不承载保存动作：处理结果经 onResultChange 交给宿主，由宿主决定下载、上传或落库。
 * 负责源图读取与引擎门控，编辑主体见 ImageEditorBody。
 */
import { useEffect, useRef, useState } from 'react';
import { IMAGE_LIMITS, isProcessableFormat } from '../../limits';
import { sniffImage } from '../../sniff';
import type { ImageSniffResult } from '../../types';
import { toErrorMessage } from '../engine/errors';
import { Alert, Spin, Text } from '../primitives';
import { cx, scopeClass } from '../utils/cx';
import { ImageEditorBody } from './ImageEditorBody';
import { ImageEngineGate } from './ImageEngineGate';
import type { ImageEditorResult } from './types';

export interface ImageEditorProps {
  /** 源图地址（如 /uploads/cover.png） */
  src: string;
  /**
   * 预览状态变化时回调；保存 / 下载等动作由宿主自行实现。
   * result 为 null 表示当前设置无实际变更、尚不可保存，或源图尚未就绪 / 不可编辑。
   */
  onResultChange?: (state: ImageEditorResult) => void;
  /**
   * 强制暗色主题；缺省时按「宿主 [data-theme] 祖先 → 系统偏好」判定。
   * 仅当宿主用类名等 CSS 覆盖不到的方式表达主题时才需要显式传入。
   */
  theme?: 'light' | 'dark';
}

/** 读取源图字节并嗅探格式；非图片返回 null */
async function fetchSource(
  src: string,
): Promise<{ bytes: Uint8Array; info: ImageSniffResult } | null> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? '原图文件不存在或已被清理'
        : `读取原图失败：HTTP ${response.status}`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > IMAGE_LIMITS.maxInputBytes) {
    throw new Error(
      `文件超过 ${Math.round(IMAGE_LIMITS.maxInputBytes / 1024 / 1024)} MB，不在浏览器内处理`,
    );
  }
  const info = sniffImage(bytes);
  return info ? { bytes, info } : null;
}

export function ImageEditor({ src, onResultChange, theme }: ImageEditorProps) {
  const [source, setSource] = useState<{
    bytes: Uint8Array;
    info: ImageSniffResult;
  } | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSource(null);
    setLoadError(null);
    setLoadingSource(true);

    let cancelled = false;
    fetchSource(src)
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded) {
          setLoadError('无法识别的图片格式');
          return;
        }
        setSource(loaded);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(toErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingSource(false);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const processable =
    source !== null && isProcessableFormat(source.info.format);

  // 经 ref 读取回调：宿主每次渲染传新函数也不会重复触发上报
  const onResultChangeRef = useRef(onResultChange);
  onResultChangeRef.current = onResultChange;

  // 未渲染编辑主体时（加载中 / 读取失败 / 格式不支持）也要上报一次空结果，
  // 否则宿主会保留上一个源的结果，把旧产物当成新图的产物；
  // 主体挂载后由 ImageEditorBody 自己上报真实状态。
  useEffect(() => {
    if (processable) return;
    onResultChangeRef.current?.({
      error: loadError,
      noop: false,
      pending: loadingSource,
      result: null,
      unsupported: false,
    });
  }, [processable, loadError, loadingSource]);

  return (
    <div
      className={cx(
        scopeClass(theme === 'dark'),
        'easyx-image-toolkit__editor-panel',
      )}
    >
      <Spin spinning={loadingSource}>
        {loadError ? (
          <Alert
            description={loadError}
            showIcon
            title="读取原图失败"
            type="error"
          />
        ) : !source ? (
          <div className="easyx-image-toolkit__placeholder" />
        ) : !processable ? (
          <div className="easyx-image-toolkit__center-note">
            <Text
              className="easyx-image-toolkit__center-note-line"
              tone="warning"
            >
              {source.info.format.toUpperCase()} 格式不支持编辑
            </Text>
            <Text
              className="easyx-image-toolkit__center-note-line"
              size="xs"
              tone="secondary"
            >
              当前仅支持 JPEG / PNG / WebP / GIF / TIFF。
            </Text>
          </div>
        ) : (
          <ImageEngineGate>
            <ImageEditorBody
              bytes={source.bytes}
              info={source.info}
              onResultChange={onResultChange}
              src={src}
            />
          </ImageEngineGate>
        )}
      </Spin>
    </div>
  );
}
