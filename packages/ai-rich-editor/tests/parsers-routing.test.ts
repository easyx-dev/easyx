/**
 * 文档类型判定测试：扩展名识别、旧格式识别与 accept 计算
 */
import { describe, expect, it } from '@rstest/core';
import {
  DEFAULT_DOCUMENT_EXTENSIONS,
  documentAccept,
  isDocumentFile,
  isLegacyDoc,
  resolveDocumentKind,
} from '../src/parsers/routing';

describe('resolveDocumentKind', () => {
  it('识别 docx 与 pdf（忽略大小写与查询串）', () => {
    expect(resolveDocumentKind('方案.docx')).toBe('docx');
    expect(resolveDocumentKind('REPORT.DOCX')).toBe('docx');
    expect(resolveDocumentKind('报告.pdf?v=1')).toBe('pdf');
  });

  it('非目标扩展名返回 undefined', () => {
    expect(resolveDocumentKind('旧版.doc')).toBeUndefined();
    expect(resolveDocumentKind('a.docx.txt')).toBeUndefined();
    expect(resolveDocumentKind('无扩展名')).toBeUndefined();
  });
});

describe('isLegacyDoc', () => {
  it('只认 .doc（不把 .docx 当旧格式）', () => {
    expect(isLegacyDoc('合同.doc')).toBe(true);
    expect(isLegacyDoc('合同.docx')).toBe(false);
  });
});

describe('isDocumentFile', () => {
  it('按默认扩展名判定', () => {
    expect(isDocumentFile('a.pdf')).toBe(true);
    expect(isDocumentFile('a.docx')).toBe(true);
    expect(isDocumentFile('a.png')).toBe(false);
  });

  it('支持自定义扩展名', () => {
    expect(isDocumentFile('a.md', ['.md'])).toBe(true);
    expect(isDocumentFile('a.pdf', ['.md'])).toBe(false);
  });
});

describe('documentAccept', () => {
  it('默认给出 docx 与 pdf', () => {
    expect(documentAccept()).toBe('.docx,.pdf');
    expect(documentAccept(DEFAULT_DOCUMENT_EXTENSIONS)).toBe('.docx,.pdf');
  });

  it('可覆盖扩展名', () => {
    expect(documentAccept(['.md'])).toBe('.md');
  });
});
