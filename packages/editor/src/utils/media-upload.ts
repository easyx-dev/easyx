import type { Editor } from '@tiptap/core';
import type { EditorOptions, MediaItem, MediaUploadConfig } from '../types';

type MediaNodeType =
  | 'imageUpload'
  | 'videoNode'
  | 'audioNode'
  | 'attachmentNode';

interface MediaEntry {
  nodeType: MediaNodeType;
  match: (fileType: string) => boolean;
  upload?: MediaUploadConfig['upload'];
}

/** 媒体类型 → 节点类型与文件匹配规则（按优先级：图片/视频/音频/附件兜底） */
function buildEntries(options: EditorOptions): MediaEntry[] {
  return [
    {
      nodeType: 'imageUpload',
      match: (t) => t.startsWith('image/'),
      upload: options.image?.upload,
    },
    {
      nodeType: 'videoNode',
      match: (t) => t.startsWith('video/'),
      upload: options.video?.upload,
    },
    {
      nodeType: 'audioNode',
      match: (t) => t.startsWith('audio/'),
      upload: options.audio?.upload,
    },
    {
      nodeType: 'attachmentNode',
      match: () => true,
      upload: options.attachment?.upload,
    },
  ];
}

/** 插入上传结果到编辑器 */
function insertMedia(
  editor: Editor,
  nodeType: MediaNodeType,
  result: MediaItem,
  file: File,
): void {
  const chain = editor.chain();
  switch (nodeType) {
    case 'imageUpload':
      chain.setImage({ src: result.url });
      break;
    case 'videoNode':
      chain.setVideo({ src: result.url });
      break;
    case 'audioNode':
      chain.setAudio({ src: result.url });
      break;
    case 'attachmentNode':
      chain.setAttachment({
        src: result.url,
        name: result.name ?? file.name,
        size: result.size,
      });
      break;
  }
  chain.run();
}

/**
 * 按文件类型路由到对应媒体的 upload 并插入。
 * 用于编辑器内容区粘贴 / 拖入上传；返回 true 表示已接管该文件。
 * @param pos 插入位置，缺省使用当前选区
 * @param onError 上传失败回调（默认静默）
 */
export function routeMediaUpload(
  file: File,
  editor: Editor,
  options: EditorOptions,
  pos?: number,
  onError?: (file: File, error: unknown) => void,
): boolean {
  const entry = buildEntries(options).find(
    (e) => e.upload && e.match(file.type),
  );
  if (!entry) return false;

  if (pos != null) {
    editor.chain().focus().setTextSelection(pos).run();
  } else {
    editor.commands.focus();
  }

  entry.upload!(file)
    .then((result) => insertMedia(editor, entry.nodeType, result, file))
    .catch((error: unknown) => onError?.(file, error));
  return true;
}
