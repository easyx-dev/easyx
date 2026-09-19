/**
 * 对话附件的运行时模型
 *
 * 附件在输入框里先以「待上传」形态存在（持有 File），点发送时才上传；
 * 从媒体库选中的条目已带地址，无需再上传。
 */

import { MediaNotConfiguredError } from './errors';
import { MEDIA_KINDS, resolveMediaKind } from './routing';
import type {
  MediaConfig,
  MediaItem,
  MediaKind,
  SentAttachment,
} from './types';
import { canUpload } from './upload';

export interface PendingAttachment {
  id: string;
  kind: MediaKind;
  name: string;
  size?: number;
  /** 本地待上传文件（媒体库选择的条目没有） */
  file?: File;
  /** 已具备的地址（媒体库选择，或上传完成后） */
  url?: string;
  /** 上传进度 0~1 */
  progress: number;
}

/** 附件 id 自增序号：不使用 crypto，保证测试与旧环境一致 */
let attachmentSeq = 0;

/** 由本地文件创建待上传附件 */
export function createFileAttachment(file: File): PendingAttachment {
  attachmentSeq += 1;
  return {
    id: `attachment-${attachmentSeq}`,
    kind: resolveMediaKind(file.type),
    name: file.name,
    size: file.size,
    file,
    progress: 0,
  };
}

/** 由媒体库条目创建待上传附件（已有地址，不再上传） */
export function createLibraryAttachment(
  item: MediaItem,
  kind: MediaKind,
): PendingAttachment {
  attachmentSeq += 1;
  return {
    id: `attachment-${attachmentSeq}`,
    kind,
    name: item.name,
    size: item.size,
    url: item.url,
    progress: 1,
  };
}

/** 待上传附件 → 发送给模型的清单项；地址缺失时返回 undefined */
export function toSentAttachment(
  attachment: PendingAttachment,
): SentAttachment | undefined {
  if (!attachment.url) return undefined;
  return {
    kind: attachment.kind,
    name: attachment.name,
    url: attachment.url,
    size: attachment.size,
  };
}

/**
 * 解析消息 metadata 里的已上传附件
 *
 * 该数据随消息对象流转（可能经服务端或宿主持久化往返），因此逐项校验后再使用，
 * 尤其是 `kind` —— 它决定气泡里的图标，未知值会让渲染直接崩掉。
 */
export function parseSentAttachments(raw: unknown): SentAttachment[] {
  if (!Array.isArray(raw)) return [];
  const result: SentAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<SentAttachment>;
    if (typeof candidate.url !== 'string' || !candidate.url) continue;
    if (typeof candidate.name !== 'string') continue;
    if (!MEDIA_KINDS.includes(candidate.kind as MediaKind)) continue;
    result.push({
      kind: candidate.kind as MediaKind,
      name: candidate.name,
      size: typeof candidate.size === 'number' ? candidate.size : undefined,
      url: candidate.url,
    });
  }
  return result;
}

/** 附件加入计划的判定结果 */
export interface AttachmentAdmission {
  /** 可以加入的附件 */
  accepted: PendingAttachment[];
  /** 需要上报的错误（对应类型未配置上传接口） */
  errors: Error[];
  /** 需要提醒的提示（超出数量上限） */
  warnings: string[];
}

/**
 * 计划加入本地文件：按上传能力与数量上限筛选
 *
 * 「未配置对应类型的上传接口」在添加时即报错，而不是等发送才失败；
 * 判定做成纯函数，便于覆盖各种组合。错误以实例形式抛出（而非文案），
 * 使宿主能在 onError 里按类分支。
 */
export function planFileAttachments(
  files: readonly File[],
  media: MediaConfig | undefined,
  current: readonly PendingAttachment[],
  limit: number,
): AttachmentAdmission {
  const errors: Error[] = [];
  const warnings: string[] = [];
  const candidates: PendingAttachment[] = [];

  for (const file of files) {
    const attachment = createFileAttachment(file);
    if (!canUpload(media, attachment.kind)) {
      errors.push(new MediaNotConfiguredError(attachment.kind));
      continue;
    }
    candidates.push(attachment);
  }

  const room = Math.max(0, limit - current.length);
  if (candidates.length > room) {
    warnings.push(`一次最多添加 ${limit} 个附件`);
  }
  return { accepted: candidates.slice(0, room), errors, warnings };
}
