/**
 * 媒体片段生成
 *
 * 产物等价于「另一种形态的富文本」的最小媒体单元：语义标签 + 内联样式，
 * 不依赖宿主全局样式，可直接嵌入内容字段（与包内片段的既有约定一致）。
 *
 * 地址校验的信任边界：
 * - 用户手输与 AI 回复里的地址由各自的入口先校验（MediaPicker / markdown renderer）；
 * - 宿主 upload / getList 返回的地址属可信来源，调用方传 trusted 跳过校验。
 * 默认（不传 trusted）仍走白名单，保证对外是安全 API。
 */
import type { SanitizeUrlOptions } from '../utils/url';
import { sanitizeUrl } from '../utils/url';
import { formatBytes } from './routing';
import type { AiRichMediaKind } from './types';

export interface MediaSnippetInput {
  kind: AiRichMediaKind;
  url: string;
  /** 文件名 / 替代文本 */
  name?: string;
  size?: number;
}

export interface MediaSnippetOptions extends SanitizeUrlOptions {
  /** 地址来自宿主接口（可信来源），跳过协议白名单 */
  trusted?: boolean;
}

/** 属性值转义：文件名可能含引号与尖括号，直接拼接会截断标签 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 文本内容转义 */
function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 生成自包含媒体片段；返回 undefined 表示地址未通过协议白名单
 * （trusted 为 true 时不校验，永远返回片段）
 */
export function buildMediaSnippet(
  input: MediaSnippetInput,
  options?: MediaSnippetOptions,
): string | undefined {
  const url = options?.trusted
    ? input.url.trim()
    : sanitizeUrl(input.url, options);
  if (!url) return undefined;

  const name = input.name?.trim() ?? '';
  const attr = escapeAttribute(url);
  const title = name ? ` title="${escapeAttribute(name)}"` : '';

  switch (input.kind) {
    case 'image':
      return `<img src="${attr}" alt="${escapeAttribute(name)}" style="max-width:100%;height:auto;">`;
    case 'video':
      return `<video src="${attr}"${title} controls playsinline style="max-width:100%;"></video>`;
    case 'audio':
      return `<audio src="${attr}"${title} controls></audio>`;
    case 'attachment': {
      const label = name || '附件';
      const size = input.size != null ? `（${formatBytes(input.size)}）` : '';
      const download = name
        ? ` download="${escapeAttribute(name)}"`
        : ' download';
      return `<a href="${attr}"${download}>${escapeText(label)}${size}</a>`;
    }
  }
}
