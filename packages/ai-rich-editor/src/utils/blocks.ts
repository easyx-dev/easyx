/**
 * 预览区「右键定向修改」的纯逻辑：元素扫描、预览标记注入、目标回解
 *
 * 预览 iframe 是受信产物，父页可直接读取其 DOM。为了让右键命中的元素能映射回
 * 源片段的确切文本，预览文档在生成时给**每个元素**打上 data-easyx-id 编号；
 * 编号与 scanElements 的文档序一一对应，命中编号即可取出源片段子串。
 *
 * 命中粒度是「右键所在的最内层元素」；若该元素原文在片段中出现多次（无法作为
 * 唯一 SEARCH），则沿父链向上扩张，直到唯一或到达顶层。标记只存在于预览文档，
 * 不写进 value / onChange 产物。
 */
import { buildPreviewDocument } from './extract';
import { scopeCssOfHtml } from './scope';

/** 预览文档中标记元素的属性名 */
export const PREVIEW_NODE_ATTR = 'data-easyx-id';

/** 扫描出的元素（文档序编号 + 源片段区间 + 父级） */
export interface ScannedElement {
  id: number;
  tagName: string;
  /** 开始标签 `<` 的位置 */
  start: number;
  /** 元素结束（闭合标签之后）的位置 */
  end: number;
  parentId: number | null;
}

/** 空元素：没有闭合标签 */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** 原始文本元素：内部内容不按标签解析 */
const RAW_TEXT_TAGS = new Set(['style', 'script', 'textarea', 'title']);

/** 解析 `i` 处的标签，返回标签名、是否闭合标签、是否自闭合、以及 `>` 之后的位置 */
function parseTag(
  html: string,
  i: number,
): {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  end: number;
} | null {
  const head = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(i));
  if (!head) return null;
  let j = i + head[0].length;
  let quote = '';
  while (j < html.length) {
    const ch = html[j];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      break;
    }
    j++;
  }
  const end = j < html.length ? j + 1 : html.length;
  return {
    name: head[2].toLowerCase(),
    closing: head[1] === '/',
    selfClosing: html[j - 1] === '/',
    end,
  };
}

/** 原始文本元素的闭合位置：直接找 `</name` 后的 `>` */
function findRawTextClose(html: string, name: string, from: number): number {
  const lower = html.toLowerCase();
  const at = lower.indexOf(`</${name}`, from);
  if (at < 0) return html.length;
  const gt = html.indexOf('>', at);
  return gt < 0 ? html.length : gt + 1;
}

/** 从栈顶向下找最近一个同名元素的下标 */
function findLastByName(
  stack: readonly ScannedElement[],
  name: string,
): number {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].tagName === name) return i;
  }
  return -1;
}

/**
 * 扫描源片段中的全部元素（文档序，含嵌套）
 *
 * 单遍扫描：跳注释/声明、原始文本元素与 void 元素，栈式跟踪嵌套与配对闭合；
 * 未闭合的元素收尾到文本末尾。返回的对象即编号依据，也用于切出元素原文。
 */
export function scanElements(source: string): ScannedElement[] {
  const elements: ScannedElement[] = [];
  const stack: ScannedElement[] = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    const lt = source.indexOf('<', i);
    if (lt < 0) break;
    i = lt;

    if (source.startsWith('<!--', i)) {
      const close = source.indexOf('-->', i + 4);
      i = close < 0 ? n : close + 3;
      continue;
    }
    if (source.startsWith('<!', i) || source.startsWith('<?', i)) {
      const gt = source.indexOf('>', i);
      i = gt < 0 ? n : gt + 1;
      continue;
    }

    const tag = parseTag(source, i);
    if (!tag) {
      i += 1;
      continue;
    }

    if (tag.closing) {
      const index = findLastByName(stack, tag.name);
      if (index >= 0) {
        // 闭合命中元素及其之上所有未闭合元素
        for (let k = stack.length - 1; k >= index; k--) stack[k].end = tag.end;
        stack.length = index;
      }
      i = tag.end;
      continue;
    }

    const element: ScannedElement = {
      id: elements.length,
      tagName: tag.name,
      start: i,
      end: tag.end,
      parentId: stack.length > 0 ? stack[stack.length - 1].id : null,
    };
    elements.push(element);

    if (tag.selfClosing || VOID_TAGS.has(tag.name)) {
      // 区间已确定为开标签自身
    } else if (RAW_TEXT_TAGS.has(tag.name)) {
      element.end = findRawTextClose(source, tag.name, tag.end);
    } else {
      stack.push(element);
    }
    i = element.end;
  }

  // 未闭合元素收尾到文本末尾
  for (const element of stack) element.end = n;
  return elements;
}

/** 给每个元素的开标签插入预览标记 */
export function tagElements(source: string): string {
  const elements = [...scanElements(source)].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const element of elements) {
    // `<` + 标签名 之后即插入点（标签名大小写不影响长度）
    const at = element.start + 1 + element.tagName.length;
    out += source.slice(cursor, at);
    out += ` ${PREVIEW_NODE_ATTR}="${element.id}"`;
    cursor = at;
  }
  return out + source.slice(cursor);
}

/** 预览中悬停元素的提示样式（只存在于预览文档，不进入 value/产物） */
const PREVIEW_HOVER_STYLE = `<style>[${PREVIEW_NODE_ATTR}]:hover{outline:2px solid rgba(64,138,255,.75);outline-offset:2px}</style>`;

/** 构建可交互预览文档：作用域化 + 元素编号，供右键定位 */
export function buildInteractivePreviewDocument(
  source: string,
  prefix: string,
  previewHead?: string,
): string {
  const wrapped = `<div class="${prefix}">${scopeCssOfHtml(
    tagElements(source),
    prefix,
  )}</div>`;
  const head = `${PREVIEW_HOVER_STYLE}${previewHead?.trim() ? previewHead : ''}`;
  return buildPreviewDocument(wrapped, head);
}

/** 统计子串在文本中出现的次数（非重叠） */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count++;
    from = at + needle.length;
  }
  return count;
}

/** 预览右键解析出的编辑目标 */
export interface PreviewTarget {
  /** 命中的元素编号 */
  elementId: number;
  /** 用于补丁/聚焦的源片段（命中元素或其最近唯一祖先） */
  targetHtml: string;
  /** 选中的文本（无选区时缺省） */
  selectedText?: string;
  /** 选中文本在源片段中是否唯一命中（唯一才适合作为精确补丁目标） */
  selectUnique: boolean;
  /** 关键计算样式摘要（由 DOM 层读取后附加，见 utils/computed-style） */
  styles?: string;
}

/**
 * 由预览元素编号（与可选选区文本）回解源片段目标
 *
 * 命中元素原文在片段中唯一时直接用它；否则沿父链向上扩张到唯一祖先（最多到顶层），
 * 保证 `[目标区域]` 能作为精确 SEARCH。
 * @param source 源片段（未作用域化）
 * @param elementId 预览标记的元素编号
 * @param selectedText 预览中的选中文本
 */
export function resolvePreviewTarget(
  source: string,
  elementId: number,
  selectedText?: string,
): PreviewTarget | null {
  const elements = scanElements(source);
  const hit = elements.find((element) => element.id === elementId);
  if (!hit) return null;

  let current = hit;
  let targetHtml = source.slice(current.start, current.end);
  while (
    countOccurrences(source, targetHtml) !== 1 &&
    current.parentId !== null
  ) {
    const parent = elements.find((element) => element.id === current.parentId);
    if (!parent) break;
    current = parent;
    targetHtml = source.slice(current.start, current.end);
  }

  const selected = selectedText?.trim() ?? '';
  return {
    elementId,
    targetHtml,
    selectedText: selected || undefined,
    selectUnique: selected ? countOccurrences(source, selected) === 1 : false,
  };
}
