/**
 * OpenAI 连接适配器测试
 *
 * 重点验证对外协议形状（请求体 / 请求头）、增量到 TanStack 分片的翻译，
 * 以及三条失败路径：HTTP 错误、流内错误、无结束标记的截断。abort 视为正常停止。
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import type { UIMessage } from '@tanstack/ai-react';
import { createOpenAiConnection } from '../src/chat/openai-connection';

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

/** 用固定 SSE 行构造连接与请求捕获 */
function setup(
  lines: readonly string[],
  refs?: {
    endpointUrl?: string;
    model?: string;
    requestHeaders?: Record<string, string> | (() => Record<string, string>);
  },
) {
  let captured: Captured | undefined;
  rs.stubGlobal(
    'fetch',
    async (url: string, init: RequestInit): Promise<Response> => {
      captured = { url, init };
      return sseResponse(lines);
    },
  );
  const connection = createOpenAiConnection({
    endpointUrl: {
      current: refs?.endpointUrl ?? 'https://api.test/v1/chat/completions',
    },
    model: { current: refs?.model ?? 'gpt-4o-mini' },
    requestHeaders: { current: refs?.requestHeaders },
  });
  return {
    connection,
    getCaptured: () => captured,
  };
}

async function collect(
  connection: ReturnType<typeof createOpenAiConnection>,
  data?: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const chunks: Array<Record<string, unknown>> = [];
  for await (const chunk of connection.connect(
    [userMessage('生成一个卡片')],
    data,
    signal,
  )) {
    chunks.push(chunk as unknown as Record<string, unknown>);
  }
  return chunks;
}

describe('请求构造', () => {
  it('发送标准 OpenAI 请求体（system 前置、stream 固定为 true）', async () => {
    const { connection, getCaptured } = setup([data('[DONE]')]);
    await collect(connection, { systemPrompt: 'SYS', temperature: 0.5 });
    const captured = getCaptured();
    expect(captured?.url).toBe('https://api.test/v1/chat/completions');
    const body = JSON.parse(String(captured?.init.body));
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.stream).toBe(true);
    expect(body.temperature).toBe(0.5);
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: '生成一个卡片' },
    ]);
  });

  it('透传字段不能覆盖 model / messages / stream', async () => {
    const { connection, getCaptured } = setup([data('[DONE]')]);
    await collect(connection, {
      messages: [{ role: 'user', content: '伪造' }],
      model: 'deepseek-chat',
      stream: false,
    });
    const body = JSON.parse(String(getCaptured()?.init.body));
    expect(body.stream).toBe(true);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages.at(-1)).toEqual({
      role: 'user',
      content: '生成一个卡片',
    });
  });

  it('合并宿主请求头（静态对象与函数两种形态）', async () => {
    const { connection, getCaptured } = setup([data('[DONE]')], {
      requestHeaders: () => ({ Authorization: 'Bearer token' }),
    });
    await collect(connection, { systemPrompt: 'SYS' });
    const headers = getCaptured()?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('text/event-stream');
  });
});

describe('分片翻译', () => {
  it('正文增量翻译为 START / CONTENT / END', async () => {
    const { connection } = setup([
      data({
        choices: [{ delta: { role: 'assistant' }, finish_reason: null }],
      }),
      contentChunk('你'),
      contentChunk('好'),
      data({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      data('[DONE]'),
    ]);
    const chunks = await collect(connection, { systemPrompt: 'SYS' });
    const types = chunks.map((chunk) => chunk.type);
    expect(types).toEqual([
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
    const { connection } = setup([
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
    const { connection } = setup([
      contentChunk('好'),
      data({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
    ]);
    await expect(
      collect(connection, { systemPrompt: 'SYS' }),
    ).resolves.toHaveLength(3);
  });
});

describe('失败路径', () => {
  it('HTTP 非 2xx 抛出错误体文案', async () => {
    rs.stubGlobal('fetch', async () => {
      return new Response(JSON.stringify({ error: { message: '额度不足' } }), {
        status: 429,
      });
    });
    const connection = createOpenAiConnection({
      endpointUrl: { current: 'https://api.test/v1/chat/completions' },
      model: { current: 'gpt-4o-mini' },
      requestHeaders: { current: undefined },
    });
    await expect(collect(connection, { systemPrompt: 'SYS' })).rejects.toThrow(
      '额度不足',
    );
  });

  it('流内错误对象中断整条流', async () => {
    const { connection } = setup([
      contentChunk('半'),
      data({ error: { message: '模型不可用' } }),
    ]);
    await expect(collect(connection, { systemPrompt: 'SYS' })).rejects.toThrow(
      '模型不可用',
    );
  });

  it('既无 [DONE] 也无 finish_reason 时视为流被截断', async () => {
    const { connection } = setup([contentChunk('半')]);
    await expect(collect(connection, { systemPrompt: 'SYS' })).rejects.toThrow(
      'AI 响应流被中断',
    );
  });

  it('网络失败包装为可读文案', async () => {
    rs.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const connection = createOpenAiConnection({
      endpointUrl: { current: 'https://api.test/v1/chat/completions' },
      model: { current: 'gpt-4o-mini' },
      requestHeaders: { current: undefined },
    });
    await expect(collect(connection, { systemPrompt: 'SYS' })).rejects.toThrow(
      '无法连接 AI 服务',
    );
  });

  it('已中止的信号不产出分片也不报错', async () => {
    const { connection } = setup([contentChunk('半')]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      collect(connection, { systemPrompt: 'SYS' }, controller.signal),
    ).resolves.toEqual([]);
  });
});
