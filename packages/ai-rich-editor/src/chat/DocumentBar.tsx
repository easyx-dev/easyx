/**
 * 对话文档条（Word / PDF）
 *
 * 展示待发文档的解析状态：解析中 / 已解析（页数或字数）/ 解析失败（可重试）。
 * 与媒体附件条共用视觉语言，只是数据来源不同（本地或服务端解析，而非上传）。
 */
import { formatBytes } from '../media/routing';
import type { PendingDocument } from '../parsers/document-state';
import { cx } from '../ui/cx';
import { IconClose, IconFile, IconReload } from '../ui/icons';

export interface DocumentBarProps {
  documents: readonly PendingDocument[];
  /** 生成/上传/解析中禁止移除与重试 */
  disabled?: boolean;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
}

/** 状态描述：解析中 / 页数 / 字数 / 失败原因 */
function statusText(doc: PendingDocument): string {
  if (doc.status === 'parsing') return '解析中…';
  if (doc.status === 'error') return doc.error ?? '解析失败';
  const length = (doc.result?.html ?? doc.result?.text ?? '').length;
  if (doc.result?.pageCount) return `${doc.result.pageCount} 页 · ${length} 字`;
  return length > 0 ? `${length} 字` : formatBytes(doc.size);
}

export function DocumentBar({
  documents,
  disabled,
  onRemove,
  onRetry,
}: DocumentBarProps) {
  if (documents.length === 0) return null;

  return (
    <div className="easyx-ai-rich-editor__attachments easyx-ai-rich-editor__attachments--composer">
      {documents.map((doc) => (
        <span
          className={cx(
            'easyx-ai-rich-editor__attachment',
            doc.status === 'error' && 'easyx-ai-rich-editor__attachment--error',
          )}
          key={doc.id}
        >
          <span className="easyx-ai-rich-editor__attachment-icon">
            <IconFile size={12} />
          </span>
          <span
            className="easyx-ai-rich-editor__attachment-name"
            title={doc.name}
          >
            {doc.name}
          </span>
          <span className="easyx-ai-rich-editor__attachment-meta">
            {statusText(doc)}
          </span>
          {doc.status === 'error' && !disabled && onRetry && (
            <button
              aria-label={`重试 ${doc.name}`}
              className="easyx-ai-rich-editor__attachment-remove"
              onClick={() => onRetry(doc.id)}
              type="button"
            >
              <IconReload size={11} />
            </button>
          )}
          {!disabled && onRemove && (
            <button
              aria-label={`移除 ${doc.name}`}
              className="easyx-ai-rich-editor__attachment-remove"
              onClick={() => onRemove(doc.id)}
              type="button"
            >
              <IconClose size={11} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
