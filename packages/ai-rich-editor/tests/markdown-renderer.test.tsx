// @rstest-environment jsdom
/**
 * markdown 渲染层测试：token → React 元素的映射与安全边界
 *
 * 重点不是「markdown 能渲染」，而是三件容易出错的事：
 * 1. 流式半成品（未闭合围栏、未闭合表格）也要能渲染
 * 2. 裸 HTML 与危险协议的链接不能穿透成可执行内容
 * 3. 代码块要按语言分流（```html 走卡片，其余走通用块）
 */

import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, render } from '@testing-library/react';
import { renderMarkdown } from '../src/markdown/renderer';

afterEach(() => cleanup());

/** 以固定代码块渲染器渲染，便于断言分流结果 */
function renderMd(content: string) {
  const { container } = render(
    <div>
      {renderMarkdown(content, ({ lang, code }) => (
        <pre data-lang={lang}>{code}</pre>
      ))}
    </div>,
  );
  return container;
}

describe('renderMarkdown 结构映射', () => {
  it('标题映射为 md-heading 层级类', () => {
    const container = renderMd('## 常见原因');
    const heading = container.querySelector(
      '.easyx-ai-rich-editor__md-heading--2',
    );
    expect(heading?.textContent).toBe('常见原因');
  });

  it('行内样式：加粗 / 斜体 / 删除线 / 行内代码', () => {
    const container = renderMd('**粗** *斜* ~~删~~ `码`');
    expect(container.querySelector('strong')?.textContent).toBe('粗');
    expect(container.querySelector('em')?.textContent).toBe('斜');
    expect(container.querySelector('del')?.textContent).toBe('删');
    expect(container.querySelector('code')?.textContent).toBe('码');
  });

  it('有序与无序列表按标记分流，并保留起始序号', () => {
    const unordered = renderMd('- 一\n- 二');
    expect(unordered.querySelectorAll('ul > li').length).toBe(2);

    const ordered = renderMd('3. 三\n4. 四');
    const ol = ordered.querySelector('ol');
    expect(ol?.getAttribute('start')).toBe('3');
    expect(ol?.querySelectorAll('li').length).toBe(2);
  });

  it('任务列表渲染为只读勾选框', () => {
    const container = renderMd('- [x] 已完成\n- [ ] 未完成');
    const boxes = container.querySelectorAll<HTMLInputElement>(
      '.easyx-ai-rich-editor__md-task input',
    );
    expect(boxes.length).toBe(2);
    expect(boxes[0].checked).toBe(true);
    expect(boxes[0].disabled).toBe(true);
    expect(boxes[1].checked).toBe(false);
  });

  it('表格渲染表头与单元格，并带上对齐方式', () => {
    const container = renderMd('| 名称 | 数量 |\n| :--- | ---: |\n| 甲 | 1 |');
    expect(container.querySelectorAll('th').length).toBe(2);
    expect(container.querySelectorAll('td').length).toBe(2);
    expect(container.querySelector('th')?.style.textAlign).toBe('left');
    expect(container.querySelectorAll('th')[1].style.textAlign).toBe('right');
  });

  it('引用块递归渲染内部块级内容', () => {
    const container = renderMd('> 引用中的 **重点**');
    const quote = container.querySelector('blockquote');
    expect(quote?.querySelector('strong')?.textContent).toBe('重点');
  });
});

describe('renderMarkdown 代码块分流', () => {
  it('按语言把代码块交给渲染回调', () => {
    const renderCode = rs.fn(({ lang }: { lang: string }) => (
      <pre data-lang={lang} />
    ));
    render(
      <div>
        {renderMarkdown('```html\n<div>x</div>\n```', renderCode as never)}
      </div>,
    );
    expect(renderCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: '<div>x</div>', lang: 'html' }),
    );
  });

  it('未闭合围栏同样产出代码块（流式半成品）', () => {
    const container = renderMd('说明\n```html\n<div>进行中</div>');
    const pre = container.querySelector('[data-lang="html"]');
    expect(pre?.textContent).toBe('<div>进行中</div>');
  });

  it('未闭合表格也能渲染部分行列', () => {
    const container = renderMd('| a | b |\n| --- | --- |\n| 1 |');
    expect(container.querySelectorAll('th').length).toBe(2);
    // 缺列的行由 marked 补齐到表头列数，首格保留内容
    const cells = container.querySelectorAll('td');
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toBe('1');
  });
});

describe('renderMarkdown 安全边界', () => {
  it('裸 HTML 一律丢弃（不进入 dangerouslySetInnerHTML）', () => {
    const container = renderMd('<img src=x onerror="alert(1)">\n\n正常文本');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('正常文本');
  });

  it('危险协议的链接降级为纯文本', () => {
    const container = renderMd('[点我](javascript:alert(1))');
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('点我');
  });

  it('http(s) 链接在新窗口打开并带 noreferrer', () => {
    const container = renderMd('[官网](https://example.com)');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noreferrer');
  });

  it('相对路径链接放行', () => {
    const container = renderMd('[详情](/uploads/a.png)');
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/uploads/a.png',
    );
  });

  it('危险协议的图片不渲染', () => {
    const container = renderMd('![x](data:text/html;base64,PHNjcmlwdD4=)');
    expect(container.querySelector('img')).toBeNull();
  });
});
