/**
 * 链接地址白名单
 *
 * 代码面板手工粘贴的地址、AI 回复里的链接同属不可信来源，共用同一份判定；
 * 而宿主 upload / getList 返回的地址属可信来源，不在这里校验（见 media/snippet.ts 的 trusted）。
 *
 * 默认放行 http / https / mailto / tel / blob 与相对形式，拦截 javascript: / data: 等危险协议。
 * blob: 放行的理由：它只能由同源脚本用 URL.createObjectURL 现场铸造（无法像 data: 那样
 * 从字符串直接构造），因此不提供超出页面既有能力的注入面，而纯客户端上传依赖它。
 */

/** 默认允许的协议（顺序即错误提示中的展示顺序） */
export const DEFAULT_URL_SCHEMES: readonly string[] = [
  'http:',
  'https:',
  'mailto:',
  'tel:',
  'blob:',
];

/**
 * 永远拒绝的协议
 *
 * 与白名单是两套机制：白名单决定「默认放行什么」，本清单决定「任何情况下都不放行什么」。
 * 宿主追加白名单也无法放行它们——「加白名单就能用」对这些协议不存在合法场景。
 */
const DANGEROUS_SCHEMES: readonly string[] = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'jar:',
  'about:',
  'view-source:',
];

const DEFAULT_SCHEME_SET = new Set<string>(DEFAULT_URL_SCHEMES);
const DANGEROUS_SCHEME_SET = new Set<string>(DANGEROUS_SCHEMES);

/** 相对形式：根路径、锚点、相对路径 */
const RELATIVE_PREFIXES = ['/', '#', './', '../'];

/** 形如 scheme: 的开头；用于识别协议 */
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*:)/i;

/**
 * 归一化宿主追加的协议：补冒号、去重，并剔除默认项与危险协议
 * 只做追加，不提供任何移除默认协议或放行危险协议的途径
 */
export function normalizeUrlSchemes(
  extra?: readonly string[],
): readonly string[] {
  if (!extra?.length) return [];
  const result: string[] = [];
  for (const raw of extra) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    const scheme = value.endsWith(':') ? value : `${value}:`;
    if (!SCHEME_PATTERN.test(scheme)) continue;
    // 默认项无需重复；危险协议永远不放行
    if (DEFAULT_SCHEME_SET.has(scheme) || DANGEROUS_SCHEME_SET.has(scheme)) {
      continue;
    }
    if (result.includes(scheme)) continue;
    result.push(scheme);
  }
  return result;
}

export interface SanitizeUrlOptions {
  /** 宿主追加允许的协议（不覆盖默认项，也不能放行危险协议） */
  extraSchemes?: readonly string[];
}

/** 当前生效的协议清单（默认 + 追加），供校验与错误提示共用 */
export function listAllowedSchemes(
  options?: SanitizeUrlOptions,
): readonly string[] {
  return [
    ...DEFAULT_URL_SCHEMES,
    ...normalizeUrlSchemes(options?.extraSchemes),
  ];
}

/**
 * 过滤非白名单协议的地址；不安全时返回 undefined
 * 放行：相对形式、以及清单内的协议（危险协议即使被写进清单也一律拒绝）
 */
export function sanitizeUrl(
  url: string | null | undefined,
  options?: SanitizeUrlOptions,
): string | undefined {
  if (!url) return undefined;
  const value = url.trim();
  if (!value) return undefined;
  if (RELATIVE_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return value;
  }
  const scheme = SCHEME_PATTERN.exec(value)?.[1]?.toLowerCase();
  if (!scheme) return undefined;
  if (DANGEROUS_SCHEME_SET.has(scheme)) return undefined;
  return listAllowedSchemes(options).includes(scheme) ? value : undefined;
}
