/**
 * 对话输入区：附件条 + 自增高 textarea + 附件/文档/发送按钮
 *
 * Enter 发送、Shift+Enter 换行；**输入法合成期间不发送** —— 中文候选词的上屏
 * 也会产生 Enter，若不做守卫会把半截拼音当成消息发出去。
 * 图片等文件可粘贴或拖入，由调用方决定上传时机（本包在点发送时统一上传）；
 * Word/PDF 文档经独立的文档入口添加，由调用方在添加时解析。
 */
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
} from 'react';
import type { MediaPick } from '../components/MediaPicker';
import { MediaPicker } from '../components/MediaPicker';
import type { PendingAttachment } from '../media/attachment';
import type { MediaConfig } from '../media/types';
import type { PendingDocument } from '../parsers/document-state';
import type { AiRichErrorHandler } from '../types';
import { IconArrowUp, IconFile, IconPaperclip, IconStop } from '../ui/icons';
import { Button } from '../ui/primitives/Button';
import { AttachmentBar } from './AttachmentBar';
import { DocumentBar } from './DocumentBar';

/** textarea 自增高上限（px），超出后内部滚动 */
const MAX_HEIGHT = 160;

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** 生成中：展示停止按钮并屏蔽发送 */
  loading: boolean;
  /** 上传中：屏蔽发送与附件改动 */
  uploading?: boolean;
  /** 文档解析中：屏蔽发送与文档改动 */
  parsing?: boolean;
  onCancel: () => void;
  placeholder?: string;
  /** 待发附件 */
  attachments?: readonly PendingAttachment[];
  /** 附件移除 */
  onRemoveAttachment?: (id: string) => void;
  /** 待解析/已解析文档（Word / PDF） */
  documents?: readonly PendingDocument[];
  /** 文档移除 */
  onRemoveDocument?: (id: string) => void;
  /** 解析失败后重试 */
  onRetryDocument?: (id: string) => void;
  /** 文档选择结果（由独立入口触发；粘贴/拖入经 onAddFiles 分流） */
  onAddDocuments?: (files: File[]) => void;
  /** 文档入口的文件选择框 accept；缺省表示未启用文档能力，入口不出现 */
  documentAccept?: string;
  /** 粘贴 / 拖入 / 选择文件 */
  onAddFiles?: (files: File[]) => void;
  /** 媒体入口的选择结果（上传 / 媒体库） */
  onPickMedia?: (pick: MediaPick) => void;
  /** 媒体能力 */
  media?: MediaConfig;
  /** 错误上报（入口不可用、上传失败等） */
  onError?: AiRichErrorHandler;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  loading,
  uploading,
  parsing,
  onCancel,
  placeholder,
  attachments = [],
  onRemoveAttachment,
  documents = [],
  onRemoveDocument,
  onRetryDocument,
  onAddDocuments,
  documentAccept,
  onAddFiles,
  onPickMedia,
  media,
  onError,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const busy = loading || Boolean(uploading) || Boolean(parsing);

  // 随内容自增高：先归零再按 scrollHeight 撑开，最后夹到上限
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const hasSendableDocument = documents.some((doc) => doc.status === 'ready');
  const canSubmit =
    Boolean(value.trim()) || attachments.length > 0 || hasSendableDocument;

  const submit = () => {
    if (busy || !canSubmit) return;
    onSubmit(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    // 输入法合成中（含中文候选上屏）不触发发送
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  /** 取剪贴板/拖拽里的文件；有文件时不把二进制内容误当文本插入 */
  const collectFiles = (list: FileList | null | undefined): File[] =>
    list ? Array.from(list) : [];

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = collectFiles(event.clipboardData?.files);
    if (files.length === 0) return;
    event.preventDefault();
    onAddFiles?.(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const files = collectFiles(event.dataTransfer?.files);
    if (files.length === 0) return;
    event.preventDefault();
    onAddFiles?.(files);
  };

  return (
    <div
      className="easyx-ai-rich-editor__composer"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
      }}
      onDrop={handleDrop}
    >
      <AttachmentBar
        attachments={attachments}
        disabled={busy}
        onRemove={(id) => onRemoveAttachment?.(id)}
      />
      <DocumentBar
        disabled={busy}
        documents={documents}
        onRemove={(id) => onRemoveDocument?.(id)}
        onRetry={(id) => onRetryDocument?.(id)}
      />

      <div className="easyx-ai-rich-editor__composer-row">
        <textarea
          aria-label="对话输入"
          className="easyx-ai-rich-editor__composer-input"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          ref={ref}
          rows={2}
          value={value}
        />
        <div className="easyx-ai-rich-editor__composer-actions">
          <MediaPicker
            allowUrl={false}
            deferUpload
            media={media}
            onError={(error) => onError?.(error)}
            onPick={(pick) => onPickMedia?.(pick)}
            trigger={
              <Button
                aria-label="添加附件"
                disabled={busy}
                icon={<IconPaperclip size={15} />}
                iconOnly
                variant="text"
              />
            }
          />
          {documentAccept && (
            <>
              <Button
                aria-label="添加文档"
                disabled={busy}
                icon={<IconFile size={15} />}
                iconOnly
                onClick={() => documentInputRef.current?.click()}
                variant="text"
              />
              <input
                accept={documentAccept}
                className="easyx-ai-rich-editor__media-file"
                multiple
                onChange={(event) => {
                  const files = collectFiles(event.target.files);
                  if (files.length > 0) onAddDocuments?.(files);
                  event.target.value = '';
                }}
                ref={documentInputRef}
                type="file"
              />
            </>
          )}
          {loading ? (
            <Button
              aria-label="停止生成"
              icon={<IconStop size={14} />}
              iconOnly
              onClick={onCancel}
              variant="primary"
            />
          ) : uploading ? (
            <Button aria-label="上传中" iconOnly loading variant="primary" />
          ) : parsing ? (
            <Button aria-label="解析中" iconOnly loading variant="primary" />
          ) : (
            <Button
              aria-label="发送"
              disabled={!canSubmit}
              icon={<IconArrowUp size={15} />}
              iconOnly
              onClick={submit}
              variant="primary"
            />
          )}
        </div>
      </div>
    </div>
  );
}
