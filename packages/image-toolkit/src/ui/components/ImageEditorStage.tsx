/**
 * 预览区：默认显示「原图 ↔ 处理后」拖动对比；进入裁切模式时切换为裁切台
 *
 * 处理状态（体积增减、处理中、未做任何修改、格式不支持、结果建议）集中在预览下方，
 * 与画面同屏；处理失败时给出重试入口。
 */
import type { ImageCrop, ImageSize } from '../../types';
import { describeResultHint } from '../editor-settings';
import { Alert, Button, Stack, Tag, Text } from '../primitives';
import { formatBytes } from '../utils/format-bytes';
import { ImageCompareSlider } from './ImageCompareSlider';
import { ImageCropStage } from './ImageCropStage';
import type { PreviewBundle } from './types';

/** 预览区高度 */
export const STAGE_HEIGHT = 420;

export interface ImageEditorStageProps {
  src: string;
  sourceSize: ImageSize;
  sourceBytes: number;
  sourceMimeType: string;
  preview: PreviewBundle;
  cropMode: boolean;
  /** 进入裁切时的初始裁切区；null 表示整幅图 */
  cropDraft: ImageCrop | null;
  aspect: number | undefined;
  onAspectChange: (aspect: number | undefined) => void;
  onCropDraftChange: (crop: ImageCrop) => void;
  /** 结束裁切：true 表示应用当前裁切区 */
  onFinishCrop: (applied: boolean) => void;
}

export function ImageEditorStage({
  src,
  sourceSize,
  sourceBytes,
  sourceMimeType,
  preview,
  cropMode,
  cropDraft,
  aspect,
  onAspectChange,
  onCropDraftChange,
  onFinishCrop,
}: ImageEditorStageProps) {
  if (cropMode) {
    return (
      <ImageCropStage
        aspect={aspect}
        height={STAGE_HEIGHT}
        imageUrl={src}
        initialCrop={cropDraft}
        onApply={() => onFinishCrop(true)}
        onAspectChange={onAspectChange}
        onCancel={() => onFinishCrop(false)}
        onCropAreaChange={onCropDraftChange}
        sourceSize={sourceSize}
      />
    );
  }

  const result = preview.result;
  const reduction =
    result && result.sizeBefore > 0
      ? (1 - result.sizeAfter / result.sizeBefore) * 100
      : 0;
  const hint = result ? describeResultHint(result, sourceMimeType) : null;

  return (
    <>
      <ImageCompareSlider
        height={STAGE_HEIGHT}
        resultSize={result?.meta ?? null}
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

      <Stack
        className="easyx-image-toolkit__stage-status"
        direction="row"
        size="sm"
        wrap
      >
        <Text size="xs" tone="secondary">
          {formatBytes(sourceBytes)}
          {result && <> → {formatBytes(result.sizeAfter)}</>}
        </Text>
        {result && (
          <Tag tone={reduction > 0 ? 'success' : 'warning'}>
            {reduction > 0 ? '减小' : '增大'} {Math.abs(reduction).toFixed(1)}%
          </Tag>
        )}
        {preview.pending ? (
          <Tag>处理中…</Tag>
        ) : preview.noop ? (
          <Tag>未做任何修改</Tag>
        ) : null}
        {preview.unsupported && (
          <Text size="xs" tone="warning">
            该格式不支持无损优化，请改用有损压缩或换用其他格式
          </Text>
        )}
        {hint && (
          <Text size="xs" tone="warning">
            {hint}
          </Text>
        )}
      </Stack>
    </>
  );
}
