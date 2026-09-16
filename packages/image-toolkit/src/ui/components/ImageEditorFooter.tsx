/**
 * 底部栏：体积对比 + 保存方式 + 保存动作；裁切模式下切换为「取消/应用裁切」
 */
import type { ImageCrop, ImageProcessResult } from '../../types';
import { describeResultHint, type EditorSettings } from '../editor-settings';
import { Button, Segmented, Stack, Tag, Text, Tooltip } from '../primitives';
import { formatBytes } from '../utils/format-bytes';
import type { PreviewBundle } from './ImageEditorModal';

export interface ImageEditorFooterProps {
  sourceBytes: number;
  sourceMimeType: string;
  preview: PreviewBundle;
  cropMode: boolean;
  cropDraft: ImageCrop | null;
  onFinishCrop: (applied: boolean) => void;
  settings: EditorSettings;
  saveMode: 'replace' | 'saveAs';
  onSaveModeChange: (mode: 'replace' | 'saveAs') => void;
  allowSaveAs: boolean;
  saving: boolean;
  onSave: (result: ImageProcessResult) => Promise<void>;
  onClose: () => void;
}

export function ImageEditorFooter({
  sourceBytes,
  sourceMimeType,
  preview,
  cropMode,
  cropDraft,
  onFinishCrop,
  saveMode,
  onSaveModeChange,
  allowSaveAs,
  saving,
  onSave,
  onClose,
}: ImageEditorFooterProps) {
  const result = preview.result;
  const reduction =
    result && result.sizeBefore > 0
      ? (1 - result.sizeAfter / result.sizeBefore) * 100
      : 0;
  const hint = result ? describeResultHint(result, sourceMimeType) : null;

  return (
    <div className="easyx-image-toolkit__footer">
      {cropMode ? (
        <>
          <Text size="xs" tone="secondary">
            {cropDraft
              ? `裁切区 ${cropDraft.width} × ${cropDraft.height} @ (${cropDraft.left}, ${cropDraft.top})`
              : '拖动画面选择裁切范围'}
          </Text>
          <div className="easyx-image-toolkit__footer-actions">
            <Button onClick={() => onFinishCrop(false)}>取消裁切</Button>
            <Button
              disabled={!cropDraft}
              onClick={() => onFinishCrop(true)}
              variant="primary"
            >
              应用裁切
            </Button>
          </div>
        </>
      ) : (
        <>
          <Stack direction="row" size="sm" wrap>
            <Text size="xs" tone="secondary">
              {formatBytes(sourceBytes)}
              {result && <> → {formatBytes(result.sizeAfter)}</>}
            </Text>
            {result && (
              <Tag tone={reduction > 0 ? 'success' : 'warning'}>
                {reduction > 0 ? '减小' : '增大'}{' '}
                {Math.abs(reduction).toFixed(1)}%
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

          <div className="easyx-image-toolkit__footer-actions">
            <Segmented
              aria-label="保存方式"
              onChange={onSaveModeChange}
              options={[
                ...(allowSaveAs
                  ? [{ label: '另存为', value: 'saveAs' as const }]
                  : []),
                {
                  label: (
                    <Tooltip title="覆盖后原图不可恢复，已引用该图的位置会同步变化">
                      <span>覆盖原图</span>
                    </Tooltip>
                  ),
                  value: 'replace' as const,
                },
              ]}
              value={saveMode}
            />
            <Button disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={
                preview.noop ||
                !result ||
                preview.pending ||
                preview.error !== null
              }
              loading={saving}
              onClick={() => result && void onSave(result)}
              variant="primary"
            >
              保存
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
