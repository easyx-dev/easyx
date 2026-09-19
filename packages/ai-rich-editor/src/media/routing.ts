/**
 * 媒体基础工具：类型路由、文案与文件尺寸格式化
 *
 * 路由规则与 @easyx/editor 的粘贴/拖入分流保持一致：图片/视频/音频按 MIME 前缀，
 * 其余一律兜底为附件。
 */
import type { MediaConfig, MediaItem, MediaKind } from './types';

/** 媒体类型固定顺序（界面展示与上传路由共用） */
export const MEDIA_KINDS: readonly MediaKind[] = [
  'image',
  'video',
  'audio',
  'attachment',
];

const KIND_LABELS: Record<MediaKind, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  attachment: '附件',
};

const KIND_ACCEPT: Record<MediaKind, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  attachment: '',
};

/** 媒体类型的中文名 */
export function mediaKindLabel(kind: MediaKind): string {
  return KIND_LABELS[kind];
}

/** 文件 MIME → 媒体类型 */
export function resolveMediaKind(fileType: string): MediaKind {
  const type = fileType.toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'attachment';
}

/** 文件选择框的 accept：只列出宿主编排了上传接口的类型 */
export function mediaAccept(media?: MediaConfig): string {
  return MEDIA_KINDS.filter((kind) => media?.[kind]?.upload)
    .map((kind) => KIND_ACCEPT[kind])
    .filter(Boolean)
    .join(',');
}

/** 扩展名 → 媒体类型：媒体库条目不携带 MIME 时兜底（允许尾部查询串与锚点） */
const EXTENSION_KINDS: ReadonlyArray<[RegExp, MediaKind]> = [
  [/\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(?:[?#].*)?$/i, 'image'],
  [/\.(mp4|webm|mov|m4v|ogv|mkv)(?:[?#].*)?$/i, 'video'],
  [/\.(mp3|wav|ogg|m4a|aac|flac|opus)(?:[?#].*)?$/i, 'audio'],
];

/** 媒体库条目的类型推断：优先 fileType，其次按文件名与地址的扩展名 */
export function resolveItemKind(item: MediaItem): MediaKind {
  const fileType = item.fileType ?? '';
  if (fileType.includes('/')) return resolveMediaKind(fileType);
  // 名称优先于地址：名称无扩展名时再退回地址
  for (const probe of [item.name, item.url]) {
    if (!probe) continue;
    for (const [pattern, kind] of EXTENSION_KINDS) {
      if (pattern.test(probe)) return kind;
    }
  }
  return 'attachment';
}

/** 文件尺寸格式化 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
