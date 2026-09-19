/**
 * 对话连接适配器：把「接入点」统一翻译成 TanStack 的 StreamChunk
 *
 * 接入点两种形态（见 chat/protocol.ts）：
 * - 字符串：已鉴权的 OpenAI Chat Completions 端点，走内置流式请求（模型由端点侧决定）
 * - 函数：调用方自定义适配器（server function / 自包协议），包内只消费其增量
 *
 * 接入点是每实例动态值，经 ref 在每次请求时读取，因此宿主更换后无需重挂载。
 */
import type { ConnectConnectionAdapter } from '@tanstack/ai-react';
import { buildChatMessages } from './chat-messages';
import { requestOpenAiStream } from './openai-fetch';
import type {
  AiRichChatChunk,
  AiRichChatRequest,
  AiRichChatSource,
} from './protocol';

/**
 * 每次发送经 `sendMessage(..., { body })` 传入的保留字段。
 * 其余内容（附件地址、当前片段等）已在消息正文里，无需再透传。
 */
export interface ChatSendOptions {
  /** system 提示词（包内置模板或宿主自定义） */
  systemPrompt?: string;
  /** 图片是否以多模态形式发送 */
  sendImagesAsMultimodal?: boolean;
}

export interface ChatConnectionRefs {
  /** 接入点：已鉴权的 OpenAI 端点 URL，或自定义适配器函数 */
  source: { current: AiRichChatSource };
}

/** 库未直接导出 StreamChunk，从连接签名里取出分片类型 */
type ConnectionStreamChunk =
  ReturnType<ConnectConnectionAdapter['connect']> extends AsyncIterable<infer T>
    ? T
    : never;

/**
 * 构造内部分片
 *
 * 该联合用的是 @ag-ui/core 的字符串枚举，而 TS 枚举成员不接受等值字符串字面量；
 * 协议值与枚举一致，故在此集中做一次断言，其余逻辑保持类型检查。
 */
function toStreamChunk(value: object): ConnectionStreamChunk {
  return value as ConnectionStreamChunk;
}

/** 生成本轮 assistant 消息 id（协议要求同一轮内消息 id 唯一） */
function createMessageId(): string {
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 按接入点形态取得本轮协议增量流 */
function streamChunks(
  source: AiRichChatSource,
  request: AiRichChatRequest,
  signal: AbortSignal,
): AsyncIterable<AiRichChatChunk> {
  if (typeof source === 'string') {
    return requestOpenAiStream(source, request.messages, signal);
  }
  return source(request, signal);
}

/** 构建对话连接适配器 */
export function createChatConnection(
  refs: ChatConnectionRefs,
): ConnectConnectionAdapter {
  return {
    async *connect(messages, data, abortSignal) {
      const { systemPrompt = '', sendImagesAsMultimodal = true } = (data ??
        {}) as ChatSendOptions;

      const request: AiRichChatRequest = {
        messages: buildChatMessages(messages, {
          systemPrompt,
          sendImagesAsMultimodal,
        }),
      };
      // 适配器协议要求必传 signal；上层未提供时给一个永不中断的信号
      const signal = abortSignal ?? new AbortController().signal;

      let textMessageId: string | undefined;
      let reasoningMessageId: string | undefined;

      try {
        for await (const chunk of streamChunks(
          refs.source.current,
          request,
          signal,
        )) {
          if (signal.aborted) return;
          if (chunk.reasoning) {
            if (!reasoningMessageId) reasoningMessageId = createMessageId();
            yield toStreamChunk({
              type: 'REASONING_MESSAGE_CONTENT',
              messageId: reasoningMessageId,
              delta: chunk.reasoning,
              timestamp: Date.now(),
            });
          }
          if (chunk.content) {
            if (!textMessageId) {
              textMessageId = createMessageId();
              yield toStreamChunk({
                type: 'TEXT_MESSAGE_START',
                messageId: textMessageId,
                role: 'assistant',
                timestamp: Date.now(),
              });
            }
            yield toStreamChunk({
              type: 'TEXT_MESSAGE_CONTENT',
              messageId: textMessageId,
              delta: chunk.content,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        // 适配器在 abort 时抛出的异常视为正常停止（部分实现直接冒泡 AbortError）
        if (signal.aborted) return;
        throw error;
      }

      // 用户主动中止：不补结束事件，也不视为流被截断
      if (signal.aborted) return;
      if (textMessageId) {
        yield toStreamChunk({
          type: 'TEXT_MESSAGE_END',
          messageId: textMessageId,
          timestamp: Date.now(),
        });
      }
    },
  };
}
