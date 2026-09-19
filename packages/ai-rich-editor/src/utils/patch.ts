/**
 * Search/Replace 补丁协议（纯函数）
 *
 * 主流程是「整段替换」，本模块只作为**兜底**：模型偶尔仍输出
 * `<<<<<<< SEARCH / ======= / >>>>>>> REPLACE` 块时，用它解析供界面渲染与手动应用。
 * 形态与 Aider / Cline / Cursor 一致：不带行号、明确分隔「查找内容」与「替换内容」。
 *
 * 匹配策略为「精确匹配 → 空白/缩进柔性匹配」，且**匹配数必须恰为 1**：
 * HTML 里重复标签多，命中不唯一就无法安全落地（不做「取第一处」的宽容）。
 * 应用是原子的：任一块失败即整体不落地，由调用方提示用户。
 */
import { lastHtmlFragment } from './extract';
import { hasPatchMarker } from './patch-markers';

export { hasPatchMarker };

/** 单个查找/替换块 */
export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

/** 补丁失败原因 */
export type PatchFailureReason = 'not-found' | 'ambiguous';

/** 单个块的应用失败 */
export interface PatchFailure {
  block: SearchReplaceBlock;
  reason: PatchFailureReason;
  /** 命中的位置数量（not-found 为 0） */
  occurrences: number;
}

/** 应用结果（成功给出新内容，失败不返回内容，调用方保留原文） */
export type ApplyPatchOutcome =
  | { ok: true; result: string; applied: number }
  | { ok: false; failures: PatchFailure[]; applied: number };

/** 单条回复的编辑意图 */
export type EditReply =
  | { kind: 'patch'; blocks: SearchReplaceBlock[] }
  | { kind: 'html'; html: string }
  | { kind: 'none' }
  | { kind: 'invalid'; errors: string[] };

/** 是否围栏行（``` 起） */
function isFenceLine(line: string): boolean {
  return /^[ \t]*```/.test(line);
}

/** 去掉行数组末尾的空行（文本末尾换行切出的空元素） */
function trimTrailingBlank(lines: string[]): string[] {
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * 解析回复中的查找/替换块
 *
 * 逐个块扫描：`<<<<<<< SEARCH` 起、`=======` 分隔、`>>>>>>> REPLACE` 止。
 * 对模型常见的格式偏差做容错（实测 DeepSeek 等会这样写）：
 * - 标记允许前导空白、大小写差异，连字符数允许 ≥ 3；
 * - 内容若跟在 `<<<<<<< SEARCH` / `=======` 同一行，取为对应侧首行；
 * - **漏写 `>>>>>>> REPLACE` 结束标记也接受**（以分隔符为准，替换内容取到围栏或文本末尾，
 *   这是最高频的模型偏差，靠重试纠偏成本太高）。
 * 未闭合到分隔符的块（流式半成品 / 无 `=======`）直接忽略，避免半截内容被误应用。
 */
export function parsePatchBlocks(content: string): SearchReplaceBlock[] {
  const lines = content.split('\n');
  const blocks: SearchReplaceBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const searchHead = /^[ \t]*<{3,}[ \t]*SEARCH\b[ \t]?(.*)$/i.exec(lines[i]);
    if (!searchHead) {
      i++;
      continue;
    }
    i++;
    const searchLines: string[] = [];
    if (searchHead[1].trim()) searchLines.push(searchHead[1]);
    while (
      i < lines.length &&
      !/^[ \t]*={3,}/.test(lines[i]) &&
      !isFenceLine(lines[i])
    ) {
      searchLines.push(lines[i]);
      i++;
    }
    // 没有分隔符（或先遇到围栏）视为不完整，跳过继续找后续块
    if (i >= lines.length) break;
    if (isFenceLine(lines[i])) {
      i++;
      continue;
    }

    const divider = lines[i].replace(/^[ \t]*={3,}[ \t]?/, '');
    i++;
    const replaceLines: string[] = [];
    if (divider.trim()) replaceLines.push(divider);
    while (i < lines.length) {
      if (/^[ \t]*>{3,}[ \t]*REPLACE\b/i.test(lines[i])) {
        i++;
        break;
      }
      if (isFenceLine(lines[i])) break; // 结束标记缺失时以围栏收尾
      replaceLines.push(lines[i]);
      i++;
    }

    blocks.push({
      search: trimTrailingBlank(searchLines).join('\n'),
      replace: trimTrailingBlank(replaceLines).join('\n'),
    });
  }

  return blocks;
}

/**
 * 给未套围栏的补丁块补上 ```patch 围栏（供对话渲染）
 *
 * 模型偶尔直接输出裸的 Search/Replace 标记而不套代码块，markdown 词法会把它当普通段落，
 * 于是气泡里只显示一堆 `<<<<<<<` 原文。此处在**不破坏原有围栏**的前提下，把裸块包进
 * ```patch … ```，渲染层即可照常识别为 diff 卡片；流式未闭合时也先包到末尾，
 * 由 PatchCard 以原文兜底展示。
 */
export function wrapBarePatchBlocks(content: string): string {
  if (!hasPatchMarker(content)) return content;
  const lines = content.split('\n');
  const out: string[] = [];
  let inFence = false;
  let collecting = false;

  for (const line of lines) {
    if (!inFence && /^[ \t]*<{3,}[ \t]*SEARCH\b/i.test(line)) {
      collecting = true;
      out.push('```patch', line);
      continue;
    }
    if (collecting && /^[ \t]*>{3,}[ \t]*REPLACE\b/i.test(line)) {
      out.push(line, '```');
      collecting = false;
      continue;
    }
    if (!collecting && /^[ \t]*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    out.push(line);
  }

  // 流式中块还未闭合：补一个围栏，让 marked 收进 code token
  if (collecting) out.push('```');
  return out.join('\n');
}

/**
 * 从回复中判定编辑意图
 *
 * 主流程是「整段替换」：只要回复里有完整的 ```html 片段就优先采用（对话历史即版本序列）。
 * 补丁块只在没有完整片段时才作为兜底识别（用于展示与手动应用，不自动落地）。
 */
export function parseEditReply(content: string): EditReply {
  const html = lastHtmlFragment(content);
  if (html) return { kind: 'html', html };

  const blocks = parsePatchBlocks(content);
  if (blocks.length > 0) return { kind: 'patch', blocks };
  if (hasPatchMarker(content)) {
    return {
      kind: 'invalid',
      errors: ['回复中的补丁块不完整，也没有完整片段'],
    };
  }
  return { kind: 'none' };
}

/** 正则转义 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 精确匹配的全部起始位置（非重叠） */
function findExact(haystack: string, needle: string): number[] {
  const positions: number[] = [];
  if (!needle) return positions;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    positions.push(at);
    from = at + needle.length;
  }
  return positions;
}

/** 把查找文本转成「空白柔性」正则：连续空白匹配任意空白（容忍缩进与换行差异） */
function flexiblePattern(needle: string): RegExp | null {
  const trimmed = needle.trim();
  if (!trimmed) return null;
  const pattern = escapeRegExp(trimmed).replace(/\s+/g, '\\s+');
  return new RegExp(pattern, 'g');
}

/** 单块匹配结果 */
type BlockMatch =
  | { ok: true; start: number; end: number }
  | { ok: false; failure: PatchFailure };

/** 单块匹配：精确 → 空白柔性；命中数必须恰为 1，否则失败 */
function matchBlock(haystack: string, block: SearchReplaceBlock): BlockMatch {
  const exact = findExact(haystack, block.search);
  if (exact.length === 1) {
    return { ok: true, start: exact[0], end: exact[0] + block.search.length };
  }
  if (exact.length > 1) {
    return {
      ok: false,
      failure: { block, reason: 'ambiguous', occurrences: exact.length },
    };
  }

  const regex = flexiblePattern(block.search);
  if (regex) {
    const spans: Array<{ start: number; end: number }> = [];
    for (const match of haystack.matchAll(regex)) {
      if (match[0].length === 0) continue;
      const start = match.index ?? 0;
      spans.push({ start, end: start + match[0].length });
    }
    if (spans.length === 1) {
      return { ok: true, start: spans[0].start, end: spans[0].end };
    }
    if (spans.length > 1) {
      return {
        ok: false,
        failure: { block, reason: 'ambiguous', occurrences: spans.length },
      };
    }
  }

  return { ok: false, failure: { block, reason: 'not-found', occurrences: 0 } };
}

/**
 * 依次应用补丁块（原子）
 *
 * 每个块都在前一块应用后的文本上匹配，因此多块可以协同改同一区域。
 * 任一块失败即停止并整体判失败，调用方保留原文并提示用户（不做自动重试）。
 * @param source 源片段（未作用域化的干净 HTML）
 */
export function applyPatchBlocks(
  source: string,
  blocks: readonly SearchReplaceBlock[],
): ApplyPatchOutcome {
  let text = source.replace(/\r\n/g, '\n');
  let applied = 0;

  for (const block of blocks) {
    const matched = matchBlock(text, block);
    if (!matched.ok) {
      return { ok: false, failures: [matched.failure], applied };
    }
    text =
      text.slice(0, matched.start) + block.replace + text.slice(matched.end);
    applied++;
  }

  return { ok: true, result: text, applied };
}
