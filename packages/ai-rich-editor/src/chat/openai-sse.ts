/**
 * OpenAI Chat Completions 流式响应的 SSE 解析（纯逻辑，不依赖 React / TanStack）
 *
 * 只做两件事：从字节流里按行取出 `data:` 载荷，以及把单条载荷归一化成
 * 正文 / 思考 / 结束三类增量。服务端返回的错误对象在此抛出，由上层汇入统一错误通道。
 */

/** 无业务含义的 SSE 行：心跳注释与 event/id/retry 字段一律跳过 */
const IGNORED_LINE_PREFIXES = [':', 'event:', 'id:', 'retry:'];

/**
 * 思考内容的厂商方言字段，按顺序探测：
 * DeepSeek / vLLM 用 reasoning_content，OpenRouter 用 reasoning，部分网关用 thinking。
 * OpenAI 协议本身没有思考字段，因此只能尽力识别。
 */
const REASONING_FIELDS = [
  'reasoning_content',
  'reasoning',
  'thinking',
] as const;

/** 归一化后的单条增量 */
export interface OpenAiChunk {
  /** 正文增量 */
  content?: string;
  /** 思考增量 */
  reasoning?: string;
  /** 结束原因，出现即代表本轮正常收尾 */
  finishReason?: string;
  /** `[DONE]` 终止哨兵 */
  done?: boolean;
}

/** 单行 → `data:` 载荷；空行、心跳与其它字段返回 undefined */
function toDataPayload(rawLine: string): string | undefined {
  const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
  if (!line.trim()) return undefined;
  for (const prefix of IGNORED_LINE_PREFIXES) {
    if (line.startsWith(prefix)) return undefined;
  }
  if (line.startsWith('data:')) {
    const payload = line.slice(5).trim();
    return payload || undefined;
  }
  // 个别网关省略 data: 前缀直接发 JSON 行，兼容之；其余行忽略
  return line.startsWith('{') ? line : undefined;
}

/**
 * 逐行产出 SSE 载荷
 *
 * 按缓冲区拼行：`stream: true` 下服务端可能把一行拆进多个字节块。
 * abort 时静默结束，由调用方决定是否视为正常收尾。
 */
export async function* readSseDataLines(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // 最后一段可能是不完整行，留到下一块再拼
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const payload = toDataPayload(rawLine);
        if (payload) yield payload;
      }
    }
    if (signal?.aborted) return;
    buffer += decoder.decode();
    const tail = toDataPayload(buffer);
    if (tail) yield tail;
  } catch (error) {
    if (signal?.aborted) return;
    throw error;
  } finally {
    // 提前退出（收到 [DONE] 即 break）时取消剩余流：否则服务端若在 [DONE] 后不主动关闭，
    // 连接会一直挂着。流已关闭时 cancel 立即 resolve，出错时 reject 一并吞掉。
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** 读取错误文案：流内 `{"error":...}` 与 HTTP 错误体共用 */
function readErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const error = (payload as { error?: unknown }).error;
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  const message = (error as { message?: unknown }).message;
  if (typeof message === 'string' && message) return message;
  return 'AI 服务返回错误';
}

/**
 * 解析单条载荷
 *
 * - `[DONE]` → `{ done: true }`
 * - `{"error":...}` → 抛出（含 HTTP 错误体的同构错误对象）
 * - 其余取 `choices[0]` 的增量与 finish_reason；无法识别时返回空对象而非报错
 *
 * 同时兼容忽略 `stream: true`、直接返回完整对象的网关（认 `message` 而非 `delta`），
 * 否则这类端点会表现为「有结束标记但回复为空」。
 */
export function parseOpenAiChunk(payload: string): OpenAiChunk {
  if (payload === '[DONE]') return { done: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    // 非 JSON 载荷（个别网关的 keepalive 文本）忽略，不中断整条流
    return {};
  }
  const message = readErrorMessage(parsed);
  if (message) throw new Error(message);
  if (!parsed || typeof parsed !== 'object') return {};

  const record = parsed as {
    choices?: Array<{
      delta?: Record<string, unknown>;
      message?: Record<string, unknown>;
      finish_reason?: unknown;
    }>;
  };
  const choice = record.choices?.[0];
  if (!choice) return {};

  const result: OpenAiChunk = {};
  const source = choice.delta ?? choice.message;
  if (source) {
    if (typeof source.content === 'string' && source.content) {
      result.content = source.content;
    }
    for (const field of REASONING_FIELDS) {
      const value = source[field];
      if (typeof value === 'string' && value) {
        result.reasoning = value;
        break;
      }
    }
  }
  if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
    result.finishReason = choice.finish_reason;
  }
  return result;
}

/** 读取非 2xx 响应的错误文案：优先 OpenAI 错误体，兜底 HTTP 状态 */
export async function readHttpErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const message = readErrorMessage(await response.json());
    if (message) return message;
  } catch {
    // 非 JSON 错误体，落到状态码兜底
  }
  const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  return `AI 服务请求失败（HTTP ${status}）`;
}
