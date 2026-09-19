/**
 * pdf 解析测试：按页读取与上限约束、扫描件判定、资源释放与错误归一
 *
 * unpdf 的真实提取由浏览器运行时保证，这里 mock 掉它，只验证包内的编排逻辑。
 * 重点覆盖「页数上限在提取前生效」——超出上限的页不应被读取。
 */
import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  getDocumentProxy: rs.fn(),
}));

rs.mock('unpdf', () => ({ getDocumentProxy: mocks.getDocumentProxy }));

import {
  DocumentParseError,
  UnsupportedDocumentError,
} from '../src/parsers/errors';
import { MAX_PDF_PAGES, parsePdf } from '../src/parsers/parse-pdf';

/** 造一个最小的 PDFDocumentProxy 替身：按页返回给定文本行 */
function makeFakePdf(pages: string[]) {
  const getPage = rs.fn(async (pageNumber: number) => ({
    getTextContent: async () => ({
      items: pages[pageNumber - 1].split('\n').map((line, index, all) => ({
        hasEOL: index < all.length - 1,
        str: line,
      })),
    }),
  }));
  const destroy = rs.fn(async () => {});
  return { destroy, getPage, numPages: pages.length, loadingTask: { destroy } };
}

beforeEach(() => {
  mocks.getDocumentProxy.mockReset();
});

describe('parsePdf', () => {
  it('非 pdf 直接抛出 UnsupportedDocumentError', async () => {
    await expect(parsePdf(new File(['x'], 'a.docx'))).rejects.toBeInstanceOf(
      UnsupportedDocumentError,
    );
  });

  it('按页拼接并带上页数，且释放文档资源', async () => {
    const pdf = makeFakePdf(['第一页', '第二页']);
    mocks.getDocumentProxy.mockResolvedValue(pdf);

    const result = await parsePdf(new File(['x'], '报告.pdf'));
    expect(result.kind).toBe('pdf');
    expect(result.pageCount).toBe(2);
    expect(result.text).toContain('（第 1 页）\n第一页');
    expect(result.text).toContain('（第 2 页）\n第二页');
    expect(result.warnings).toEqual([]);
    expect(pdf.destroy).toHaveBeenCalledTimes(1);
  });

  it('无文本层时判定为扫描件并提示', async () => {
    mocks.getDocumentProxy.mockResolvedValue(makeFakePdf(['', '   ']));
    const result = await parsePdf(new File(['x'], '扫描件.pdf'));
    expect(result.warnings).toContain('未提取到文本，可能是扫描件或纯图片 PDF');
  });

  it('超出页数上限时只读取前若干页并提示', async () => {
    const total = MAX_PDF_PAGES + 10;
    const pdf = makeFakePdf(
      Array.from({ length: total }, (_, i) => `第${i + 1}页`),
    );
    mocks.getDocumentProxy.mockResolvedValue(pdf);

    const result = await parsePdf(new File(['x'], '长文档.pdf'));
    expect(result.warnings).toContain(
      `文档共 ${total} 页，仅解析前 ${MAX_PDF_PAGES} 页`,
    );
    expect(result.text).not.toContain(`（第 ${MAX_PDF_PAGES + 1} 页）`);
    // 关键：上限在提取前生效，超出的页从未被读取
    expect(pdf.getPage).toHaveBeenCalledTimes(MAX_PDF_PAGES);
  });

  it('读取失败时归一为 DocumentParseError', async () => {
    mocks.getDocumentProxy.mockRejectedValue(new Error('broken pdf'));
    await expect(
      parsePdf(new File(['x'], '坏文件.pdf')),
    ).rejects.toBeInstanceOf(DocumentParseError);
  });
});
