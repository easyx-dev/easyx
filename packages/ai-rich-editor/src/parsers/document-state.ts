/**
 * 对话文档的运行时模型与文件分流
 *
 * 与媒体附件不同：文档不经上传，只在本地/服务端解析成内容，随消息作为 `[文档内容]`
 * 交给模型。解析在「添加时」即开始，因此这里持有解析态供界面展示。
 */
import { UnsupportedDocumentError } from './errors';
import {
  DEFAULT_DOCUMENT_EXTENSIONS,
  isDocumentFile,
  isLegacyDoc,
  resolveDocumentKind,
} from './routing';
import type { AiRichParsedDocument } from './types';

/** 待解析/已解析的对话文档 */
export interface PendingDocument {
  id: string;
  name: string;
  size: number;
  /** 原始文件：解析失败时可重试 */
  file: File;
  status: 'parsing' | 'ready' | 'error';
  /** 解析结果（status 为 ready 时存在） */
  result?: AiRichParsedDocument;
  /** 失败信息（status 为 error 时存在） */
  error?: string;
}

/** 文档 id 自增序号：与媒体附件一致，不使用 crypto，保证测试与旧环境一致 */
let documentSeq = 0;

/** 由本地文件创建待解析文档 */
export function createPendingDocument(file: File): PendingDocument {
  documentSeq += 1;
  return {
    id: `document-${documentSeq}`,
    name: file.name,
    size: file.size,
    file,
    status: 'parsing',
  };
}

/**
 * 归一化解析产物：补全 name/kind，收敛 warnings
 *
 * 宿主实现可能只给出正文（远程解析尤其如此），来源信息在这里按文件补齐。
 */
export function normalizeParsedDocument(
  raw: AiRichParsedDocument | undefined,
  file: File,
): AiRichParsedDocument {
  const warnings = Array.isArray(raw?.warnings)
    ? raw.warnings.filter((item) => typeof item === 'string' && item.trim())
    : [];
  return {
    name: raw?.name?.trim() || file.name,
    kind:
      raw?.kind ??
      resolveDocumentKind(file.name) ??
      (raw?.html ? 'docx' : 'pdf'),
    html: raw?.html,
    text: raw?.text,
    pageCount: raw?.pageCount,
    warnings,
  };
}

/** 文件分流结果：文档走解析，其余仍走媒体上传 */
export interface DocumentFileSplit {
  documents: File[];
  media: File[];
  errors: Error[];
}

export interface SplitDocumentFilesOptions {
  /** 是否启用文档解析；false 时全部落回媒体链路 */
  enabled: boolean;
  /** 可解析扩展名 */
  extensions?: readonly string[];
  /**
   * 旧版 `.doc` 是否落回媒体上传（宿主配了附件上传时为 true）
   *
   * `.doc` 无法解析，但此前就是走媒体附件链路的；开启解析不该把它变成不可用，
   * 因此有附件上传能力时优先按附件处理，没有才报「不支持解析」。
   */
  legacyAsMedia?: boolean;
}

/**
 * 按文档扩展名分流本地文件
 *
 * 未启用解析能力时全部落回媒体链路（保持原有行为）；启用后 `.doc` 旧格式在有附件
 * 上传能力时仍走媒体，否则给出明确错误；其余未知文件仍交给媒体上传。
 */
export function splitDocumentFiles(
  files: readonly File[],
  options: SplitDocumentFilesOptions,
): DocumentFileSplit {
  const {
    enabled,
    extensions = DEFAULT_DOCUMENT_EXTENSIONS,
    legacyAsMedia = false,
  } = options;
  const documents: File[] = [];
  const media: File[] = [];
  const errors: Error[] = [];

  for (const file of files) {
    if (!enabled) {
      media.push(file);
      continue;
    }
    if (isLegacyDoc(file.name) && !legacyAsMedia) {
      errors.push(new UnsupportedDocumentError(file.name));
      continue;
    }
    if (isDocumentFile(file.name, extensions)) {
      documents.push(file);
      continue;
    }
    media.push(file);
  }

  return { documents, media, errors };
}
