/**
 * 用户消息的上下文块拼装与分段解析
 *
 * 一条发给模型的消息由「用户原话 + 若干上下文块」组成，块的顺序是：
 * [已上传附件] → [文档内容] → [当前片段] → [目标区域]（+ [选中文本]）。
 * 这些块是给模型的技术输入，界面展示时由 splitPromptBlocks 拆开：
 * 原话仍显示原文，附件清单以缩略条呈现，文档/当前片段/目标区域渲染为可见的代码卡片。
 *
 * 每条新消息都会附带一份最新的当前片段与目标区域；历史轮次的这些块由
 * chat/openai-messages 在构造请求时剥离，避免上下文线性膨胀。
 * [文档内容] 是持久源材料，不参与剥离，体积由解析侧的字符预算控制。
 */
import { ATTACHMENT_BLOCK_TITLE } from '../media/prompt-text';
import { DOCUMENT_BLOCK_TITLE } from '../parsers/prompt-text';
import type { PreviewTarget } from '../utils/blocks';

/** 当前片段起始标记 */
export const CURRENT_FRAGMENT_BLOCK_TITLE = '[当前片段]';

/** 目标区域起始标记（预览区右键定向修改时附带） */
export const TARGET_BLOCK_TITLE = '[目标区域]';

/** 选中文本起始标记 */
export const SELECTION_BLOCK_TITLE = '[选中文本]';

/** 全部块标记（分段解析用，顺序即拼接顺序） */
const BLOCK_TITLES = [
  ATTACHMENT_BLOCK_TITLE,
  DOCUMENT_BLOCK_TITLE,
  CURRENT_FRAGMENT_BLOCK_TITLE,
  TARGET_BLOCK_TITLE,
  SELECTION_BLOCK_TITLE,
] as const;

/** 当前片段块：模型据此产出精确的 SEARCH 文本；空片段不生成块 */
export function buildCurrentFragmentBlock(source: string): string {
  if (!source.trim()) return '';
  return [CURRENT_FRAGMENT_BLOCK_TITLE, '```html', source, '```'].join('\n');
}

/** 目标区域块：预览右键选中后附上，模型只需聚焦这一块 */
export function buildTargetBlock(target: PreviewTarget): string {
  const parts = [TARGET_BLOCK_TITLE, '```html', target.targetHtml, '```'];
  if (target.styles) {
    parts.push(`（当前计算样式）${target.styles}`);
  }
  if (target.selectedText) {
    parts.push(SELECTION_BLOCK_TITLE, target.selectedText);
    if (!target.selectUnique) {
      parts.push('（选中文本在片段中出现多次，请结合目标区域确定唯一位置）');
    }
  }
  return parts.join('\n');
}

/** 文档块的分段形态：header 为围栏前的来源/提示行，body 为围栏内正文 */
export interface ParsedDocumentSection {
  header: string;
  body: string;
}

/** 分段解析结果：各字段为空时表示该块不存在 */
export interface PromptBlockSplit {
  /** 用户原话（去掉所有上下文块） */
  text: string;
  /** 附件清单块原文 */
  attachmentBlock?: string;
  /** 文档内容块（可多个，按顺序） */
  documents: ParsedDocumentSection[];
  /** 当前片段块内的片段内容 */
  fragment?: string;
  /** 目标区域块内的片段内容（多选时按顺序给出多个） */
  targets: string[];
  /** 目标区域附带的选中文本 */
  selectedText?: string;
}

/**
 * 查找块标记，只认「行首」出现（行首 = 串首或被换行紧邻）
 *
 * 包内拼装块时标记总在行首，因此不会漏；而文档正文是任意外部内容，可能包含
 * `[当前片段]` 这类同名文本，按行首匹配可避免把正文误当块边界（历史剥离时误删正文）。
 */
function indexOfTitle(content: string, title: string, from = 0): number {
  let at = content.indexOf(title, from);
  while (at > 0 && content[at - 1] !== '\n') {
    at = content.indexOf(title, at + 1);
  }
  return at;
}

/** 取从 title 起、到下一个块标记为止的片段 */
function sectionOf(content: string, title: string): string | undefined {
  const start = indexOfTitle(content, title);
  if (start < 0) return undefined;
  let end = content.length;
  for (const other of BLOCK_TITLES) {
    if (other === title) continue;
    const at = indexOfTitle(content, other, start + title.length);
    if (at >= 0 && at < end) end = at;
  }
  return content.slice(start, end).trim();
}

/**
 * 收集同名块的全部片段（多选时会重复出现）
 * 每段的边界是「下一个块标记」——同名标记也算，故能被逐个切出。
 */
function collectSections(content: string, title: string): string[] {
  const sections: string[] = [];
  let from = 0;
  for (;;) {
    const start = indexOfTitle(content, title, from);
    if (start < 0) break;
    let end = content.length;
    for (const other of BLOCK_TITLES) {
      const at = indexOfTitle(content, other, start + title.length);
      if (at >= 0 && at < end) end = at;
    }
    sections.push(content.slice(start, end).trim());
    from = start + title.length;
  }
  return sections;
}

/** 取片段内第一个围栏代码块的内容 */
function fencedContent(section: string | undefined): string | undefined {
  if (!section) return undefined;
  const match = /```[^\n]*\n([\s\S]*?)\n?```/.exec(section);
  return match ? match[1] : undefined;
}

/** 文档块分段：header 取围栏前的来源/提示行，body 取围栏内正文 */
function collectDocumentSections(content: string): ParsedDocumentSection[] {
  return collectSections(content, DOCUMENT_BLOCK_TITLE)
    .map((section) => {
      const fenceAt = section.indexOf('```');
      const headRaw = fenceAt >= 0 ? section.slice(0, fenceAt) : section;
      return {
        header: headRaw.slice(DOCUMENT_BLOCK_TITLE.length).trim(),
        body: fencedContent(section) ?? '',
      };
    })
    .filter((section) => section.header || section.body);
}

/**
 * 移除指定标题的整段块（同名块会被逐段移除），保留其余内容
 *
 * 构造请求时对历史轮次调用：块里携带的片段/元素原文与样式摘要只对最新一轮有意义，
 * 留在历史里会让请求体随对话线性膨胀。
 */
function removeSections(content: string, titles: readonly string[]): string {
  let result = content;
  for (const title of titles) {
    for (;;) {
      const at = indexOfTitle(result, title);
      if (at < 0) break;
      let end = result.length;
      for (const other of BLOCK_TITLES) {
        const next = indexOfTitle(result, other, at + title.length);
        if (next >= 0 && next < end) end = next;
      }
      result = (result.slice(0, at) + result.slice(end)).trimEnd();
    }
  }
  return result;
}

/** 移除「当前片段」块 */
export function removeFragmentBlock(content: string): string {
  return removeSections(content, [CURRENT_FRAGMENT_BLOCK_TITLE]);
}

/** 移除「目标区域」与「选中文本」块（多选时会有多个目标区域） */
export function removeTargetBlocks(content: string): string {
  return removeSections(content, [TARGET_BLOCK_TITLE, SELECTION_BLOCK_TITLE]);
}

/** 取块标题之后、下一个块标记之前的原始文本 */
function rawContent(
  section: string | undefined,
  title: string,
): string | undefined {
  if (!section) return undefined;
  const body = section.slice(title.length).trim();
  return body || undefined;
}

/**
 * 把一条用户消息拆成「原话 + 各上下文块」
 *
 * 以最早出现的块标记切分原话；各块内部再按标题截取。标记只认行首出现
 * （见 indexOfTitle），因此文档正文里的同名字面量不会被误判为块边界。
 */
export function splitPromptBlocks(content: string): PromptBlockSplit {
  let cut = content.length;
  for (const title of BLOCK_TITLES) {
    const at = indexOfTitle(content, title);
    if (at >= 0 && at < cut) cut = at;
  }

  const text = content.slice(0, cut).trimEnd();
  const rest = content.slice(cut);
  const attachmentSection = sectionOf(rest, ATTACHMENT_BLOCK_TITLE);
  const fragmentSection = sectionOf(rest, CURRENT_FRAGMENT_BLOCK_TITLE);
  const selectionSections = collectSections(rest, SELECTION_BLOCK_TITLE);

  return {
    text,
    attachmentBlock: attachmentSection,
    documents: collectDocumentSections(rest),
    fragment: fencedContent(fragmentSection),
    targets: collectSections(rest, TARGET_BLOCK_TITLE)
      .map((section) => fencedContent(section))
      .filter((html): html is string => Boolean(html)),
    selectedText: rawContent(selectionSections[0], SELECTION_BLOCK_TITLE),
  };
}
