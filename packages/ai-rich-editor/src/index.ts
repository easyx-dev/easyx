/**
 * AI Rich Editor 独立包统一出口
 * UI 层与协议类型一并导出，宿主按需引用
 */
import './styles/index.scss';

export { AiRichEditor } from './AiRichEditor';
export {
  DEFAULT_CONFIG,
  DEFAULT_HTML,
  DEFAULT_SYSTEM_PROMPT_TEMPLATE,
  PRESET_PROMPTS,
  PREVIEW_DEVICES,
  type PreviewDevice,
} from './constants';
export { InvalidMediaUrlError, MediaNotConfiguredError } from './media/errors';
export { mediaKindLabel, resolveMediaKind } from './media/routing';
export { buildMediaSnippet } from './media/snippet';
export type {
  AiRichMediaConfig,
  AiRichMediaItem,
  AiRichMediaKind,
  AiRichMediaListParams,
  AiRichMediaListResult,
  AiRichMediaUploadConfig,
  AiRichMediaUploadProgress,
} from './media/types';
export { buildDefaultSystemPrompt } from './prompts';
export type {
  AiRichEditorConfig,
  AiRichEditorProps,
  AiRichErrorHandler,
  AiRichNotify,
} from './types';
export { buildPreviewDocument, extractHtmlFragments } from './utils/extract';
export { listAllowedSchemes, sanitizeUrl } from './utils/url';
