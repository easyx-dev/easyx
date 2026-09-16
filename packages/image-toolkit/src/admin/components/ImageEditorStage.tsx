/**
 * 预览区：默认显示「原图 ↔ 处理后」拖动对比；进入裁切模式时切换为裁切台
 *
 * 状态（处理中 / 无变更 / 体积）集中在底部状态栏展示，预览区只保留画面本身，
 * 仅在处理失败时用 Alert —— 避免一屏堆叠多块提示色块。
 */
import { Alert, Button } from 'antd';
import type { ImageCrop, ImageSize } from '../../types';
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
        imageUrl={src}
        aspect={aspect}
        onAspectChange={onAspectChange}
        onCropAreaChange={onCropDraftChange}
        height={STAGE_HEIGHT}
      />
    );
  }

  return (
    <>
      <ImageCompareSlider
        sourceUrl={src}
        sourceSize={sourceSize}
        resultUrl={preview.resultUrl}
        resultSize={preview.result?.meta ?? null}
        resultSourceRect={preview.resultSourceRect}
        height={STAGE_HEIGHT}
      />
      {preview.error && (
        <Alert
          style={{ marginTop: 8 }}
          type="error"
          showIcon
          title="处理失败"
          description={preview.error}
          action={
            <Button size="small" onClick={preview.refresh}>
              重试
            </Button>
          }
        />
      )}
    </>
  );
}
