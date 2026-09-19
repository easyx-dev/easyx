/**
 * 默认解析器工厂（`./parsers` 入口）
 *
 * 只在此处动态引入 mammoth / unpdf：宿主若不给 `tools.parseDocument`，或自建服务端
 * 解析，这两个重依赖完全不进宿主产物。
 */
import { UnsupportedDocumentError } from './errors';
import { parseDocx } from './parse-docx';
import { parsePdf } from './parse-pdf';
import { resolveDocumentKind } from './routing';
import type { AiRichDocumentParser } from './types';

/** 仅解析 .docx 的解析器 */
export function createDocxParser(): AiRichDocumentParser {
  return (file) => parseDocx(file);
}

/** 仅解析 .pdf 的解析器 */
export function createPdfParser(): AiRichDocumentParser {
  return (file) => parsePdf(file);
}

/** 按扩展名分派的默认解析器（.docx → HTML，.pdf → 文本） */
export function createDefaultDocumentParser(): AiRichDocumentParser {
  return (file) => {
    const kind = resolveDocumentKind(file.name);
    if (kind === 'docx') return parseDocx(file);
    if (kind === 'pdf') return parsePdf(file);
    return Promise.reject(new UnsupportedDocumentError(file.name));
  };
}
