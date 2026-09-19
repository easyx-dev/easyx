/**
 * 附件清单文本块
 *
 * 模型需要看到上传后的真实地址，而地址是客户端在发送那一刻才拿到的，因此把已上传
 * 附件拼成固定格式的文本块附在用户消息末尾；界面展示时由 chat/prompt-blocks 的
 * splitPromptBlocks 还原用户原话（附件缩略图另经消息 metadata 渲染）。
 */
import { mediaKindLabel } from './routing';
import type { SentAttachment } from './types';

/** 清单起始标记；同时用于剥离，改动需同步测试 */
export const ATTACHMENT_BLOCK_TITLE = '[已上传附件]';

/** 拼装附件清单文本块；无附件返回空串 */
export function buildAttachmentBlock(items: readonly SentAttachment[]): string {
  if (items.length === 0) return '';
  const lines = items.map(
    (item, index) =>
      `${index + 1}. ${mediaKindLabel(item.kind)}：${item.name} → ${item.url}`,
  );
  return [ATTACHMENT_BLOCK_TITLE, ...lines].join('\n');
}
