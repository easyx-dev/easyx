/**
 * AI 富文本样式作用域化纯函数测试：前缀生成 / CSS 选择器改写 / style 注入与整段包装
 */
import { describe, expect, it } from '@rstest/core';
import {
  generateScopePrefix,
  prefixCss,
  scopeCssOfHtml,
  scopedRichContent,
  unprefixCss,
  unscopeCssOfHtml,
  unscopeRichContent,
} from '../src/utils/scope';

const P = 'easyx-rich-content-x';

describe('generateScopePrefix', () => {
  it('缺省生成以 easyx-rich-content- 开头的随机前缀', () => {
    expect(generateScopePrefix()).toMatch(/^easyx-rich-content-[a-z0-9]{4,}$/i);
  });

  it('传 scopeId 时生成稳定前缀', () => {
    expect(generateScopePrefix('news-a')).toBe('easyx-rich-content-news-a');
  });

  it('scopeId 会过滤非法 class 字符', () => {
    expect(generateScopePrefix('news/page!')).toBe(
      'easyx-rich-content-newspage',
    );
  });
});

describe('prefixCss', () => {
  it('给简单类选择器加前缀', () => {
    expect(prefixCss('.hero { color: red; }', P)).toBe(
      `.${P} .hero{ color: red; }`,
    );
  });

  it('给后代选择器加前缀', () => {
    expect(prefixCss('.hero h2 { margin: 0; }', P)).toBe(
      `.${P} .hero h2{ margin: 0; }`,
    );
  });

  it('给多选择器（逗号分隔）逐个加前缀', () => {
    expect(prefixCss('h1, .a > h2 { color: red }', P)).toBe(
      `.${P} h1, .${P} .a > h2{ color: red }`,
    );
  });

  it('@media/@supports 内嵌套规则递归加前缀', () => {
    expect(
      prefixCss('@media(max-width:600px){.a{color:red}.b{color:blue}}', P),
    ).toBe(`@media(max-width:600px){.${P} .a{color:red}.${P} .b{color:blue}}`);
  });

  it('@keyframes 内容原样保留（帧选择器不参与前缀）', () => {
    const css = '@keyframes spin{from{opacity:0}to{opacity:1}}';
    expect(prefixCss(css, P)).toBe(css);
  });

  it('@font-face 内容原样保留', () => {
    const css = '@font-face{font-family:x;src:url(x.woff2)}';
    expect(prefixCss(css, P)).toBe(css);
  });

  it('body/*/:root 等全局选择器也会被前缀化（不再污染宿主）', () => {
    expect(prefixCss('body{margin:0}', P)).toBe(`.${P} body{margin:0}`);
    expect(prefixCss('*{box-sizing:border-box}', P)).toBe(
      `.${P} *{box-sizing:border-box}`,
    );
    expect(prefixCss(':root{--x:1}', P)).toBe(`.${P} :root{--x:1}`);
  });

  it('字符串与注释内的花括号不会被误判为规则体', () => {
    expect(prefixCss('.x{content:"{";}', P)).toBe(`.${P} .x{content:"{";}`);
    expect(prefixCss('.x{} /* } */ .y{}', P)).toBe(
      `.${P} .x{}/* } */.${P} .y{}`,
    );
  });

  it('伪类选择器正常加前缀', () => {
    expect(prefixCss('a:hover{color:blue}', P)).toBe(
      `.${P} a:hover{color:blue}`,
    );
  });
});

describe('scopeCssOfHtml', () => {
  it('改写 <style> 内选择器', () => {
    const html = '<style>.hero{color:red}</style><div class="hero">x</div>';
    expect(scopeCssOfHtml(html, P)).toBe(
      `<style>.${P} .hero{color:red}</style><div class="hero">x</div>`,
    );
  });

  it('多个 <style> 块逐个改写并保留标签属性', () => {
    const html = '<style media="screen">.a{}</style><p></p><style>.b{}</style>';
    expect(scopeCssOfHtml(html, P)).toBe(
      `<style media="screen">.${P} .a{}</style><p></p><style>.${P} .b{}</style>`,
    );
  });

  it('无 <style> 时原样返回且不改变内联样式', () => {
    const html = '<section style="color:red"><h2>标题</h2></section>';
    expect(scopeCssOfHtml(html, P)).toBe(html);
  });
});

describe('scopedRichContent', () => {
  it('用传入前缀包进作用域容器并把 style 选择器改名', () => {
    const html = '<style>.hero{}</style><div class="hero">x</div>';
    expect(scopedRichContent(html, 'easyx-rich-content-demo')).toBe(
      '<div class="easyx-rich-content-demo"><style>.easyx-rich-content-demo .hero{}</style><div class="hero">x</div></div>',
    );
  });

  it('未传前缀时临时生成随机前缀并包裹（兜底）', () => {
    const html = '<p>hi</p>';
    const result = scopedRichContent(html);
    expect(result).toMatch(
      /^<div class="easyx-rich-content-[a-z0-9]{4,}"><p>hi<\/p><\/div>$/i,
    );
  });
});

describe('prefixCss 幂等', () => {
  it('已带前缀的选择器不重复加前缀', () => {
    expect(prefixCss(`.${P} .hero{color:red}`, P)).toBe(
      `.${P} .hero{color:red}`,
    );
  });

  it('重复作用域化不产生叠加前缀', () => {
    const once = prefixCss('.hero{color:red}', P);
    expect(prefixCss(once, P)).toBe(once);
  });
});

describe('unprefixCss', () => {
  it('去掉选择器前缀（简单与后代选择器）', () => {
    expect(unprefixCss(`.${P} .hero{color:red}`, P)).toBe('.hero{color:red}');
    expect(unprefixCss(`.${P} .hero h2{margin:0}`, P)).toBe(
      '.hero h2{margin:0}',
    );
  });

  it('多选择器逐个去前缀', () => {
    expect(unprefixCss(`.${P} h1, .${P} .a > h2{color:red}`, P)).toBe(
      'h1, .a > h2{color:red}',
    );
  });

  it('@media 内递归去前缀，@keyframes 原样保留', () => {
    expect(unprefixCss(`@media(max-width:600px){.${P} .a{color:red}}`, P)).toBe(
      '@media(max-width:600px){.a{color:red}}',
    );
    const frames = '@keyframes spin{from{opacity:0}to{opacity:1}}';
    expect(unprefixCss(frames, P)).toBe(frames);
  });

  it('未带前缀的选择器原样保留', () => {
    expect(unprefixCss('.hero{color:red}', P)).toBe('.hero{color:red}');
  });
});

describe('unscopeCssOfHtml', () => {
  it('改写 <style> 内选择器（scopeCssOfHtml 的逆向）', () => {
    const scoped = `<style>.${P} .hero{color:red}</style><div class="hero">x</div>`;
    expect(unscopeCssOfHtml(scoped, P)).toBe(
      '<style>.hero{color:red}</style><div class="hero">x</div>',
    );
  });

  it('保留 style 标签属性', () => {
    const scoped = `<style media="screen">.${P} .a{}</style>`;
    expect(unscopeCssOfHtml(scoped, P)).toBe(
      '<style media="screen">.a{}</style>',
    );
  });
});

describe('unscopeRichContent', () => {
  it('作用域化与去作用域化可往返（源片段 ↔ 产物）', () => {
    const source =
      '<style>.hero{color:red}.hero h2{margin:0}</style><div class="hero"><h2>标题</h2></div>';
    expect(unscopeRichContent(scopedRichContent(source, P), P)).toBe(source);
  });

  it('保留未带前缀的用户选择器', () => {
    const wrapped = `<div class="${P}"><style>.hero{color:red}</style><p>x</p></div>`;
    expect(unscopeRichContent(wrapped, P)).toBe(
      '<style>.hero{color:red}</style><p>x</p>',
    );
  });

  it('未被包装的内容原样返回（仅做选择器去前缀）', () => {
    expect(unscopeRichContent('<p>hi</p>', P)).toBe('<p>hi</p>');
  });

  it('用户改写过结构（外层不匹配）时不去掉外层', () => {
    const html = `<section><div class="${P}"><p>x</p></div></section>`;
    expect(unscopeRichContent(html, P)).toBe(html);
  });

  it('前缀变化（页面重载）后仍能剥掉旧包装与旧选择器前缀', () => {
    const source = '<style>.hero{color:red}</style><div class="hero">x</div>';
    const previous = 'easyx-rich-content-oldprefix';
    const persisted = scopedRichContent(source, previous);
    // 新实例前缀不同，仍应还原出干净源片段，避免逐轮叠加包装
    expect(unscopeRichContent(persisted, 'easyx-rich-content-newprefix')).toBe(
      source,
    );
  });

  it('非本包生成的外层 div 不会被误剥', () => {
    const html = '<div class="my-wrapper"><p>x</p></div>';
    expect(unscopeRichContent(html, P)).toBe(html);
  });
});
