/**
 * 文档解析产物测试：上下文块拼装、截断、归一化与文件分流
 */
import { describe, expect, it } from '@rstest/core';
import {
  createPendingDocument,
  normalizeParsedDocument,
  splitDocumentFiles,
} from '../src/parsers/document-state';
import { UnsupportedDocumentError } from '../src/parsers/errors';
import {
  buildDocumentBlock,
  DOCUMENT_BLOCK_TITLE,
} from '../src/parsers/prompt-text';

describe('buildDocumentBlock', () => {
  it('docx：来源行 + html 围栏', () => {
    const block = buildDocumentBlock({
      name: '方案.docx',
      kind: 'docx',
      html: '<h1>标题</h1>',
    });
    expect(block).toBe(
      `${DOCUMENT_BLOCK_TITLE}\n来源：方案.docx（Word 文档）\n\`\`\`html\n<h1>标题</h1>\n\`\`\``,
    );
  });

  it('pdf：来源行带页数，正文用 text 围栏', () => {
    const block = buildDocumentBlock({
      name: '报告.pdf',
      kind: 'pdf',
      text: '（第 1 页）\n正文',
      pageCount: 2,
    });
    expect(block).toContain('来源：报告.pdf（PDF，共 2 页）');
    expect(block).toContain('```text');
  });

  it('解析提示写在围栏之前', () => {
    const block = buildDocumentBlock({
      name: '扫描件.pdf',
      kind: 'pdf',
      text: '',
      pageCount: 3,
      warnings: ['未提取到文本，可能是扫描件或纯图片 PDF'],
    });
    expect(block).toContain('提示：未提取到文本');
    expect(block).toContain('（未能提取到可用文本）');
  });

  it('超出字符预算时截断并标注', () => {
    const block = buildDocumentBlock(
      { name: 'a.pdf', kind: 'pdf', text: 'x'.repeat(50) },
      { maxChars: 10 },
    );
    expect(block).toContain('已截断');
    expect(block).toContain('x'.repeat(10));
    expect(block).not.toContain('x'.repeat(11));
  });

  it('截断不劈开代理字符（emoji）', () => {
    const block = buildDocumentBlock(
      { name: 'a.pdf', kind: 'pdf', text: `${'a'.repeat(9)}😀tail` },
      { maxChars: 10 },
    );
    expect(block).not.toContain('\ud83d'); // 不应残留孤立的高代理项
    expect(block).toContain('a'.repeat(9));
  });
});

describe('normalizeParsedDocument', () => {
  it('补全 name/kind 并收敛 warnings', () => {
    const file = new File(['x'], '合同.pdf');
    const result = normalizeParsedDocument(
      { text: '正文', warnings: ['提示', 1 as unknown as string] },
      file,
    );
    expect(result.name).toBe('合同.pdf');
    expect(result.kind).toBe('pdf');
    expect(result.warnings).toEqual(['提示']);
  });

  it('宿主给出的 name/kind 优先', () => {
    const file = new File(['x'], '合同.pdf');
    const result = normalizeParsedDocument(
      { name: '改写名.pdf', kind: 'pdf', text: '正文' },
      file,
    );
    expect(result.name).toBe('改写名.pdf');
  });
});

describe('splitDocumentFiles', () => {
  const docx = new File(['x'], 'a.docx');
  const pdf = new File(['x'], 'b.pdf');
  const png = new File(['x'], 'c.png');
  const legacy = new File(['x'], 'd.doc');

  it('未启用解析时全部走媒体链路', () => {
    const split = splitDocumentFiles([docx, png], { enabled: false });
    expect(split.documents).toEqual([]);
    expect(split.errors).toEqual([]);
    expect(split.media).toEqual([docx, png]);
  });

  it('启用后按扩展名分流，旧格式报明确错误', () => {
    const split = splitDocumentFiles([docx, pdf, png, legacy], {
      enabled: true,
    });
    expect(split.documents).toEqual([docx, pdf]);
    expect(split.media).toEqual([png]);
    expect(split.errors).toHaveLength(1);
    expect(split.errors[0]).toBeInstanceOf(UnsupportedDocumentError);
  });

  it('有附件上传能力时旧格式落回媒体，而非报错', () => {
    const split = splitDocumentFiles([legacy], {
      enabled: true,
      legacyAsMedia: true,
    });
    expect(split.media).toEqual([legacy]);
    expect(split.errors).toEqual([]);
  });
});

describe('createPendingDocument', () => {
  it('初始为解析中状态并持有原文件', () => {
    const file = new File(['x'], 'a.docx');
    const doc = createPendingDocument(file);
    expect(doc.status).toBe('parsing');
    expect(doc.file).toBe(file);
    expect(doc.name).toBe('a.docx');
  });
});
