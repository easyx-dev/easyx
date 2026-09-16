/**
 * 预览区：默认显示「原图 ↔ 处理后」拖动对比；进入裁切模式时切换为裁切台
 *
 * 状态（处理中 / 无变更 / 体积）集中在底部状态栏展示，预览区只保留画面本身，
 * 仅在处理失败时用 Alert —— 避免一屏堆叠多块提示色块。
 */
import type { ImageCrop, ImageSize } from '../../types';
import { Alert, Button } from '../primitives';
import { ImageCompareSlider } from './ImageCompareSlider';
import { ImageCropStage } from './ImageCropStage';
import type { PreviewBundle } from './ImageEditorModal';

/** 预览区高度 */
export const STAGE_HEIGHT = 420;

export interface ImageEditorStageProps {
  src: string;
  sourceSize: ImageSize;
  preview: PreviewBundle;
  cropMode: boolean;
  aspect: number | undefined;
  onAspectChange: (aspect: number | undefined) => void;
  onCropDraftChange: (crop: ImageCrop) => void;
}

export function ImageEditorStage({
  src,
  sourceSize,
  preview,
  cropMode,
  aspect,
  onAspectChange,
  onCropDraftChange,
}: ImageEditorStageProps) {
  if (cropMode) {
    return (
      <ImageCropStage
        aspect={aspect}
        height={STAGE_HEIGHT}
        imageUrl={src}
        onAspectChange={onAspectChange}
        onCropAreaChange={onCropDraftChange}
      />
    );
  }

  return (
    <>
      <ImageCompareSlider
        height={STAGE_HEIGHT}
        resultSize={preview.result?.meta ?? null}
        resultSourceRect={preview.resultSourceRect}
        resultUrl={preview.resultUrl}
        sourceSize={sourceSize}
        sourceUrl={src}
      />
      {preview.error && (
        <Alert
          action={
            <Button onClick={preview.refresh} size="sm">
              重试
            </Button>
          }
          className="easyx-image-toolkit__stage-alert"
          description={preview.error}
          showIcon
          title="处理失败"
          type="error"
        />
      )}
    </>
  );
}
