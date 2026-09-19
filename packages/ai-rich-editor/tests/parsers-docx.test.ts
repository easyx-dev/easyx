// @rstest-environment jsdom
/**
 * docx 解析测试：mammoth 调用编排与产物收敛（图片占位、不可信节点剔除）
 *
 * mammoth 本身由浏览器预构建包提供，这里用 mock 只验证包内的编排与收敛逻辑。
 */
import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  convertToHtml: rs.fn(),
}));

rs.mock('mammoth/mammoth.browser.min.js', () => ({
  default: {
    convertToHtml: mocks.convertToHtml,
    images: { imgElement: (convert: unknown) => convert },
  },
}));

import {
  DocumentParseError,
  UnsupportedDocumentError,
} from '../src/parsers/errors';
import { parseDocx, sanitizeDocumentHtml } from '../src/parsers/parse-docx';

beforeEach(() => {
  mocks.convertToHtml.mockReset();
});

describe('sanitizeDocumentHtml', () => {
  it('图片替换为占位文本', () => {
    const html = sanitizeDocumentHtml('<p>前<img src="x">后</p>');
    expect(html).toBe('<p>前[图片]后</p>');
  });

  it('picture 包裹的图片也保留占位', () => {
    const html = sanitizeDocumentHtml(
      '<p>前<picture><source srcset="a.webp"><img src="a.png"></picture>后</p>',
    );
    expect(html).toContain('[图片]');
  });

  it('剔除脚本、样式与注释', () => {
    const html = sanitizeDocumentHtml(
      '<style>p{color:red}</style><!--注释--><p>正文</p><script>x()</script>',
    );
    expect(html).toBe('<p>正文</p>');
  });

  it('保留表格等语义结构', () => {
    const html = sanitizeDocumentHtml(
      '<table><tbody><tr><td>甲</td></tr></tbody></table>',
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<td>甲</td>');
  });
});

describe('parseDocx', () => {
  it('非 docx 直接抛出 UnsupportedDocumentError', async () => {
    const file = new File(['x'], 'a.pdf');
    await expect(parseDocx(file)).rejects.toBeInstanceOf(
      UnsupportedDocumentError,
    );
  });

  it('转换结果经收敛后返回', async () => {
    mocks.convertToHtml.mockResolvedValue({
      value: '<h1>标题</h1><img src="data:image/png;base64,xxx">',
    });
    const file = new File(['x'], '方案.docx');
    const result = await parseDocx(file);
    expect(result.kind).toBe('docx');
    expect(result.name).toBe('方案.docx');
    expect(result.html).toBe('<h1>标题</h1>[图片]');
  });

  it('转换抛出时归一为 DocumentParseError', async () => {
    mocks.convertToHtml.mockRejectedValue(new Error('bad zip'));
    const file = new File(['x'], '损坏.docx');
    await expect(parseDocx(file)).rejects.toBeInstanceOf(DocumentParseError);
  });
});
