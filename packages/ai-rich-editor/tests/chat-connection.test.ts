/**
 * 对话连接适配器测试
 *
 * 覆盖两种接入形态的分发与统一翻译：
 * - 字符串：内置 OpenAI 路径（请求体固定 `{ messages, stream: true }`、无 model），
 *   以及 HTTP 错误 / 流内错误 / 无结束标记的截断三条失败路径
 * - 函数：适配器收到协议请求与 signal，增量翻译为 TanStack 分片，异常原样抛出
 * abort 一律视为正常停止。
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import type { UIMessage } from '@tanstack/ai-react';
import { createChatConnection } from '../src/chat/chat-connection';
import type {
  AiRichChatAdapter,
  AiRichChatRequest,
} from '../src/chat/protocol';

afterEach(() => rs.unstubAllGlobals());

/** 把若干已格式化的 SSE 行塞进流 */
function sseResponse(lines: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function data(payload: unknown): string {
  return `data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n`;
}

function contentChunk(delta: string): string {
  return data({
    choices: [{ delta: { content: delta }, finish_reason: null }],
  });
}

function userMessage(text: string): UIMessage {
  return {
    id: 'user-1',
    role: 'user',
    parts: [{ type: 'text', content: text }],
  } as unknown as UIMessage;
}

interface Captured {
  url: string;
  init: RequestInit;
}

/** 用固定 SSE 行构造字符串接入的连接与请求捕获 */
function setupUrl(lines: readonly string[], url = 'https://api.test/v1/chat') {
  let captured: Captured | undefined;
  rs.stubGlobal(
    'fetch',
    async (input: string, init: RequestInit): Promise<Response> => {
      captured = { init, url: input };
      return sseResponse(lines);
    },
  );
  return {
    connection: createChatConnection({ source: { current: url } }),
    getCaptured: () => captured,
  };
}

async function collect(
  connection: ReturnType<typeof createChatConnection>,
  body?: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const chunks: Array<Record<string, unknown>> = [];
  for await (const chunk of connection.connect(
    [userMessage('生成一个卡片')],
    body,
    signal,
  )) {
    chunks.push(chunk as unknown as Record<string, unknown>);
  }
  return chunks;
}

describe('字符串接入（内置 OpenAI 路径）', () => {
  it('请求体固定为 messages + stream，system 前置且不带 model', async () => {
    const { connection, getCaptured } = setupUrl([data('[DONE]')]);
    await collect(connection, { systemPrompt: 'SYS' });
    const captured = getCaptured();
    expect(captured?.url).toBe('https://api.test/v1/chat');
    const body = JSON.parse(String(captured?.init.body));
    expect(body).toEqual({
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: '生成一个卡片' },
      ],
      stream: true,
    });
    expect(body.model).toBeUndefined();
    const headers = captured?.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('text/event-stream');
    expect(captured?.init.credentials).toBe('same-origin');
  });

  it('正文增量翻译为 START / CONTENT / END', async () => {
    const { connection } = setupUrl([
      contentChunk('你'),
      contentChunk('好'),
      data({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      data('[DONE]'),
    ]);
    const chunks = await collect(connection, { systemPrompt: 'SYS' });
    expect(chunks.map((chunk) => chunk.type)).toEqual([
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
    ]);
    const messageId = chunks[0].messageId;
    expect(chunks[1].delta).toBe('你');
    expect(chunks[2].delta).toBe('好');
    expect(chunks[3].messageId).toBe(messageId);
  });

  it('思考增量翻译为 REASONING_MESSAGE_CONTENT，且与正文各自独立的消息 id', async () => {
    const { connection } = setupUrl([
      data({ choices: [{ delta: { reasoning_content: '先想' } }] }),
      contentChunk('再答'),
      data('[DONE]'),
    ]);
    const chunks = await collect(connection, { systemPrompt: 'SYS' });
    expect(chunks.map((chunk) => chunk.type)).toEqual([
      'REASONING_MESSAGE_CONTENT',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
    ]);
    expect(chunks[0].delta).toBe('先想');
    expect(chunks[0].messageId).not.toBe(chunks[1].messageId);
  });

  it('无 [DONE] 但带 finish_reason 也算正常收尾', async () => {
    const { connection } = setupUrl([
      contentChunk('好'),
      data({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
    ]);
    await expect(
      collect(connection, { systemPrompt: 'SYS' }),
    ).resolves.toHaveLength(3);
  });
});

describe('函数接入（自定义适配器）', () => {
  function setupAdapter(adapter: AiRichChatAdapter) {
    return createChatConnection({ source: { current: adapter } });
  }

  it('适配器收到协议请求（system 前置）与 signal，增量被翻译', async () => {
    const received: Array<{ request: AiRichChatRequest; signal: AbortSignal }> =
      [];
    const adapter: AiRichChatAdapter = (request, signal) => {
      received.push({ request, signal });
      return (async function* () {
        yield { reasoning: '先想' };
        yield { content: '答' };
      })();
    };
    const chunks = await collect(setupAdapter(adapter), {
      systemPrompt: 'SYS',
    });
    expect(received).toHaveLength(1);
    expect(received[0].request.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: '生成一个卡片' },
    ]);
    expect(received[0].signal).toBeInstanceOf(AbortSignal);
    expect(chunks.map((chunk) => chunk.type)).toEqual([
      'REASONING_MESSAGE_CONTENT',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
    ]);
  });

  it('迭代器正常结束即视为完成（不要求结束标记）', async () => {
    const adapter: AiRichChatAdapter = () =>
      (async function* () {
        yield { content: '好' };
      })();
    await expect(collect(setupAdapter(adapter))).resolves.toHaveLength(3);
  });

  it('适配器抛出的错误原样冒泡', async () => {
    const adapter: AiRichChatAdapter = () =>
      (async function* () {
        yield { content: '半' };
        throw new Error('后端不可用');
      })();
    await expect(collect(setupAdapter(adapter))).rejects.toThrow('后端不可用');
  });

  it('已中止的信号不再产出分片，适配器抛错也静默', async () => {
    const controller = new AbortController();
    controller.abort();
    // 首个 next() 即抛错（非生成器，避免 useYield 约束）
    const adapter: AiRichChatAdapter = () => ({
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new Error('AbortError')),
      }),
    });
    await expect(
      collect(setupAdapter(adapter), undefined, controller.signal),
    ).resolves.toEqual([]);
  });
});

describe('内置路径的失败路径', () => {
  it('HTTP 非 2xx 抛出错误体文案', async () => {
    rs.stubGlobal('fetch', async () => {
      return new Response(JSON.stringify({ error: { message: '额度不足' } }), {
        status: 429,
      });
    });
    const connection = createChatConnection({
      source: { current: 'https://api.test/v1/chat' },
    });
    await expect(collect(connection, { systemPrompt: 'SYS' })).rejects.toThrow(
      '额度不足',
    );
  });

  it('流内错误对象中断整条流', async () => {
    const { connection } = setupUrl([
      contentChunk('半'),
      data({ error: { message: '模型不可用' } }),
    ]);
    await expect(collect(connection, { systemPrompt: 'SYS' })).rejects.toThrow(
      '模型不可用',
    );
  });

  it('既无 [DONE] 也无 finish_reason 时视为流被截断', async () => {
    const { connection } = setupUrl([contentChunk('半')]);
    await expect(collect(connection, { systemPrompt: 'SYS' })).rejects.toThrow(
      'AI 响应流被中断',
    );
  });

  it('网络失败包装为可读文案', async () => {
    rs.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const connection = createChatConnection({
      source: { current: 'https://api.test/v1/chat' },
    });
    await expect(collect(connection, { systemPrompt: 'SYS' })).rejects.toThrow(
      '无法连接 AI 服务',
    );
  });

  it('已中止的信号不产出分片也不报错', async () => {
    const { connection } = setupUrl([contentChunk('半')]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      collect(connection, { systemPrompt: 'SYS' }, controller.signal),
    ).resolves.toEqual([]);
  });
});
