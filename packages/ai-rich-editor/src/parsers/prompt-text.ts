/**
 * 文档上下文块拼装
 *
 * 解析结果以固定的 `[文档内容]` 块随用户消息发给模型，块内先给来源与解析提示，
 * 再用围栏包裹正文（docx 为 html、pdf 为 text）。超长按字符预算截断并在块内标注。
 *
 * 该块是持久源材料：`chat/prompt-blocks` 不会像「当前片段」那样在历史轮次剥离它，
 * 体积上限由这里的字符预算控制。
 */
import type { AiRichParsedDocument } from './types';

/** 文档内容块起始标记；同时用于分段解析，改动需同步测试 */
export const DOCUMENT_BLOCK_TITLE = '[文档内容]';

/** 单文档注入模型的默认字符预算 */
export const DOCUMENT_MAX_CHARS = 30000;

export interface BuildDocumentBlockOptions {
  /** 字符预算，超出截断 */
  maxChars?: number;
}

/** 来源描述：类型与页数 */
function sourceLabel(doc: AiRichParsedDocument): string {
  if (doc.kind === 'pdf') {
    return doc.pageCount ? `PDF，共 ${doc.pageCount} 页` : 'PDF';
  }
  if (doc.kind === 'docx') return 'Word 文档';
  return '文档';
}

/** 按字符预算截断；避免把一对代理字符（emoji 等）从中间劈开 */
function truncateByBudget(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  let end = maxChars;
  const code = content.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1; // 高代理项被截断，回退一位
  return content.slice(0, end);
}

/**
 * 拼装单个 `[文档内容]` 块；正文与提示皆为空时返回空串（调用方过滤）
 */
export function buildDocumentBlock(
  doc: AiRichParsedDocument,
  options: BuildDocumentBlockOptions = {},
): string {
  const maxChars = options.maxChars ?? DOCUMENT_MAX_CHARS;
  const fence = doc.kind === 'docx' ? 'html' : 'text';
  const content = (doc.html ?? doc.text ?? '').trim();
  const truncated = content.length > maxChars;
  const body = truncateByBudget(content, maxChars);

  const lines = [
    DOCUMENT_BLOCK_TITLE,
    `来源：${doc.name ?? '未命名文档'}（${sourceLabel(doc)}）`,
  ];
  for (const warning of doc.warnings ?? []) {
    lines.push(`提示：${warning}`);
  }
  if (truncated) {
    lines.push(
      `（内容超过 ${maxChars} 字符，已截断，仅保留前 ${maxChars} 字符）`,
    );
  }
  lines.push(`\`\`\`${fence}`, body || '（未能提取到可用文本）', '```');
  return lines.join('\n');
}
