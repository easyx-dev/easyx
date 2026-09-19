/**
 * 纯函数：从 AI 回复中提取 HTML 代码块 + 构建预览文档外壳
 * 与协议层同属开放工具，任意宿主可复用
 */
import { hasPatchMarker } from './patch-markers';

/** 去除相邻重复的片段（同一回复中多次出现同一代码块时去重） */
function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

/**
 * 从 AI 回复文本中提取 HTML 代码块
 * 逐段扫描围栏代码块：识别 ```html 围栏，以及无语言标识但整体像 HTML 的围栏；
 * 含补丁起始标记的代码块一律排除（`<<<<<<< SEARCH` 不是 HTML 片段）。
 * 无任何围栏但整体以 < 开头时，将整体作为片段兜底。
 */
export function extractHtmlFragments(content: string): string[] {
  const fenceRegex = /```([^\n`]*)\n([\s\S]*?)```/g;
  const fragments: string[] = [];
  for (const match of content.matchAll(fenceRegex)) {
    const lang = match[1].trim().toLowerCase();
    const body = match[2].trim();
    if (!body || hasPatchMarker(body)) continue;
    if (lang.startsWith('html') || (lang === '' && body.startsWith('<'))) {
      fragments.push(body);
    }
  }
  if (fragments.length > 0) return dedupe(fragments);

  // 兜底：无代码块标记但整体像是 HTML（补丁块以 < 开头，需排除）
  const trimmed = content.trim();
  if (trimmed.startsWith('<') && !hasPatchMarker(trimmed)) return [trimmed];
  return [];
}

/**
 * 取 AI 回复中「最后一个」HTML 代码块（最终产物通常位于末尾；
 * 修改类回复可能先贴旧/分块内容、再给出改动后的完整片段）。
 * 自动应用到编辑器时用它，避免取到旧内容或不完整片段。
 */
export function lastHtmlFragment(content: string): string | undefined {
  const fragments = extractHtmlFragments(content);
  return fragments[fragments.length - 1];
}

/**
 * 构建 iframe 预览文档：包一层最小文档外壳（补充 charset/viewport）
 * previewHead 为可选注入的原始 HTML 片段（如内置 <style>/<script>），原样插入 <head>
 */
export function buildPreviewDocument(
  html: string,
  previewHead?: string,
): string {
  const headInjection = previewHead?.trim() ? previewHead : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${headInjection}</head><body>${html}</body></html>`;
}
