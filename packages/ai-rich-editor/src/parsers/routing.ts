/**
 * 文档类型判定与文件选择框 accept
 *
 * 只按扩展名判定，不依赖 MIME —— 浏览器对 docx/pdf 的 MIME 上报并不稳定
 * （常见为空串或 application/octet-stream）。
 */
import type { AiRichDocumentKind } from './types';

/** 默认支持解析的扩展名 */
export const DEFAULT_DOCUMENT_EXTENSIONS: readonly string[] = ['.docx', '.pdf'];

/** 去掉查询串与锚点，转小写 */
function normalizeName(fileName: string): string {
  return fileName.split(/[?#]/)[0].toLowerCase();
}

/** 按扩展名判定可解析类型；不在支持范围内返回 undefined */
export function resolveDocumentKind(
  fileName: string,
): AiRichDocumentKind | undefined {
  const name = normalizeName(fileName);
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.pdf')) return 'pdf';
  return undefined;
}

/** 是否为旧版 .doc 二进制格式（mammoth 不支持，需给出明确提示） */
export function isLegacyDoc(fileName: string): boolean {
  return normalizeName(fileName).endsWith('.doc');
}

/** 文件是否命中文档扩展名（粘贴/拖入分流用） */
export function isDocumentFile(
  fileName: string,
  extensions: readonly string[] = DEFAULT_DOCUMENT_EXTENSIONS,
): boolean {
  const name = normalizeName(fileName);
  return extensions.some((ext) => name.endsWith(ext.toLowerCase()));
}

/** 文件选择框 accept：默认 `.docx,.pdf` */
export function documentAccept(
  extensions: readonly string[] = DEFAULT_DOCUMENT_EXTENSIONS,
): string {
  return extensions.join(',');
}
