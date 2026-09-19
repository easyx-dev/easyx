/**
 * 用户消息上下文块测试：拼装、分段解析与历史片段剥离
 */
import { describe, expect, it } from '@rstest/core';
import {
  buildCurrentFragmentBlock,
  buildTargetBlock,
  CURRENT_FRAGMENT_BLOCK_TITLE,
  removeFragmentBlock,
  removeTargetBlocks,
  SELECTION_BLOCK_TITLE,
  splitPromptBlocks,
  TARGET_BLOCK_TITLE,
} from '../src/chat/prompt-blocks';
import { buildAttachmentBlock } from '../src/media/prompt-text';

describe('buildCurrentFragmentBlock', () => {
  it('空片段不生成块', () => {
    expect(buildCurrentFragmentBlock('')).toBe('');
    expect(buildCurrentFragmentBlock('   ')).toBe('');
  });

  it('用 html 围栏包裹片段', () => {
    expect(buildCurrentFragmentBlock('<div>x</div>')).toBe(
      `${CURRENT_FRAGMENT_BLOCK_TITLE}\n\`\`\`html\n<div>x</div>\n\`\`\``,
    );
  });
});

describe('buildTargetBlock', () => {
  it('无选区时只给目标区域', () => {
    const text = buildTargetBlock({
      elementId: 0,
      targetHtml: '<p>x</p>',
      selectUnique: false,
    });
    expect(text).toBe(`${TARGET_BLOCK_TITLE}\n\`\`\`html\n<p>x</p>\n\`\`\``);
  });

  it('唯一选区附带选中文本', () => {
    const text = buildTargetBlock({
      elementId: 0,
      targetHtml: '<p>x</p>',
      selectedText: 'x',
      selectUnique: true,
    });
    expect(text).toContain(SELECTION_BLOCK_TITLE);
    expect(text).toContain('x');
    expect(text).not.toContain('出现多次');
  });

  it('选区不唯一时附加提示', () => {
    const text = buildTargetBlock({
      elementId: 0,
      targetHtml: '<p>x</p>',
      selectedText: 'x',
      selectUnique: false,
    });
    expect(text).toContain('出现多次');
  });

  it('附带计算样式摘要', () => {
    const text = buildTargetBlock({
      elementId: 0,
      targetHtml: '<p>x</p>',
      selectUnique: false,
      styles: 'color: rgb(102, 102, 102); font-size: 16px',
    });
    expect(text).toContain('（当前计算样式）color: rgb(102, 102, 102)');
  });
});

describe('splitPromptBlocks', () => {
  it('纯原话：无任何块', () => {
    expect(splitPromptBlocks('把标题改大')).toEqual({
      text: '把标题改大',
      targets: [],
    });
  });

  it('拆分附件、当前片段、目标区域与选中文本', () => {
    const content = [
      '改这里',
      buildAttachmentBlock([{ kind: 'image', name: 'a.png', url: '/a.png' }]),
      buildCurrentFragmentBlock('<div>片段</div>'),
      buildTargetBlock({
        elementId: 1,
        targetHtml: '<h2>标题</h2>',
        selectedText: '标题',
        selectUnique: true,
      }),
    ].join('\n\n');

    const split = splitPromptBlocks(content);
    expect(split.text).toBe('改这里');
    expect(split.attachmentBlock).toContain('a.png');
    expect(split.fragment).toBe('<div>片段</div>');
    expect(split.targets).toEqual(['<h2>标题</h2>']);
    expect(split.selectedText).toBe('标题');
  });

  it('多选：按顺序收集全部目标区域', () => {
    const content = [
      '把这两个调成一致',
      buildTargetBlock({
        elementId: 1,
        targetHtml: '<p>甲</p>',
        selectUnique: false,
      }),
      buildTargetBlock({
        elementId: 3,
        targetHtml: '<p>乙</p>',
        selectUnique: false,
      }),
    ].join('\n\n');

    expect(splitPromptBlocks(content).targets).toEqual([
      '<p>甲</p>',
      '<p>乙</p>',
    ]);
  });
});

describe('removeFragmentBlock', () => {
  const fragment = buildCurrentFragmentBlock('<div>片段</div>');

  it('去掉片段块、保留后续的目标区域块', () => {
    const target = buildTargetBlock({
      elementId: 0,
      targetHtml: '<p>x</p>',
      selectUnique: false,
    });
    const content = `问题\n\n${fragment}\n\n${target}`;
    const result = removeFragmentBlock(content);
    expect(result).not.toContain(CURRENT_FRAGMENT_BLOCK_TITLE);
    expect(result).toContain(TARGET_BLOCK_TITLE);
    expect(result.startsWith('问题')).toBe(true);
  });

  it('无片段块时原样返回', () => {
    expect(removeFragmentBlock('普通消息')).toBe('普通消息');
  });
});

describe('removeTargetBlocks', () => {
  const fragment = buildCurrentFragmentBlock('<div>片段</div>');

  it('移除全部目标区域与选中文本，保留原话与当前片段', () => {
    const content = [
      '让这两个一致',
      fragment,
      buildTargetBlock({
        elementId: 1,
        targetHtml: '<p>甲</p>',
        selectUnique: false,
      }),
      buildTargetBlock({
        elementId: 3,
        targetHtml: '<p>乙</p>',
        selectedText: '乙',
        selectUnique: true,
      }),
    ].join('\n\n');

    const result = removeTargetBlocks(content);
    expect(result).not.toContain(TARGET_BLOCK_TITLE);
    expect(result).not.toContain(SELECTION_BLOCK_TITLE);
    expect(result).not.toContain('<p>甲</p>');
    expect(result).not.toContain('<p>乙</p>');
    expect(result).toContain(CURRENT_FRAGMENT_BLOCK_TITLE);
    expect(result).toContain('<div>片段</div>');
    expect(result.startsWith('让这两个一致')).toBe(true);
  });

  it('无目标块时原样返回', () => {
    expect(removeTargetBlocks('普通消息')).toBe('普通消息');
  });
});
