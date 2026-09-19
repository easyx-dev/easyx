export type EditorContentType = string;

export type EditorTheme = 'light' | 'dark';

/** 图片配置：在通用媒体配置基础上增加图片专属选项 */
export type EditorImageConfig = MediaUploadConfig & {
  /** 是否开启图片拖拽缩放，默认 true */
  resizable?: boolean;
};

/** 编辑器初始化配置 */
export interface EditorOptions {
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  defaultContent?: EditorContentType;
  defaultTheme?: EditorTheme;
  image?: EditorImageConfig;
  video?: MediaUploadConfig;
  audio?: MediaUploadConfig;
  attachment?: MediaUploadConfig;
  /** 编辑器最小高度，number 视为 px，或任意 CSS 长度 */
  minHeight?: number | string;
  /** 编辑器高度：'auto'/缺省表示随内容伸缩；给定值时固定高度并内部滚动 */
  height?: number | 'auto' | string;
  /** 编辑器最大高度，内容撑到上限后内部滚动 */
  maxHeight?: number | string;
  /** 是否启用右下角拖拽手柄调节高度，受 minHeight / maxHeight 约束 */
  resizable?: boolean;
  onChange?: (content: EditorContentType) => void;
  onReady?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onDestroy?: () => void;
}

/** 媒体列表项 */
export interface MediaItem {
  id: string;
  url: string;
  name: string;
  size?: number;
  thumbnailUrl?: string;
  duration?: number;
  fileType?: string;
}

/** 媒体列表分页参数 */
export interface MediaListParams {
  page: number;
  pageSize: number;
  keyword?: string;
}

/** 媒体列表分页结果 */
export interface MediaListResult {
  items: MediaItem[];
  total: number;
}

/** 上传进度回调 */
export type MediaUploadProgress = (progress: number) => void;

/** 单个媒体类型的上传 + 列表配置 */
export interface MediaUploadConfig {
  upload: (file: File, onProgress?: MediaUploadProgress) => Promise<MediaItem>;
  getList?: (params: MediaListParams) => Promise<MediaListResult>;
}
