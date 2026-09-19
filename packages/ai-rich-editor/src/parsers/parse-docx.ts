/**
 * Word（.docx）→ 语义化 HTML
 *
 * 用 mammoth 的浏览器预构建包转换，再做一轮收敛：
 * - 图片一律替换为 `[图片]` 占位：默认实现会内联 base64 数据，几 MB 的图会把
 *   上下文与消息体撑爆，而 AI 只需知道「此处有图」；
 * - 丢弃 script / style / iframe 等不可信或会污染片段结构的节点。
 *
 * 转换结果只作为喂模型的文本上下文，不经 dangerouslySetInnerHTML 落地。
 */
import { DocumentParseError, UnsupportedDocumentError } from './errors';
import { resolveDocumentKind } from './routing';
import type { AiRichParsedDocument } from './types';

/** 图片类节点：统一替换为占位文本，避免 base64 撑爆上下文 */
const IMAGE_SELECTOR = 'img, picture';

/** 需要剔除的节点：不可信或会污染片段结构 */
const DROPPED_SELECTOR = 'script, style, iframe, object, embed, svg';

/** mammoth 转换结果里我们实际用到的部分 */
interface MammothBrowser {
  convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: Record<string, unknown>,
  ): Promise<{ value: string }>;
  images: {
    imgElement(convert: () => { src: string }): unknown;
  };
}

/** 把图片与不可信节点从产物中剔除，保留语义结构 */
export function sanitizeDocumentHtml(html: string): string {
  // 非浏览器环境（如纯逻辑测试）没有 DOMParser，原样返回
  if (typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(
    `<div data-easyx-root>${html}</div>`,
    'text/html',
  );
  const root = doc.querySelector('[data-easyx-root]');
  if (!root) return html;

  for (const image of Array.from(root.querySelectorAll(IMAGE_SELECTOR))) {
    image.replaceWith(doc.createTextNode('[图片]'));
  }
  for (const node of Array.from(root.querySelectorAll(DROPPED_SELECTOR))) {
    node.remove();
  }
  // mammoth 会在表格等处输出注释，保留无益，直接清掉
  const walker = doc.createTreeWalker(root, 128); // NodeFilter.SHOW_COMMENT
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  for (const comment of comments) comment.remove();

  return root.innerHTML.trim();
}

/** 解析 .docx：返回结构化 HTML */
export async function parseDocx(file: File): Promise<AiRichParsedDocument> {
  if (resolveDocumentKind(file.name) !== 'docx') {
    throw new UnsupportedDocumentError(file.name);
  }

  let mammoth: MammothBrowser;
  try {
    const mod = await import('mammoth/mammoth.browser.min.js');
    mammoth = mod.default as unknown as MammothBrowser;
  } catch (error) {
    throw new DocumentParseError(file.name, error);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        // 不让图片进产物（含 base64），后续 sanitize 统一替换为占位
        convertImage: mammoth.images.imgElement(() => ({ src: '' })),
      },
    );
    return {
      name: file.name,
      kind: 'docx',
      html: sanitizeDocumentHtml(result.value),
    };
  } catch (error) {
    throw new DocumentParseError(file.name, error);
  }
}
