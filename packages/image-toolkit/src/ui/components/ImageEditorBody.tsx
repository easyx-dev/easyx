/**
 * 编辑内容区主体：源图就绪且引擎可用后，才挂载预览舞台与控制栏
 *
 * 持有全部编辑状态（设置、裁切草稿），并作为唯一的预览来源 ——
 * 预览舞台与状态区共用同一次引擎处理结果，避免两处各跑一次。
 * 处理结果经 onResultChange 交给宿主，保存 / 下载由宿主自行实现。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { IMAGE_LIMITS } from '../../limits';
import type { ImageCrop, ImageSize, ImageSniffResult } from '../../types';
import {
  applySettingsPatch,
  createDefaultSettings,
  type EditorSettings,
} from '../editor-settings';
import { probeImage } from '../engine/client';
import { useImagePreview } from '../hooks/useImagePreview';
import { Spin, Text } from '../primitives';
import { ImageEditorControls } from './ImageEditorControls';
import { ImageEditorStage } from './ImageEditorStage';
import type { ImageEditorResult, PreviewBundle } from './types';

export interface ImageEditorBodyProps {
  bytes: Uint8Array;
  info: ImageSniffResult;
  src: string;
  onResultChange?: (state: ImageEditorResult) => void;
}

/** 嗅探能给出尺寸时直接采用；给出 null 的格式（如 TIFF）由引擎补测 */
function sniffedSize(info: ImageSniffResult): ImageSize | null {
  if (info.width !== null && info.height !== null) {
    return { height: info.height, width: info.width };
  }
  return null;
}

export function ImageEditorBody({
  bytes,
  info,
  src,
  onResultChange,
}: ImageEditorBodyProps) {
  const [sourceSize, setSourceSize] = useState<ImageSize | null>(
    sniffedSize(info),
  );
  const [settings, setSettings] = useState<EditorSettings | null>(() => {
    const size = sniffedSize(info);
    return size ? createDefaultSettings(size) : null;
  });

  const [cropMode, setCropMode] = useState(false);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [cropDraft, setCropDraft] = useState<ImageCrop | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // 嗅探给不出尺寸时（TIFF）用引擎补测
  useEffect(() => {
    if (sourceSize) return;
    let cancelled = false;
    probeImage(bytes).then((meta) => {
      if (cancelled || !meta) return;
      const size = { height: meta.height, width: meta.width };
      setSourceSize(size);
      setSettings(createDefaultSettings(size));
    });
    return () => {
      cancelled = true;
    };
  }, [bytes, sourceSize]);

  // 唯一的预览来源：预览区与状态区共用同一次处理结果
  const preview = useImagePreview({
    bytes,
    settings,
    sourceFormat: info.format,
    sourceSize,
  });
  const result = preview.result;

  // 结果字节转 Object URL 供预览，替换时释放
  useEffect(() => {
    if (!result) {
      setResultUrl(null);
      return;
    }
    // slice 复制出新 ArrayBuffer，避免 Uint8Array<ArrayBufferLike> 无法作为 BlobPart
    const copy = result.data.slice();
    const url = URL.createObjectURL(
      new Blob([copy], { type: result.mimeType }),
    );
    setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  // 经 ref 读取回调：宿主每次渲染传新函数也不会重复触发上报
  const onResultChangeRef = useRef(onResultChange);
  onResultChangeRef.current = onResultChange;

  useEffect(() => {
    onResultChangeRef.current?.({
      error: preview.error,
      noop: preview.noop,
      pending: preview.pending,
      result: preview.result,
      unsupported: preview.unsupported,
    });
  }, [
    preview.error,
    preview.noop,
    preview.pending,
    preview.result,
    preview.unsupported,
  ]);

  // 设置更新入口：收敛「无损不允许缩放」等模式联动
  const patchSettings = useCallback(
    (patch: Partial<EditorSettings>) => {
      setSettings((current) =>
        current && sourceSize
          ? applySettingsPatch(current, patch, sourceSize, info.format)
          : current,
      );
    },
    [sourceSize, info.format],
  );

  if (!sourceSize || !settings)
    return (
      <div>
        <Spin />
      </div>
    );

  // 像素上限：超大图在 wasm 内解码/编码会吃掉大量内存，直接拒绝而非硬跑
  if (sourceSize.width * sourceSize.height > IMAGE_LIMITS.maxInputPixels) {
    return (
      <div className="easyx-image-toolkit__center-note">
        <Text className="easyx-image-toolkit__center-note-line" tone="warning">
          图片像素过大（{sourceSize.width} × {sourceSize.height}
          ），不在浏览器内处理
        </Text>
        <Text
          className="easyx-image-toolkit__center-note-line"
          size="xs"
          tone="secondary"
        >
          当前上限为 {Math.round(IMAGE_LIMITS.maxInputPixels / 1_000_000)}{' '}
          万像素。
        </Text>
      </div>
    );
  }

  const bundle: PreviewBundle = { ...preview, resultUrl };

  return (
    <div className="easyx-image-toolkit__editor">
      <div className="easyx-image-toolkit__editor-stage">
        <ImageEditorStage
          aspect={aspect}
          cropDraft={cropDraft}
          cropMode={cropMode}
          onAspectChange={setAspect}
          onCropDraftChange={setCropDraft}
          onFinishCrop={(applied) => {
            if (applied) {
              // 框住整幅图等价于未裁切：归一化为 null，省掉引擎里一次无意义的裁切
              const full =
                cropDraft !== null &&
                cropDraft.left === 0 &&
                cropDraft.top === 0 &&
                cropDraft.width === sourceSize.width &&
                cropDraft.height === sourceSize.height;
              patchSettings({ crop: full ? null : cropDraft });
            }
            setCropMode(false);
          }}
          preview={bundle}
          sourceBytes={bytes.byteLength}
          sourceMimeType={info.mimeType}
          sourceSize={sourceSize}
          src={src}
        />
      </div>
      <div className="easyx-image-toolkit__editor-side">
        <ImageEditorControls
          cropMode={cropMode}
          info={info}
          onPatch={patchSettings}
          onStartCrop={() => {
            // 用当前裁切区；没有则从整幅图起步（与裁切台的初始框保持一致）
            setCropDraft(
              settings.crop ?? {
                height: sourceSize.height,
                left: 0,
                top: 0,
                width: sourceSize.width,
              },
            );
            setAspect(undefined);
            setCropMode(true);
          }}
          settings={settings}
          sourceSize={sourceSize}
        />
      </div>
    </div>
  );
}
