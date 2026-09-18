/**
 * 对话输入区：附件条 + 自增高 textarea + 附件/发送按钮
 *
 * Enter 发送、Shift+Enter 换行；**输入法合成期间不发送** —— 中文候选词的上屏
 * 也会产生 Enter，若不做守卫会把半截拼音当成消息发出去。
 * 图片等文件可粘贴或拖入，由调用方决定上传时机（本包在点发送时统一上传）。
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
import type { AiRichMediaConfig } from '../media/types';
import type { AiRichErrorHandler } from '../types';
import { IconArrowUp, IconPaperclip, IconStop } from '../ui/icons';
import { Button } from '../ui/primitives/Button';
import { AttachmentBar } from './AttachmentBar';

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
  onCancel: () => void;
  placeholder?: string;
  /** 待发附件 */
  attachments?: readonly PendingAttachment[];
  /** 附件移除 */
  onRemoveAttachment?: (id: string) => void;
  /** 粘贴 / 拖入 / 选择文件 */
  onAddFiles?: (files: File[]) => void;
  /** 媒体入口的选择结果（上传 / 媒体库） */
  onPickMedia?: (pick: MediaPick) => void;
  /** 媒体能力 */
  media?: AiRichMediaConfig;
  /** 错误上报（入口不可用、上传失败等） */
  onError?: AiRichErrorHandler;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  loading,
  uploading,
  onCancel,
  placeholder,
  attachments = [],
  onRemoveAttachment,
  onAddFiles,
  onPickMedia,
  media,
  onError,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const busy = loading || Boolean(uploading);

  // 随内容自增高：先归零再按 scrollHeight 撑开，最后夹到上限
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const submit = () => {
    if (busy) return;
    if (!value.trim() && attachments.length === 0) return;
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
          ) : (
            <Button
              aria-label="发送"
              disabled={!value.trim() && attachments.length === 0}
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
