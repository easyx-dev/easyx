/**
 * 右侧控制栏：缩放 / 裁切 / 编码三组参数同屏可见
 */
import { Button, Divider, Space, Typography } from 'antd';
import type { ImageSize, ImageSniffResult } from '../../types';
import type { EditorSettings } from '../editor-settings';
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
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Text strong>缩放</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <ImageResizePanel
            sourceSize={sourceSize}
            value={settings.size}
            onChange={(size) => onPatch({ size })}
            disabled={lossless}
            disabledHint="无损优化不允许缩放：重采样会改变像素"
          />
        </div>
      </div>

      <Divider style={{ margin: 0 }} />

      <div>
        <Typography.Text strong>裁切</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space size="small" wrap>
              <Button size="small" onClick={onStartCrop} disabled={cropMode}>
                {crop ? '重新裁切' : '开始裁切'}
              </Button>
              {crop && (
                <Button
                  size="small"
                  onClick={() => onPatch({ crop: null })}
                  disabled={cropMode}
                >
                  清除裁切
                </Button>
              )}
            </Space>
            <Typography.Text type="secondary">
              {crop
                ? `裁切区 ${crop.width} × ${crop.height} @ (${crop.left}, ${crop.top})`
                : `未裁切，保持原画幅 ${sourceSize.width} × ${sourceSize.height}`}
            </Typography.Text>
          </Space>
        </div>
      </div>

      <Divider style={{ margin: 0 }} />

      <div>
        <Typography.Text strong>编码</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <ImageEncodePanel
            sourceFormat={info.format}
            value={settings}
            onChange={onPatch}
          />
        </div>
      </div>
    </Space>
  );
}
