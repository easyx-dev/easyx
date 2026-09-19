/**
 * 媒体上传调用
 *
 * 上传接口由宿主以函数形式注入（见 MediaConfig），包内只负责：按类型取接口、
 * 未配置时抛出可识别的错误、失败时原样抛出由宿主接管。
 * 上传时机由调用方决定（代码面板为「选中即上传」，对话附件为「点发送才上传」）。
 */
import { MediaNotConfiguredError } from './errors';
import { MEDIA_KINDS } from './routing';
import type {
  MediaConfig,
  MediaItem,
  MediaKind,
  MediaUploadConfig,
  MediaUploadProgress,
} from './types';

/** 该类型是否具备上传能力 */
export function canUpload(
  media: MediaConfig | undefined,
  kind: MediaKind,
): boolean {
  return Boolean(media?.[kind]?.upload);
}

/** 是否配置了任意媒体库 */
export function hasMediaLibrary(media?: MediaConfig): boolean {
  if (!media) return false;
  return MEDIA_KINDS.some((kind) => Boolean(media[kind]?.getList));
}

/**
 * 媒体库列表源：取第一个配置了 getList 的类型
 *
 * 媒体库在宿主侧通常是一份共享资源，包内不做「按类型分库」的假设；
 * 条目类型另由 resolveItemKind 逐个推断。
 */
export function resolveLibrarySource(
  media?: MediaConfig,
): MediaUploadConfig | undefined {
  if (!media) return undefined;
  for (const kind of MEDIA_KINDS) {
    const config = media[kind];
    if (config?.getList) return config;
  }
  return undefined;
}

/** 上传单个文件；未配置对应类型时抛 MediaNotConfiguredError */
export function uploadMediaFile(
  media: MediaConfig | undefined,
  kind: MediaKind,
  file: File,
  onProgress?: MediaUploadProgress,
): Promise<MediaItem> {
  const upload = media?.[kind]?.upload;
  if (!upload) return Promise.reject(new MediaNotConfiguredError(kind));
  return upload(file, onProgress);
}
