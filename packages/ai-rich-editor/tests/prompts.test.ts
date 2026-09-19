/**
 * AI Rich Editor 提示词能力测试：fragment-only 定位的默认 system 提示词
 */
import { describe, expect, it } from '@rstest/core';
import {
  CURRENT_FRAGMENT_BLOCK_TITLE,
  SELECTION_BLOCK_TITLE,
  TARGET_BLOCK_TITLE,
} from '../src/chat/prompt-blocks';
import { buildDefaultSystemPrompt } from '../src/prompts';

describe('buildDefaultSystemPrompt', () => {
  it('定位为富文本片段：只输出 body 内部片段', () => {
    const prompt = buildDefaultSystemPrompt();
    expect(prompt).toContain('富文本 HTML 片段生成助手');
    expect(prompt).toContain('另一种形态的富文本');
    expect(prompt).toContain('<body>');
    expect(prompt).toContain('```html');
  });

  it('不输出整页文档外壳（禁止 DOCTYPE/html/head/body）', () => {
    const prompt = buildDefaultSystemPrompt();
    expect(prompt).toContain(
      '禁止输出 <!DOCTYPE> / <html> / <head> / <body> 外壳',
    );
  });

  it('要求自包含样式与代码块包裹', () => {
    const prompt = buildDefaultSystemPrompt();
    expect(prompt).toContain('<style>');
    expect(prompt).toContain('```html');
  });

  it('修改类请求要求输出改动后的完整片段（对话历史即版本序列）', () => {
    const prompt = buildDefaultSystemPrompt();
    expect(prompt).toContain(CURRENT_FRAGMENT_BLOCK_TITLE);
    expect(prompt).toContain('改动后的完整片段');
    expect(prompt).toContain('最小化改动');
    expect(prompt).not.toContain('<<<<<<< SEARCH');
  });

  it('定向修改时以目标区域与选中文本为焦点', () => {
    const prompt = buildDefaultSystemPrompt();
    expect(prompt).toContain(TARGET_BLOCK_TITLE);
    expect(prompt).toContain(SELECTION_BLOCK_TITLE);
  });
});
