/**
 * `@easyx/ai-rich-editor/parsers` 独立入口
 *
 * 默认解析器只在此入口出现：mammoth / unpdf 经动态 import 按需加载，
 * 宿主不用该入口时它们完全不进产物。宿主也可只取其中一类，或用自定义实现替换。
 */
export { DocumentParseError, UnsupportedDocumentError } from './errors';
export {
  createDefaultDocumentParser,
  createDocxParser,
  createPdfParser,
} from './parse';
export {
  DEFAULT_DOCUMENT_EXTENSIONS,
  documentAccept,
  isDocumentFile,
  isLegacyDoc,
  resolveDocumentKind,
} from './routing';
export type {
  AiRichDocumentKind,
  AiRichDocumentParser,
  AiRichParsedDocument,
} from './types';
