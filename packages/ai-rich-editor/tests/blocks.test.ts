/**
 * 预览元素扫描、标记注入与目标回解测试
 */
import { describe, expect, it } from '@rstest/core';
import {
  buildInteractivePreviewDocument,
  PREVIEW_NODE_ATTR,
  resolvePreviewTarget,
  scanElements,
  tagElements,
} from '../src/utils/blocks';

const P = 'easyx-rich-content-x';

describe('scanElements', () => {
  it('按文档序编号并记录父子关系', () => {
    const source =
      '<div class="a"><p>标题</p><a href="#"><span>链接</span></a></div>';
    const elements = scanElements(source);
    expect(elements.map((e) => e.tagName)).toEqual(['div', 'p', 'a', 'span']);
    expect(elements.map((e) => e.id)).toEqual([0, 1, 2, 3]);
    expect(elements.map((e) => e.parentId)).toEqual([null, 0, 0, 2]);
  });

  it('元素区间切出的正是原文', () => {
    const source = '<div class="a"><p>标题</p></div>';
    const [div, p] = scanElements(source);
    expect(source.slice(div.start, div.end)).toBe(
      '<div class="a"><p>标题</p></div>',
    );
    expect(source.slice(p.start, p.end)).toBe('<p>标题</p>');
  });

  it('void 元素与自闭合标签自成元素', () => {
    const elements = scanElements('<img src="a.png"><br><hr/>');
    expect(elements.map((e) => e.tagName)).toEqual(['img', 'br', 'hr']);
    expect(elements.every((e) => e.end > e.start)).toBe(true);
  });

  it('style/script 为原始文本，内部 < 不产生元素', () => {
    const elements = scanElements(
      '<style>.a{content:"<"}</style><script>if(a<b){}</script><p>x</p>',
    );
    expect(elements.map((e) => e.tagName)).toEqual(['style', 'script', 'p']);
  });

  it('注释与声明被跳过', () => {
    const elements = scanElements('<!-- c --><!DOCTYPE html><p>x</p>');
    expect(elements.map((e) => e.tagName)).toEqual(['p']);
  });

  it('属性内的引号与 > 不影响解析', () => {
    const elements = scanElements(
      '<div data-x="a>b" title=\'c>d\'><p>x</p></div>',
    );
    expect(elements.map((e) => e.tagName)).toEqual(['div', 'p']);
  });

  it('未闭合元素收尾到文本末尾', () => {
    const source = '<div><p>未闭合';
    const elements = scanElements(source);
    expect(source.slice(elements[0].start, elements[0].end)).toBe(source);
    expect(source.slice(elements[1].start, elements[1].end)).toBe('<p>未闭合');
  });
});

describe('tagElements', () => {
  it('给每个元素（含嵌套）插入编号', () => {
    expect(tagElements('<div class="a"><p>x</p></div>')).toBe(
      `<div ${PREVIEW_NODE_ATTR}="0" class="a"><p ${PREVIEW_NODE_ATTR}="1">x</p></div>`,
    );
  });

  it('void 元素也能插入编号', () => {
    expect(tagElements('<img src="a">')).toBe(
      `<img ${PREVIEW_NODE_ATTR}="0" src="a">`,
    );
  });
});

describe('buildInteractivePreviewDocument', () => {
  const source =
    '<style>.hero{color:red}</style><div class="hero"><h2>标题</h2></div>';

  it('包裹作用域容器、改写选择器并注入元素编号', () => {
    const doc = buildInteractivePreviewDocument(source, P);
    expect(doc).toContain(`<div class="${P}">`);
    expect(doc).toContain(`.${P} .hero{color:red}`);
    expect(doc).toContain(`${PREVIEW_NODE_ATTR}="0"`);
    expect(doc).toContain(`${PREVIEW_NODE_ATTR}="2"`);
  });

  it('注入悬停提示样式并保留 previewHead', () => {
    const doc = buildInteractivePreviewDocument(
      source,
      P,
      '<style>body{margin:0}</style>',
    );
    expect(doc).toContain(':hover');
    expect(doc).toContain('<style>body{margin:0}</style>');
  });
});

describe('resolvePreviewTarget', () => {
  const source =
    '<div class="wrap"><p>标题</p><a href="#"><span>链接</span></a></div>';

  it('命中编号取的是最内层元素原文', () => {
    const target = resolvePreviewTarget(source, 3);
    expect(target?.targetHtml).toBe('<span>链接</span>');
    expect(target?.selectedText).toBeUndefined();
  });

  it('元素原文重复时向上扩张到唯一祖先', () => {
    const list = '<ul><li>a</li><li>a</li></ul>';
    const target = resolvePreviewTarget(list, 2);
    expect(target?.targetHtml).toBe('<ul><li>a</li><li>a</li></ul>');
  });

  it('选中文本唯一时标记为可作为精确目标', () => {
    const target = resolvePreviewTarget(source, 1, '标题');
    expect(target?.selectedText).toBe('标题');
    expect(target?.selectUnique).toBe(true);
  });

  it('选中文本重复时标记为不唯一', () => {
    const target = resolvePreviewTarget('<p>a</p><p>a</p>', 0, 'a');
    expect(target?.selectUnique).toBe(false);
  });

  it('编号越界返回 null', () => {
    expect(resolvePreviewTarget(source, 99)).toBeNull();
  });
});
