/**
 * AI Rich Editor 独立包统一出口
 * UI 层与协议类型一并导出，宿主按需引用
 */
import './styles/index.scss';

export { AiRichEditor } from './AiRichEditor';
export {
  type AiRichPreviewDevice,
  DEFAULT_CONFIG,
  DEFAULT_HTML,
  DEFAULT_SYSTEM_PROMPT_TEMPLATE,
  PRESET_PROMPTS,
  PREVIEW_DEVICES,
} from './constants';
export { InvalidMediaUrlError, MediaNotConfiguredError } from './media/errors';
export { mediaKindLabel, resolveMediaKind } from './media/routing';
export { buildMediaSnippet } from './media/snippet';
export type {
  MediaConfig,
  MediaItem,
  MediaKind,
  MediaListParams,
  MediaListResult,
  MediaUploadConfig,
  MediaUploadProgress,
} from './media/types';
export type {
  AiRichDocumentKind,
  AiRichDocumentParser,
  AiRichParsedDocument,
} from './parsers/types';
export { buildDefaultSystemPrompt } from './prompts';
export type {
  AiRichEditorConfig,
  AiRichEditorProps,
  AiRichEditorTools,
  AiRichErrorHandler,
  AiRichNotifyHandler,
  AiRichRequestHeaders,
} from './types';
export { buildPreviewDocument, extractHtmlFragments } from './utils/extract';
export { listAllowedSchemes, sanitizeUrl } from './utils/url';
