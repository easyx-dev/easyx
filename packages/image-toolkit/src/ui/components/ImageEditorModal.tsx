/**
 * 图片编辑弹窗：裁切、缩放、压缩全部在浏览器内完成，仅「保存」才写回服务端
 *
 * 单视图布局：左侧大预览（拖动对比 / 裁切台），右侧控制栏三组参数同屏可见，
 * 底部常驻体积对比与保存动作。参数变化后自动防抖预览，无需手动「生成」。
 */
import { useCallback, useEffect, useState } from 'react';
import { IMAGE_LIMITS, isProcessableFormat } from '../../limits';
import { sniffImage } from '../../sniff';
import type {
  ImageCrop,
  ImageProcessResult,
  ImageSize,
  ImageSniffResult,
} from '../../types';
import {
  applySettingsPatch,
  buildSaveAsName,
  createDefaultSettings,
  type EditorSettings,
} from '../editor-settings';
import { probeImage } from '../engine/client';
import { toErrorMessage } from '../engine/errors';
import { useImagePreview } from '../hooks/useImagePreview';
import { Alert, Modal, Spin, Text } from '../primitives';
import { ImageEditorControls } from './ImageEditorControls';
import { ImageEditorFooter } from './ImageEditorFooter';
import { ImageEditorStage } from './ImageEditorStage';
import { ImageEngineGate } from './ImageEngineGate';

/** 预览结果集合：由 EditorBody 统一持有，避免预览区与底栏各跑一次引擎 */
export interface PreviewBundle {
  result: ImageProcessResult | null;
  /** 处理后图像的 Object URL */
  resultUrl: string | null;
  /** 结果对应的原图区域（拖动对比的同区域对齐） */
  resultSourceRect: ImageCrop | null;
  pending: boolean;
  error: string | null;
  /** 设置未产生任何实际变更 */
  noop: boolean;
  /** 无损优化不支持该格式 */
  unsupported: boolean;
  refresh: () => void;
}

export interface ImageEditorModalProps {
  open: boolean;
  /** 源图地址（如 /uploads/cover.png） */
  src: string;
  /** 源文件名，用于生成「另存为」文件名 */
  fileName: string;
  /** 覆盖原图；由宿主注入（负责权限与审计） */
  onReplace: (result: ImageProcessResult) => Promise<void>;
  /** 另存为新文件；不传则不展示该选项 */
  onSaveAsNew?: (result: ImageProcessResult, fileName: string) => Promise<void>;
  /**
   * 显式主题；缺省时按「宿主 [data-theme] 祖先 → 系统偏好」判定
   * 弹窗渲染在 portal 中，宿主若把 data-theme 挂在 html 之外的祖先上则继承不到
   */
  theme?: 'light' | 'dark';
  onClose: () => void;
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

/** 嗅探能给出尺寸时直接采用；给出 null 的格式（如 TIFF）由引擎补测 */
function sniffedSize(info: ImageSniffResult): ImageSize | null {
  if (info.width !== null && info.height !== null) {
    return { height: info.height, width: info.width };
  }
  return null;
}

export function ImageEditorModal({
  open,
  src,
  fileName,
  onReplace,
  onSaveAsNew,
  theme,
  onClose,
}: ImageEditorModalProps) {
  const [source, setSource] = useState<{
    bytes: Uint8Array;
    info: ImageSniffResult;
  } | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, src]);

  const processable =
    source !== null && isProcessableFormat(source.info.format);

  return (
    <Modal
      onClose={onClose}
      open={open}
      theme={theme}
      title={`编辑图片 · ${fileName}`}
      width="min(1280px, 92vw)"
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
            <EditorBody
              bytes={source.bytes}
              fileName={fileName}
              info={source.info}
              onClose={onClose}
              onReplace={onReplace}
              onSaveAsNew={onSaveAsNew}
              src={src}
            />
          </ImageEngineGate>
        )}
      </Spin>
    </Modal>
  );
}

interface EditorBodyProps {
  bytes: Uint8Array;
  info: ImageSniffResult;
  src: string;
  fileName: string;
  onReplace: (result: ImageProcessResult) => Promise<void>;
  onSaveAsNew?: (result: ImageProcessResult, fileName: string) => Promise<void>;
  onClose: () => void;
}

function EditorBody({
  bytes,
  info,
  src,
  fileName,
  onReplace,
  onSaveAsNew,
  onClose,
}: EditorBodyProps) {
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
  const [saveMode, setSaveMode] = useState<'replace' | 'saveAs'>('saveAs');
  const [saving, setSaving] = useState(false);
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

  // 唯一的预览来源：预览区与底栏共用同一次处理结果
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
    <>
      <div className="easyx-image-toolkit__editor">
        <div className="easyx-image-toolkit__editor-stage">
          <ImageEditorStage
            aspect={aspect}
            cropMode={cropMode}
            onAspectChange={setAspect}
            onCropDraftChange={setCropDraft}
            preview={bundle}
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
              setCropDraft(settings.crop);
              setAspect(undefined);
              setCropMode(true);
            }}
            settings={settings}
            sourceSize={sourceSize}
          />
        </div>
      </div>

      <ImageEditorFooter
        allowSaveAs={onSaveAsNew !== undefined}
        cropDraft={cropDraft}
        cropMode={cropMode}
        onClose={onClose}
        onFinishCrop={(applied) => {
          if (applied) patchSettings({ crop: cropDraft });
          setCropMode(false);
        }}
        onSave={async (next) => {
          setSaving(true);
          try {
            if (saveMode === 'saveAs' && onSaveAsNew) {
              await onSaveAsNew(next, buildSaveAsName(fileName, next.mimeType));
            } else {
              await onReplace(next);
            }
            onClose();
          } catch (error) {
            // 用户可见的错误提示由宿主负责（保存回调调用方已统一提示）；
            // 此处吞掉避免未捕获的 promise rejection，保留 console 诊断
            console.warn('[图片编辑] 保存失败', error);
          } finally {
            setSaving(false);
          }
        }}
        onSaveModeChange={setSaveMode}
        preview={bundle}
        saveMode={saveMode}
        saving={saving}
        settings={settings}
        sourceBytes={bytes.byteLength}
        sourceMimeType={info.mimeType}
      />
    </>
  );
}
