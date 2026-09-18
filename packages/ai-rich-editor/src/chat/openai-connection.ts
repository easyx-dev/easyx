/**
 * OpenAI Chat Completions 连接适配器
 *
 * 对外协议即标准 OpenAI 流式接口（宿主可指向任意兼容端点，无需服务端 SDK）；
 * 对内把增量翻译成 TanStack 的 StreamChunk，使消息状态与渲染层完全不变。
 *
 * 端点 / 模型 / 请求头是每实例动态值，经 ref 在每次请求时读取，
 * 因此宿主更换连接后无需重挂载，下一句话即生效。
 */
import type { ConnectConnectionAdapter } from '@tanstack/ai-react';
import type { AiRichRequestHeaders } from '../types';
import { buildOpenAiMessages } from './openai-messages';
import {
  parseOpenAiChunk,
  readHttpErrorMessage,
  readSseDataLines,
} from './openai-sse';

/**
 * 每次发送经 `sendMessage(..., { body })` 传入的保留字段。
 * 其余字段原样合并进 OpenAI 请求体（如 temperature / provider 路由参数）。
 */
export interface OpenAiSendOptions {
  /** system 提示词（包内置模板或宿主自定义） */
  systemPrompt?: string;
  /** 图片是否以多模态形式发送 */
  sendImagesAsMultimodal?: boolean;
}

export interface OpenAiConnectionRefs {
  /** 完整对话端点（OpenAI 兼容，如 `https://…/v1/chat/completions`） */
  endpointUrl: { current: string };
  /** 模型名 */
  model: { current: string };
  /** 请求头（静态对象或每次求值的函数） */
  requestHeaders: { current: AiRichRequestHeaders | undefined };
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

/** 解析本次请求的请求头 */
function resolveHeaders(
  headers: AiRichRequestHeaders | undefined,
): Record<string, string> {
  if (!headers) return {};
  return typeof headers === 'function' ? headers() : headers;
}

/** 生成本轮 assistant 消息 id（协议要求同一轮内消息 id 唯一） */
function createMessageId(): string {
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 构建 OpenAI 流式连接适配器 */
export function createOpenAiConnection(
  refs: OpenAiConnectionRefs,
): ConnectConnectionAdapter {
  return {
    async *connect(messages, data, abortSignal) {
      const {
        systemPrompt = '',
        sendImagesAsMultimodal = true,
        ...rest
      } = (data ?? {}) as OpenAiSendOptions & Record<string, unknown>;

      // model / stream / messages 属于连接身份与协议必需项，透传字段一律不得覆盖
      const requestBody = {
        ...rest,
        model: refs.model.current,
        stream: true,
        messages: buildOpenAiMessages(messages, {
          systemPrompt,
          sendImagesAsMultimodal,
        }),
      };

      let response: Response;
      try {
        response = await fetch(refs.endpointUrl.current, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...resolveHeaders(refs.requestHeaders.current),
          },
          body: JSON.stringify(requestBody),
          credentials: 'same-origin',
          signal: abortSignal,
        });
      } catch (error) {
        // 用户主动中止不算错误
        if (abortSignal?.aborted) return;
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `无法连接 AI 服务：${detail}（请检查端点地址、网络与跨域设置）`,
        );
      }
      if (!response.ok) throw new Error(await readHttpErrorMessage(response));
      if (!response.body) throw new Error('AI 服务响应没有可读的流式内容');

      let textMessageId: string | undefined;
      let reasoningMessageId: string | undefined;
      let sawTerminal = false;

      for await (const payload of readSseDataLines(
        response.body,
        abortSignal,
      )) {
        const chunk = parseOpenAiChunk(payload);
        if (chunk.done) {
          sawTerminal = true;
          break;
        }
        if (chunk.finishReason) sawTerminal = true;
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

      // 用户主动中止：不补结束事件，也不视为流被截断
      if (abortSignal?.aborted) return;
      if (textMessageId) {
        yield toStreamChunk({
          type: 'TEXT_MESSAGE_END',
          messageId: textMessageId,
          timestamp: Date.now(),
        });
      }
      // `[DONE]` 与 finish_reason 都没出现就断流，说明连接被中途切断，不能当作正常完成
      if (!sawTerminal) {
        throw new Error('AI 响应流被中断（未收到结束标记）');
      }
    },
  };
}
