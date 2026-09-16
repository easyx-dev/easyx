/**
 * 底部栏：体积对比 + 保存方式 + 保存动作；裁切模式下切换为「取消/应用裁切」
 */

import { Button, Divider, Radio, Space, Tag, Tooltip, Typography } from 'antd';
import type { ImageCrop, ImageProcessResult } from '../../types';
import { describeResultHint, type EditorSettings } from '../editor-settings';
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
    <>
      <Divider style={{ margin: '12px 0' }} />
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        {cropMode ? (
          <>
            <Typography.Text type="secondary">
              {cropDraft
                ? `裁切区 ${cropDraft.width} × ${cropDraft.height} @ (${cropDraft.left}, ${cropDraft.top})`
                : '拖动画面选择裁切范围'}
            </Typography.Text>
            <Space size="small">
              <Button onClick={() => onFinishCrop(false)}>取消裁切</Button>
              <Button
                type="primary"
                disabled={!cropDraft}
                onClick={() => onFinishCrop(true)}
              >
                应用裁切
              </Button>
            </Space>
          </>
        ) : (
          <>
            <Space size="small" wrap>
              <Typography.Text type="secondary">
                {formatBytes(sourceBytes)}
                {result && <> → {formatBytes(result.sizeAfter)}</>}
              </Typography.Text>
              {result && (
                <Tag
                  color={reduction > 0 ? 'green' : 'orange'}
                  style={{ marginInlineEnd: 0 }}
                >
                  {reduction > 0 ? '减小' : '增大'}{' '}
                  {Math.abs(reduction).toFixed(1)}%
                </Tag>
              )}
              {preview.pending ? (
                <Tag style={{ marginInlineEnd: 0 }}>处理中…</Tag>
              ) : preview.noop ? (
                <Tag style={{ marginInlineEnd: 0 }}>未做任何修改</Tag>
              ) : null}
              {preview.unsupported && (
                <Typography.Text type="warning" style={{ fontSize: 12 }}>
                  该格式不支持无损优化，请改用有损压缩或换用其他格式
                </Typography.Text>
              )}
              {hint && (
                <Typography.Text type="warning" style={{ fontSize: 12 }}>
                  {hint}
                </Typography.Text>
              )}
            </Space>

            <Space size="small">
              <Radio.Group
                size="small"
                optionType="button"
                value={saveMode}
                onChange={(event) => onSaveModeChange(event.target.value)}
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
              />
              <Button onClick={onClose} disabled={saving}>
                取消
              </Button>
              <Button
                type="primary"
                loading={saving}
                disabled={
                  preview.noop ||
                  !result ||
                  preview.pending ||
                  preview.error !== null
                }
                onClick={() => result && void onSave(result)}
              >
                保存
              </Button>
            </Space>
          </>
        )}
      </div>
    </>
  );
}
