/**
 * 媒体选择浮层：上传 / 网络地址 / 媒体库 三个入口
 *
 * 拆成两层：
 * - `MediaPickerPanel`：受控面板，锚点由调用方给（代码面板用行号槽里的入口按钮）；
 * - `MediaPicker`：自带触发元素与开关状态（对话输入框的回形针用它）。
 *
 * 上传时机由调用方决定：
 * - 缺省（代码面板）：选中即上传，回调带回 item，便于立刻拼出 HTML 片段
 * - deferUpload（对话附件）：只回调 File，由调用方在「点发送」时统一上传
 *
 * 未配置能力的入口直接不出现；一个入口都没有时点击触发元素报错给调用方。
 */
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom';
import {
  cloneElement,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { MEDIA_PICKER_EMPTY_HINT } from '../constants';
import { InvalidMediaUrlError, toError } from '../media/errors';
import {
  MEDIA_KINDS,
  mediaAccept,
  mediaKindLabel,
  resolveItemKind,
  resolveMediaKind,
} from '../media/routing';
import type { MediaConfig, MediaItem, MediaKind } from '../media/types';
import {
  hasMediaLibrary,
  resolveLibrarySource,
  uploadMediaFile,
} from '../media/upload';
import { cx, isScopeDark, scopeClass } from '../ui/cx';
import { useDismissableLayer } from '../ui/hooks/overlay';
import { IconGallery, IconLink, IconUpload } from '../ui/icons';
import { listAllowedSchemes, sanitizeUrl } from '../utils/url';
import { MediaLibraryPanel } from './MediaLibraryPanel';

/** 选择结果：三种入口共用一次回调 */
export type MediaPick =
  | {
      type: 'upload';
      file: File;
      kind: MediaKind;
      /** 立即上传模式下带回的上传结果 */
      item?: MediaItem;
    }
  | { type: 'url'; url: string }
  | { type: 'library'; kind: MediaKind; item: MediaItem };

type TabKey = 'upload' | 'url' | 'library';

/** 可用入口：按「上传 / 网络地址 / 媒体库」顺序给出，未配置能力的入口不出现 */
function availableTabs(
  media: MediaConfig | undefined,
  allowUrl: boolean | undefined,
): TabKey[] {
  const keys: TabKey[] = [];
  if (MEDIA_KINDS.some((kind) => media?.[kind]?.upload)) keys.push('upload');
  if (allowUrl) keys.push('url');
  if (hasMediaLibrary(media)) keys.push('library');
  return keys;
}

export interface MediaPickerPanelProps {
  /** 定位锚点；为 null 时不渲染 */
  anchor: HTMLElement | null;
  open: boolean;
  media?: MediaConfig;
  /** 允许手工填写网络地址（对话附件不需要） */
  allowUrl?: boolean;
  /** 上传延迟到调用方（对话附件在发送时才上传） */
  deferUpload?: boolean;
  /** 宿主追加允许的协议（用于「网络地址」页签校验） */
  allowedUrlSchemes?: readonly string[];
  onPick: (pick: MediaPick) => void;
  onError?: (error: Error) => void;
  onClose: () => void;
  placement?: 'bottom-start' | 'top-start';
}

export function MediaPickerPanel({
  anchor,
  open,
  media,
  allowUrl,
  deferUpload,
  allowedUrlSchemes,
  onPick,
  onError,
  onClose,
  placement = 'bottom-start',
}: MediaPickerPanelProps) {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<TabKey>('upload');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasUpload = MEDIA_KINDS.some((kind) => media?.[kind]?.upload);
  const librarySource = resolveLibrarySource(media);
  const accept = mediaAccept(media);
  const tabs = availableTabs(media, allowUrl);

  useDismissableLayer(panelRef, open, onClose, anchor);

  // 打开时定位并落到首个可用入口
  useEffect(() => {
    if (!open || !anchor) return;
    const panel = panelRef.current;
    if (!panel) return;
    const keys = availableTabs(media, allowUrl);
    setTab((prev) => (keys.includes(prev) ? prev : (keys[0] ?? 'upload')));
    setDark(isScopeDark(anchor));
    return autoUpdate(anchor, panel, () => {
      void computePosition(anchor, panel, {
        placement,
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
      });
    });
  }, [open, anchor, placement, media, allowUrl]);

  const pickLibraryItem = (item: MediaItem) => {
    onPick({ type: 'library', kind: resolveItemKind(item), item });
    onClose();
  };

  const submitUrl = () => {
    const value = url.trim();
    const safe = sanitizeUrl(value, { extraSchemes: allowedUrlSchemes });
    if (!safe) {
      onError?.(
        new InvalidMediaUrlError(
          value,
          listAllowedSchemes({ extraSchemes: allowedUrlSchemes }),
        ),
      );
      return;
    }
    onPick({ type: 'url', url: safe });
    setUrl('');
    onClose();
  };

  /** 立即上传模式下的串行上传：多文件按选择顺序插入，避免并发导致顺序错乱 */
  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (deferUpload) {
      for (const file of files) {
        onPick({ type: 'upload', file, kind: resolveMediaKind(file.type) });
      }
      onClose();
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const kind = resolveMediaKind(file.type);
        setProgress(0);
        const item = await uploadMediaFile(media, kind, file, setProgress);
        onPick({ type: 'upload', file, kind, item });
      }
      onClose();
    } catch (error) {
      onError?.(toError(error));
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (!open || !anchor) return null;

  return createPortal(
    <div
      aria-label="选择媒体"
      className={cx(scopeClass(dark), 'easyx-ai-rich-editor__media-picker')}
      ref={panelRef}
      role="dialog"
    >
      {tabs.length > 1 && (
        <div className="easyx-ai-rich-editor__media-tabs" role="tablist">
          {tabs.map((key) => (
            <button
              aria-selected={tab === key}
              className={cx(
                'easyx-ai-rich-editor__media-tab',
                tab === key && 'is-active',
              )}
              key={key}
              onClick={() => setTab(key)}
              role="tab"
              type="button"
            >
              {key === 'upload' && <IconUpload size={13} />}
              {key === 'url' && <IconLink size={13} />}
              {key === 'library' && <IconGallery size={13} />}
              <span>
                {key === 'upload'
                  ? '上传'
                  : key === 'url'
                    ? '网络地址'
                    : '媒体库'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="easyx-ai-rich-editor__media-body">
        {tab === 'upload' && hasUpload && (
          <div
            className="easyx-ai-rich-editor__media-upload"
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              const files = Array.from(event.dataTransfer.files ?? []);
              if (files.length === 0) return;
              event.preventDefault();
              void handleFiles(files);
            }}
          >
            <button
              className="easyx-ai-rich-editor__media-upload-btn"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              <IconUpload size={14} />
              <span>{uploading ? '上传中…' : '选择文件'}</span>
            </button>
            <p className="easyx-ai-rich-editor__media-upload-hint">
              {deferUpload
                ? '也可以直接粘贴到输入框，发送时统一上传'
                : '支持拖拽文件到此处'}
            </p>
            {uploading && (
              <div className="easyx-ai-rich-editor__media-progress">
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
            <input
              accept={accept}
              className="easyx-ai-rich-editor__media-file"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) void handleFiles(files);
              }}
              ref={inputRef}
              type="file"
            />
          </div>
        )}

        {tab === 'url' && allowUrl && (
          <div className="easyx-ai-rich-editor__media-url">
            <input
              className="easyx-ai-rich-editor__media-url-input"
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                submitUrl();
              }}
              placeholder="粘贴图片/文件链接…"
              type="url"
              value={url}
            />
            <button
              className="easyx-ai-rich-editor__media-url-btn"
              onClick={submitUrl}
              type="button"
            >
              插入
            </button>
          </div>
        )}

        {tab === 'library' && librarySource?.getList && (
          <MediaLibraryPanel
            getList={librarySource.getList}
            onError={(error) => onError?.(error)}
            onPick={pickLibraryItem}
          />
        )}
      </div>

      {tab === 'upload' && hasUpload && (
        <p className="easyx-ai-rich-editor__media-footnote">
          可用类型：
          {MEDIA_KINDS.filter((kind) => media?.[kind]?.upload)
            .map((kind) => mediaKindLabel(kind))
            .join('、')}
        </p>
      )}
    </div>,
    document.body,
  );
}

export interface MediaPickerProps {
  /** 触发元素（注入点击与展开态） */
  trigger: ReactElement<Record<string, unknown>>;
  media?: MediaConfig;
  /** 允许手工填写网络地址（对话附件不需要） */
  allowUrl?: boolean;
  /** 上传延迟到调用方（对话附件在发送时才上传） */
  deferUpload?: boolean;
  /** 宿主追加允许的协议 */
  allowedUrlSchemes?: readonly string[];
  onPick: (pick: MediaPick) => void;
  onError?: (error: Error) => void;
  placement?: 'bottom-start' | 'top-start';
}

/** 触发元素 + 内部开关状态的媒体选择浮层 */
export function MediaPicker({
  trigger,
  media,
  allowUrl,
  deferUpload,
  allowedUrlSchemes,
  onPick,
  onError,
  placement,
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const close = useCallback(() => setOpen(false), []);

  /** 点击触发元素：无任何可用入口时只报错，不打开空面板 */
  const handleTriggerClick = () => {
    if (availableTabs(media, allowUrl).length === 0) {
      onError?.(new Error(MEDIA_PICKER_EMPTY_HINT));
      return;
    }
    if (open) {
      close();
      return;
    }
    setAnchor(anchorRef.current);
    setOpen(true);
  };

  return (
    <>
      <span className="easyx-ai-rich-editor__media-anchor" ref={anchorRef}>
        {cloneElement(trigger, {
          'aria-expanded': open,
          'aria-haspopup': 'dialog',
          onClick: handleTriggerClick,
        })}
      </span>
      <MediaPickerPanel
        allowUrl={allowUrl}
        allowedUrlSchemes={allowedUrlSchemes}
        anchor={anchor}
        deferUpload={deferUpload}
        media={media}
        onClose={close}
        onError={onError}
        onPick={onPick}
        open={open}
        placement={placement}
      />
    </>
  );
}
