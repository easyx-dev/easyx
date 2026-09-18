/**
 * 媒体能力的开放类型
 *
 * 字段与 @easyx/editor 的媒体配置对齐（同一套宿主接入习惯），但两包各自持有类型，
 * 不引入跨包依赖。类型名统一 AiRich 前缀，避免宿主同时引入两包时命名冲突。
 */

/** 媒体条目（上传结果与媒体库列表项共用） */
export interface AiRichMediaItem {
  id: string;
  url: string;
  name: string;
  size?: number;
  thumbnailUrl?: string;
  fileType?: string;
}

/** 媒体库分页参数 */
export interface AiRichMediaListParams {
  page: number;
  pageSize: number;
  keyword?: string;
}

/** 媒体库分页结果 */
export interface AiRichMediaListResult {
  items: AiRichMediaItem[];
  total: number;
}

/** 上传进度回调（0~1） */
export type AiRichMediaUploadProgress = (progress: number) => void;

/** 单一媒体类型的上传 + 媒体库配置 */
export interface AiRichMediaUploadConfig {
  upload: (
    file: File,
    onProgress?: AiRichMediaUploadProgress,
  ) => Promise<AiRichMediaItem>;
  getList?: (params: AiRichMediaListParams) => Promise<AiRichMediaListResult>;
}

/** 媒体类型：图片 / 视频 / 音频 / 其它附件 */
export type AiRichMediaKind = 'image' | 'video' | 'audio' | 'attachment';

/** 组件级媒体配置：按类型给出上传与媒体库能力，未配置的类型即不可用 */
export type AiRichMediaConfig = Partial<
  Record<AiRichMediaKind, AiRichMediaUploadConfig>
>;

/** 已上传附件（随用户消息发给模型的清单项） */
export interface SentAttachment {
  kind: AiRichMediaKind;
  name: string;
  url: string;
  size?: number;
}
