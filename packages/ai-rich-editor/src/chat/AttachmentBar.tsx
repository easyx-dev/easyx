/**
 * 对话输入框附件条
 *
 * 展示待发附件：本地文件在点发送时才上传（此处显示上传进度），
 * 从媒体库选中的条目已带地址，直接就绪。
 */
import type { PendingAttachment } from '../media/attachment';
import { formatBytes, mediaKindLabel } from '../media/routing';
import { cx } from '../ui/cx';
import { IconClose, MEDIA_KIND_ICONS } from '../ui/icons';

export interface AttachmentBarProps {
  attachments: readonly PendingAttachment[];
  /** 上传中禁止移除，避免上传结果落不回附件 */
  disabled?: boolean;
  /** 展示位置：输入框（可移除，带进度） / 消息气泡（只读） */
  variant?: 'composer' | 'message';
  onRemove?: (id: string) => void;
}

export function AttachmentBar({
  attachments,
  disabled,
  variant = 'composer',
  onRemove,
}: AttachmentBarProps) {
  if (attachments.length === 0) return null;

  return (
    <div
      className={cx(
        'easyx-ai-rich-editor__attachments',
        `easyx-ai-rich-editor__attachments--${variant}`,
      )}
    >
      {attachments.map((attachment) => {
        const Icon = MEDIA_KIND_ICONS[attachment.kind];
        const meta =
          attachment.size != null
            ? formatBytes(attachment.size)
            : mediaKindLabel(attachment.kind);
        return (
          <span
            className="easyx-ai-rich-editor__attachment"
            key={attachment.id}
          >
            <span className="easyx-ai-rich-editor__attachment-icon">
              <Icon size={12} />
            </span>
            <span
              className="easyx-ai-rich-editor__attachment-name"
              title={attachment.name}
            >
              {attachment.name}
            </span>
            <span className="easyx-ai-rich-editor__attachment-meta">
              {meta}
            </span>
            {!disabled && onRemove && (
              <button
                aria-label={`移除 ${attachment.name}`}
                className="easyx-ai-rich-editor__attachment-remove"
                onClick={() => onRemove(attachment.id)}
                type="button"
              >
                <IconClose size={11} />
              </button>
            )}
            {attachment.progress > 0 && attachment.progress < 1 && (
              <span className="easyx-ai-rich-editor__attachment-progress">
                <span
                  style={{
                    width: `${Math.round(attachment.progress * 100)}%`,
                  }}
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
