/**
 * 媒体能力的开放类型
 *
 * 与 @easyx/editor 共用同一套媒体契约：类型名与字段形状完全一致
 * （MediaItem / MediaListParams / MediaListResult / MediaUploadConfig /
 * MediaKind / MediaUploadProgress），宿主接入习惯统一，两包间可直接互赋。
 * 两包各自持有声明、不引入跨包依赖。
 */

/** 媒体条目（上传结果与媒体库列表项共用） */
export interface MediaItem {
  id: string;
  url: string;
  name: string;
  size?: number;
  thumbnailUrl?: string;
  fileType?: string;
}

/** 媒体库分页参数 */
export interface MediaListParams {
  page: number;
  pageSize: number;
  keyword?: string;
}

/** 媒体库分页结果 */
export interface MediaListResult {
  items: MediaItem[];
  total: number;
}

/** 上传进度回调（0~1） */
export type MediaUploadProgress = (progress: number) => void;

/** 单一媒体类型的上传 + 媒体库配置 */
export interface MediaUploadConfig {
  upload: (file: File, onProgress?: MediaUploadProgress) => Promise<MediaItem>;
  getList?: (params: MediaListParams) => Promise<MediaListResult>;
}

/** 媒体类型：图片 / 视频 / 音频 / 其它附件 */
export type MediaKind = 'image' | 'video' | 'audio' | 'attachment';

/** 组件级媒体配置：按类型给出上传与媒体库能力，未配置的类型即不可用 */
export type MediaConfig = Partial<Record<MediaKind, MediaUploadConfig>>;

/** 已上传附件（随用户消息发给模型的清单项） */
export interface SentAttachment {
  kind: MediaKind;
  name: string;
  url: string;
  size?: number;
}
