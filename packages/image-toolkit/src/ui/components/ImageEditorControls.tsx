/**
 * 右侧控制栏：缩放 / 裁切 / 编码三组参数同屏可见
 */
import type { ImageSize, ImageSniffResult } from '../../types';
import type { EditorSettings } from '../editor-settings';
import { Button, Stack, Text } from '../primitives';
import { ImageEncodePanel } from './ImageEncodePanel';
import { ImageResizePanel } from './ImageResizePanel';

export interface ImageEditorControlsProps {
  sourceSize: ImageSize;
  info: ImageSniffResult;
  settings: EditorSettings;
  onPatch: (patch: Partial<EditorSettings>) => void;
  cropMode: boolean;
  onStartCrop: () => void;
}

export function ImageEditorControls({
  sourceSize,
  info,
  settings,
  onPatch,
  cropMode,
  onStartCrop,
}: ImageEditorControlsProps) {
  const lossless = settings.mode === 'lossless';
  const crop = settings.crop;

  return (
    <div>
      <section className="easyx-image-toolkit__group">
        <Text className="easyx-image-toolkit__group-title">缩放</Text>
        <div className="easyx-image-toolkit__group-body">
          <ImageResizePanel
            disabled={lossless}
            disabledHint="无损优化不允许缩放：重采样会改变像素"
            onChange={(size) => onPatch({ size })}
            sourceSize={sourceSize}
            value={settings.size}
          />
        </div>
      </section>

      <section className="easyx-image-toolkit__group">
        <Text className="easyx-image-toolkit__group-title">裁切</Text>
        <div className="easyx-image-toolkit__group-body">
          <Stack size="sm">
            <Stack direction="row" size="sm" wrap>
              <Button disabled={cropMode} onClick={onStartCrop} size="sm">
                {crop ? '重新裁切' : '开始裁切'}
              </Button>
              {crop && (
                <Button
                  disabled={cropMode}
                  onClick={() => onPatch({ crop: null })}
                  size="sm"
                >
                  清除裁切
                </Button>
              )}
            </Stack>
            <Text size="xs" tone="secondary">
              {crop
                ? `裁切区 ${crop.width} × ${crop.height} @ (${crop.left}, ${crop.top})`
                : `未裁切，保持原画幅 ${sourceSize.width} × ${sourceSize.height}`}
            </Text>
          </Stack>
        </div>
      </section>

      <section className="easyx-image-toolkit__group">
        <Text className="easyx-image-toolkit__group-title">编码</Text>
        <div className="easyx-image-toolkit__group-body">
          <ImageEncodePanel
            onChange={onPatch}
            sourceFormat={info.format}
            value={settings}
          />
        </div>
      </section>
    </div>
  );
}
