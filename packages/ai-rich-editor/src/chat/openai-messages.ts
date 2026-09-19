/**
 * 会话消息 → OpenAI Chat Completions 消息转换（纯函数）
 *
 * 四处协议适配：
 * - system 提示词在 OpenAI 协议里是普通消息，故注入到消息首位（不再是独立字段）
 * - 思考内容不回传：协议无语义，模型也不需要重复自己的推理
 * - 图片附件按需升级为多模态 content parts；其余类型仍靠消息正文里的文本清单
 * - 本包经 useChat 只会传 UIMessage；ModelMessage 分支仅为满足库的联合类型，只取文本
 */
import type { UIMessage } from '@tanstack/ai-react';
import { parseSentAttachments } from '../media/attachment';
import { removeFragmentBlock, removeTargetBlocks } from './prompt-blocks';

/** OpenAI 内容块：Chat Completions 只标准化了文本与图片 */
export type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAiContentPart[];
}

export interface BuildOpenAiMessagesOptions {
  /** system 提示词（包内置模板或宿主自定义） */
  systemPrompt: string;
  /** 图片是否以多模态形式发送；关闭后只保留正文里的文本清单 */
  sendImagesAsMultimodal: boolean;
}

/** ModelMessage 的兜底形态（只声明转换用到的字段） */
interface ModelMessageLike {
  role: 'user' | 'assistant' | 'tool';
  content: string | unknown[] | null;
}

export type ConversableMessage = UIMessage | ModelMessageLike;

/** 可发送的消息：文本 + 图片地址 */
interface NormalizedMessage {
  role: 'user' | 'assistant';
  text: string;
  images: string[];
}

/** 是否为服务端可访问的绝对 http(s) 地址（blob: 与相对路径服务端取不到） */
export function isRemoteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 取消息里可作为图片输入的上传地址（仅图片类型且为绝对 http(s)） */
function imageUrlsOf(message: UIMessage): string[] {
  const urls: string[] = [];
  const attachments = parseSentAttachments(message.metadata?.easyxAttachments);
  for (const attachment of attachments) {
    if (attachment.kind !== 'image') continue;
    if (!isRemoteHttpUrl(attachment.url)) continue;
    urls.push(attachment.url);
  }
  return urls;
}

/** 兼容不同形态的内容块取文本（UIMessage 用 content，其余约定用 text） */
function textOfContentParts(parts: readonly unknown[]): string {
  let text = '';
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const candidate = part as {
      type?: unknown;
      content?: unknown;
      text?: unknown;
    };
    if (candidate.type !== 'text') continue;
    if (typeof candidate.content === 'string') text += candidate.content;
    else if (typeof candidate.text === 'string') text += candidate.text;
  }
  return text;
}

/** 归一到「文本 + 图片」形态；不可发送的角色返回 undefined */
function normalizeMessage(
  message: ConversableMessage,
  sendImagesAsMultimodal: boolean,
  stripContextBlocks: boolean,
): NormalizedMessage | undefined {
  // UIMessage：parts 里取文本，metadata 里取图片附件
  if ('parts' in message) {
    if (message.role === 'system') return undefined;
    let text = '';
    for (const part of message.parts) {
      if (part.type === 'text' && typeof part.content === 'string') {
        text += part.content;
      }
    }
    // 历史轮次去掉上下文块：模型只需最新一份当前内容与目标区域
    if (stripContextBlocks && message.role === 'user') {
      text = removeTargetBlocks(removeFragmentBlock(text));
    }
    return {
      role: message.role,
      text,
      // 只有 user 消息可携带多模态内容块；assistant 消息带 image_url 会被服务端拒绝
      images:
        sendImagesAsMultimodal && message.role === 'user'
          ? imageUrlsOf(message)
          : [],
    };
  }

  // ModelMessage 兜底：只取文本，不做多模态
  if (message.role === 'tool') return undefined;
  const { content } = message;
  let text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? textOfContentParts(content)
        : '';
  if (stripContextBlocks && message.role === 'user') {
    text = removeTargetBlocks(removeFragmentBlock(text));
  }
  return { role: message.role, text, images: [] };
}

/** 最后一条 user 消息的下标（该条保留当前片段块，其余历史轮次剥离） */
function lastUserIndex(messages: readonly ConversableMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return i;
  }
  return -1;
}

/** 组装请求用的 OpenAI 消息序列 */
export function buildOpenAiMessages(
  messages: readonly ConversableMessage[],
  options: BuildOpenAiMessagesOptions,
): OpenAiChatMessage[] {
  const result: OpenAiChatMessage[] = [
    { role: 'system', content: options.systemPrompt },
  ];
  const lastUser = lastUserIndex(messages);

  for (let i = 0; i < messages.length; i++) {
    const normalized = normalizeMessage(
      messages[i],
      options.sendImagesAsMultimodal,
      i !== lastUser,
    );
    if (!normalized) continue;
    const { role, text, images } = normalized;

    if (images.length === 0) {
      if (text.trim()) result.push({ role, content: text });
      continue;
    }

    const parts: OpenAiContentPart[] = [];
    if (text.trim()) parts.push({ type: 'text', text });
    for (const url of images) {
      parts.push({ type: 'image_url', image_url: { url } });
    }
    result.push({ role, content: parts });
  }

  return result;
}
