/**
 * PDF → 按页拼接的纯文本
 *
 * 用 unpdf 的 serverless 版 pdf.js：worker 内联、自带 polyfill，浏览器端无需配置
 * workerSrc，也不会把 Node 内建模块带进产物。仅做文本提取，不还原版面：表格/分栏会按
 * 文本流顺序展开，足以支撑「据文档生成内容」。
 *
 * 页数上限在**提取前**生效：先取 numPages，再逐页读取到上限为止。unpdf 的 extractText
 * 会一次性处理全部页（且跑在主线程），对超大文档会把界面拖死，故不用它、改为按需读页。
 */
import { DocumentParseError, UnsupportedDocumentError } from './errors';
import { resolveDocumentKind } from './routing';
import type { AiRichParsedDocument } from './types';

/** 单次解析的页数上限：避免超大文档把主线程与上下文一起拖垮 */
export const MAX_PDF_PAGES = 300;

/** 页起始标记：同时作为内容是否为空判定的依据 */
function pageLabel(page: number): string {
  return `（第 ${page} 页）`;
}

/** pdf.js 文本项中我们实际用到的字段 */
interface PdfTextItem {
  str?: string | null;
  hasEOL?: boolean;
}

interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  /** 释放 worker 与文档资源 */
  loadingTask: { destroy(): Promise<void> };
}

/** unpdf 中我们实际用到的部分 */
interface UnpdfModule {
  getDocumentProxy(data: Uint8Array): Promise<PdfDocument>;
}

/** 单页文本：与 unpdf 的 getPageText 同构（保留 hasEOL 换行） */
async function readPageText(
  pdf: PdfDocument,
  pageNumber: number,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items
    .filter((item) => item.str != null)
    .map((item) => `${item.str}${item.hasEOL ? '\n' : ''}`)
    .join('');
}

/** 解析 .pdf：返回按页拼接的文本 */
export async function parsePdf(file: File): Promise<AiRichParsedDocument> {
  if (resolveDocumentKind(file.name) !== 'pdf') {
    throw new UnsupportedDocumentError(file.name);
  }

  let unpdf: UnpdfModule;
  try {
    unpdf = (await import('unpdf')) as unknown as UnpdfModule;
  } catch (error) {
    throw new DocumentParseError(file.name, error);
  }

  let pdf: PdfDocument | undefined;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    pdf = await unpdf.getDocumentProxy(data);

    const totalPages = pdf.numPages;
    const limit = Math.min(totalPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    for (let page = 1; page <= limit; page++) {
      pages.push(await readPageText(pdf, page));
    }

    const warnings: string[] = [];
    if (totalPages > MAX_PDF_PAGES) {
      warnings.push(`文档共 ${totalPages} 页，仅解析前 ${MAX_PDF_PAGES} 页`);
    }
    // 全部页（含上限内）都没有文本 → 大概率是扫描件（没有文本层）
    if (!pages.some((page) => page.trim().length > 0)) {
      warnings.push('未提取到文本，可能是扫描件或纯图片 PDF');
    }

    return {
      name: file.name,
      kind: 'pdf',
      text: pages
        .map((page, index) => `${pageLabel(index + 1)}\n${page.trim()}`)
        .join('\n\n'),
      pageCount: totalPages,
      warnings,
    };
  } catch (error) {
    throw new DocumentParseError(file.name, error);
  } finally {
    await pdf?.loadingTask.destroy();
  }
}
