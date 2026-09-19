/**
 * Search/Replace 补丁协议测试：解析、意图判定与应用（精确/柔性/歧义/原子失败）
 */
import { describe, expect, it } from '@rstest/core';
import {
  applyPatchBlocks,
  parseEditReply,
  parsePatchBlocks,
  wrapBarePatchBlocks,
} from '../src/utils/patch';

/** 拼一个补丁块 */
function block(search: string, replace: string): string {
  return ['<<<<<<< SEARCH', search, '=======', replace, '>>>>>>> REPLACE'].join(
    '\n',
  );
}

describe('parsePatchBlocks', () => {
  it('解析单个块（保留缩进）', () => {
    expect(parsePatchBlocks(block('  <h2>旧</h2>', '  <h2>新</h2>'))).toEqual([
      { search: '  <h2>旧</h2>', replace: '  <h2>新</h2>' },
    ]);
  });

  it('解析多个块并保持顺序', () => {
    const content = `${block('a', 'A')}\n说明\n${block('b', 'B')}`;
    expect(parsePatchBlocks(content)).toEqual([
      { search: 'a', replace: 'A' },
      { search: 'b', replace: 'B' },
    ]);
  });

  it('缺少分隔符的块被忽略（无内容可替换）', () => {
    expect(parsePatchBlocks('<<<<<<< SEARCH\na\n')).toEqual([]);
  });

  it('缺少结束标记的块仍可解析（高频模型偏差容错）', () => {
    expect(parsePatchBlocks('<<<<<<< SEARCH\na\n=======\nb\n')).toEqual([
      { search: 'a', replace: 'b' },
    ]);
    const fenced = [
      '```patch',
      '<<<<<<< SEARCH',
      'a',
      '=======',
      'b',
      '```',
    ].join('\n');
    expect(parsePatchBlocks(fenced)).toEqual([{ search: 'a', replace: 'b' }]);
  });

  it('兼容围栏与多余说明文字', () => {
    const content = `我改一下标题：\n\`\`\`patch\n${block('<h2>x</h2>', '<h2>y</h2>')}\n\`\`\``;
    expect(parsePatchBlocks(content)).toHaveLength(1);
  });

  it('容错：SEARCH 内容跟在标记同一行', () => {
    const content = [
      '<<<<<<< SEARCH <h2>旧</h2>',
      '=======',
      '<h2>新</h2>',
      '>>>>>>> REPLACE',
    ].join('\n');
    expect(parsePatchBlocks(content)).toEqual([
      { search: '<h2>旧</h2>', replace: '<h2>新</h2>' },
    ]);
  });

  it('容错：REPLACE 内容跟在分隔符同一行', () => {
    const content = [
      '<<<<<<< SEARCH',
      '旧',
      '======= 新',
      '>>>>>>> REPLACE',
    ].join('\n');
    expect(parsePatchBlocks(content)).toEqual([
      { search: '旧', replace: '新' },
    ]);
  });

  it('容错：连字符数目少于 7 也能识别', () => {
    const content = ['<<< SEARCH', '旧', '===', '新', '>>> REPLACE'].join('\n');
    expect(parsePatchBlocks(content)).toEqual([
      { search: '旧', replace: '新' },
    ]);
  });

  it('容错：标记大小写与前导空白', () => {
    const content = [
      '  <<<<<<< search',
      '旧',
      '  =======',
      '新',
      '  >>>>>>> replace',
    ].join('\n');
    expect(parsePatchBlocks(content)).toEqual([
      { search: '旧', replace: '新' },
    ]);
  });
});

describe('wrapBarePatchBlocks', () => {
  it('给裸补丁补上 patch 围栏', () => {
    const bare = [
      '说明',
      '<<<<<<< SEARCH',
      '<h2>旧</h2>',
      '=======',
      '<h2>新</h2>',
      '>>>>>>> REPLACE',
    ].join('\n');
    const wrapped = wrapBarePatchBlocks(bare);
    expect(wrapped).toContain('说明\n```patch\n<<<<<<< SEARCH');
    expect(wrapped.trimEnd().endsWith('```')).toBe(true);
  });

  it('已套围栏的补丁不重复包裹', () => {
    const fenced = `\`\`\`patch\n${block('a', 'A')}\n\`\`\``;
    expect(wrapBarePatchBlocks(fenced)).toBe(fenced);
  });

  it('流式未闭合时先包到末尾', () => {
    const partial = '说明\n<<<<<<< SEARCH\n<h2>未完成';
    const wrapped = wrapBarePatchBlocks(partial);
    expect(wrapped).toContain('```patch');
    expect(wrapped.trimEnd().endsWith('```')).toBe(true);
  });

  it('标记连字符少于 7 的裸块同样补围栏（与解析器口径一致）', () => {
    const bare = ['<<< SEARCH', '旧', '===', '新', '>>> REPLACE'].join('\n');
    const wrapped = wrapBarePatchBlocks(bare);
    expect(wrapped.startsWith('```patch')).toBe(true);
    expect(wrapped.trimEnd().endsWith('```')).toBe(true);
  });
});

describe('parseEditReply', () => {
  it('有补丁块时判定为 patch', () => {
    const reply = parseEditReply(block('a', 'A'));
    expect(reply.kind).toBe('patch');
  });

  it('无补丁但含 HTML 代码块时判定为 html', () => {
    const reply = parseEditReply('```html\n<div>全量</div>\n```');
    expect(reply).toEqual({ kind: 'html', html: '<div>全量</div>' });
  });

  it('含补丁标记但无完整块时判定为 invalid', () => {
    const reply = parseEditReply('<<<<<<< SEARCH\na\n');
    expect(reply.kind).toBe('invalid');
  });

  it('两者都没有时判定为 none', () => {
    expect(parseEditReply('只是说明文字')).toEqual({ kind: 'none' });
  });

  it('补丁与全量片段同现时优先全量片段（主流程整段替换）', () => {
    const reply = parseEditReply(
      `${block('a', 'A')}\n\`\`\`html\n<div>x</div>\n\`\`\``,
    );
    expect(reply).toEqual({ kind: 'html', html: '<div>x</div>' });
  });
});

describe('applyPatchBlocks', () => {
  it('精确匹配并替换', () => {
    const outcome = applyPatchBlocks('<div><h2>旧</h2></div>', [
      { search: '<h2>旧</h2>', replace: '<h2>新</h2>' },
    ]);
    expect(outcome).toEqual({
      ok: true,
      result: '<div><h2>新</h2></div>',
      applied: 1,
    });
  });

  it('缩进/空白不一致时按空白柔性匹配', () => {
    const source = '<div>\n        <h2>标题</h2>\n</div>';
    const outcome = applyPatchBlocks(source, [
      { search: '<div>\n  <h2>标题</h2>\n</div>', replace: '<p>换掉了</p>' },
    ]);
    expect(outcome).toEqual({ ok: true, result: '<p>换掉了</p>', applied: 1 });
  });

  it('多次匹配同一文本判定为歧义，不落地', () => {
    const outcome = applyPatchBlocks('<p>a</p><p>a</p>', [
      { search: '<p>a</p>', replace: '<p>b</p>' },
    ]);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failures[0].reason).toBe('ambiguous');
      expect(outcome.failures[0].occurrences).toBe(2);
    }
  });

  it('未找到判定为 not-found，不落地', () => {
    const outcome = applyPatchBlocks('<div>x</div>', [
      { search: '<h2>不存在</h2>', replace: '<h2>y</h2>' },
    ]);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failures[0].reason).toBe('not-found');
  });

  it('多个块在前一块结果之上顺序应用', () => {
    const outcome = applyPatchBlocks('<div><p>1</p><p>2</p></div>', [
      { search: '<p>1</p>', replace: '<p>一</p>' },
      { search: '<p>2</p>', replace: '<p>二</p>' },
    ]);
    expect(outcome).toEqual({
      ok: true,
      result: '<div><p>一</p><p>二</p></div>',
      applied: 2,
    });
  });

  it('任一块失败即整体不落地（原子）', () => {
    const outcome = applyPatchBlocks('<div><p>1</p></div>', [
      { search: '<p>1</p>', replace: '<p>一</p>' },
      { search: '<p>不存在</p>', replace: '<p>二</p>' },
    ]);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.applied).toBe(1);
  });

  it('CRLF 归一后仍可精确匹配', () => {
    const outcome = applyPatchBlocks('<div>\r\n<p>a</p>\r\n</div>', [
      { search: '<p>a</p>', replace: '<p>b</p>' },
    ]);
    expect(outcome.ok).toBe(true);
  });
});
