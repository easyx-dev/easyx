/**
 * 演示侧的 OpenAI 适配器（函数接入形态的参考实现）
 *
 * 直连各提供方的 OpenAI 兼容端点需要自行补 `model` 与鉴权头，所以走函数接入；
 * 真实接入里这层通常落在宿主自己的服务端 / server function（密钥不落浏览器），
 * 演示是纯静态站点，故在浏览器内直连。若端点已在宿主自己的鉴权体系内，
 * 直接给 `<AiRichEditor chat="…" />` 传 URL 即可，无需这一层。
 */
import type { AiRichChatAdapter, AiRichChatChunk } from '@easyx/ai-rich-editor';

export interface DemoOpenAiOptions {
  /** 完整的 OpenAI 兼容对话端点 */
  endpointUrl: string;
  /** 模型名（端点要求时必填） */
  model: string;
  /** 鉴权等请求头 */
  requestHeaders?: Record<string, string>;
}

/** 思考内容的厂商方言字段，按顺序探测 */
const REASONING_FIELDS = [
  'reasoning_content',
  'reasoning',
  'thinking',
] as const;

/** 无业务含义的 SSE 行：心跳注释与 event/id/retry 字段一律跳过 */
const IGNORED_LINE_PREFIXES = [':', 'event:', 'id:', 'retry:'];

/** 单行 → `data:` 载荷；空行、心跳与其它字段返回 undefined，兼容省略前缀的裸 JSON 行 */
function toPayload(rawLine: string): string | undefined {
  const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
  if (!line.trim()) return undefined;
  for (const prefix of IGNORED_LINE_PREFIXES) {
    if (line.startsWith(prefix)) return undefined;
  }
  if (line.startsWith('data:')) {
    const payload = line.slice(5).trim();
    return payload || undefined;
  }
  return line.startsWith('{') ? line : undefined;
}

/** 单条 SSE 行 → 协议增量；心跳、`[DONE]` 与无法识别的载荷返回 undefined */
function parseLine(rawLine: string): AiRichChatChunk | undefined {
  const payload = toPayload(rawLine);
  if (!payload || payload === '[DONE]') return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return undefined;
  }

  const error = (parsed as { error?: unknown } | null)?.error;
  if (error) {
    if (typeof error === 'string') throw new Error(error);
    const message = (error as { message?: unknown }).message;
    throw new Error(typeof message === 'string' ? message : '模型返回错误');
  }

  const choice = (
    parsed as {
      choices?: Array<{
        delta?: Record<string, unknown>;
        message?: Record<string, unknown>;
      }>;
    } | null
  )?.choices?.[0];
  const source = choice?.delta ?? choice?.message;
  if (!source) return undefined;

  const chunk: AiRichChatChunk = {};
  if (typeof source.content === 'string' && source.content) {
    chunk.content = source.content;
  }
  for (const field of REASONING_FIELDS) {
    const value = source[field];
    if (typeof value === 'string' && value) {
      chunk.reasoning = value;
      break;
    }
  }
  return chunk.content || chunk.reasoning ? chunk : undefined;
}

/** 构造演示适配器：请求 OpenAI 兼容端点，把 SSE 响应转为协议增量 */
export function createDemoOpenAiAdapter(
  options: DemoOpenAiOptions,
): AiRichChatAdapter {
  return async function* (request, signal) {
    const response = await fetch(options.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...options.requestHeaders,
      },
      body: JSON.stringify({
        model: options.model,
        stream: true,
        messages: request.messages,
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(
        `AI 服务请求失败（HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}）`,
      );
    }
    if (!response.body) throw new Error('AI 服务响应没有可读的流式内容');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // 最后一段可能是不完整行，留到下一块再拼
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          const chunk = parseLine(rawLine);
          if (chunk) yield chunk;
        }
      }
      // 尾部无换行的最后一行也要取出；decode() 顺带 flush 跨块的残字节
      if (!signal.aborted) {
        buffer += decoder.decode();
        const tail = parseLine(buffer);
        if (tail) yield tail;
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  };
}
