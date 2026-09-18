/**
 * OpenAI SSE 解析测试
 *
 * 覆盖流式响应最易出错的三处：跨字节块的拼行、心跳/控制字段的跳过、
 * 以及增量归一化与错误提取（含 HTTP 错误体的兜底文案）。
 */
import { describe, expect, it } from '@rstest/core';
import {
  parseOpenAiChunk,
  readHttpErrorMessage,
  readSseDataLines,
} from '../src/chat/openai-sse';

/** 把若干字符串块依次塞进流（模拟分块到达的响应体） */
function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function drain(chunks: readonly string[]): Promise<string[]> {
  const result: string[] = [];
  for await (const line of readSseDataLines(streamOf(chunks))) {
    result.push(line);
  }
  return result;
}

describe('readSseDataLines', () => {
  it('跨字节块拼行后按序取出 data 载荷', async () => {
    expect(await drain(['data: {"a"', ':1}\n', 'data: {"b":2}\n'])).toEqual([
      '{"a":1}',
      '{"b":2}',
    ]);
  });

  it('跳过心跳注释与 event/id/retry 字段', async () => {
    expect(
      await drain([
        ': keep-alive\n',
        'event: message\n',
        'id: 7\n',
        'retry: 100\n',
        'data: {}\n',
      ]),
    ).toEqual(['{}']);
  });

  it('兼容 CRLF 与 data: 后无空格', async () => {
    expect(await drain(['data:{}\r\n', 'data: {}\r\n'])).toEqual(['{}', '{}']);
  });

  it('接受省略 data: 前缀的裸 JSON 行，忽略其它行', async () => {
    expect(await drain(['{"type":"x"}\n', 'garbage\n', '\n'])).toEqual([
      '{"type":"x"}',
    ]);
  });

  it('尾部无换行的最后一行也会被取出', async () => {
    expect(await drain(['data: {"a":1}\n', 'data: {"b":2}'])).toEqual([
      '{"a":1}',
      '{"b":2}',
    ]);
  });
});

describe('parseOpenAiChunk', () => {
  it('[DONE] 识别为终止哨兵', () => {
    expect(parseOpenAiChunk('[DONE]')).toEqual({ done: true });
  });

  it('取出正文增量', () => {
    expect(
      parseOpenAiChunk(
        '{"choices":[{"delta":{"content":"你好"},"finish_reason":null}]}',
      ),
    ).toEqual({ content: '你好' });
  });

  it('思考增量按方言字段探测', () => {
    expect(
      parseOpenAiChunk(
        '{"choices":[{"delta":{"reasoning_content":"想一想"}}]}',
      ),
    ).toEqual({ reasoning: '想一想' });
    expect(
      parseOpenAiChunk('{"choices":[{"delta":{"reasoning":"想想"}}]}'),
    ).toEqual({ reasoning: '想想' });
  });

  it('reasoning_content 优先于 reasoning', () => {
    expect(
      parseOpenAiChunk(
        '{"choices":[{"delta":{"reasoning_content":"甲","reasoning":"乙"}}]}',
      ),
    ).toEqual({ reasoning: '甲' });
  });

  it('finish_reason 透出为结束原因', () => {
    expect(
      parseOpenAiChunk('{"choices":[{"delta":{},"finish_reason":"stop"}]}'),
    ).toEqual({ finishReason: 'stop' });
  });

  it('流内错误对象抛出 message 文案', () => {
    expect(() =>
      parseOpenAiChunk('{"error":{"message":"invalid api key"}}'),
    ).toThrow('invalid api key');
  });

  it('无法解析的载荷与非对象载荷返回空对象', () => {
    expect(parseOpenAiChunk('not json')).toEqual({});
    expect(parseOpenAiChunk('123')).toEqual({});
  });

  it('仅带 usage 的收尾分片（choices 为空）被忽略', () => {
    expect(
      parseOpenAiChunk('{"choices":[],"usage":{"total_tokens":10}}'),
    ).toEqual({});
  });

  it('兼容忽略 stream 的网关：认 message 而非 delta', () => {
    expect(
      parseOpenAiChunk(
        '{"choices":[{"message":{"content":"完整回复"},"finish_reason":"stop"}]}',
      ),
    ).toEqual({ content: '完整回复', finishReason: 'stop' });
  });
});

describe('readHttpErrorMessage', () => {
  it('优先取 OpenAI 错误体文案', async () => {
    const response = new Response(
      JSON.stringify({ error: { message: '额度不足' } }),
      { status: 429, statusText: 'Too Many Requests' },
    );
    expect(await readHttpErrorMessage(response)).toBe('额度不足');
  });

  it('非 JSON 错误体落到状态码文案', async () => {
    const response = new Response('oops', {
      status: 401,
      statusText: 'Unauthorized',
    });
    expect(await readHttpErrorMessage(response)).toBe(
      'AI 服务请求失败（HTTP 401 Unauthorized）',
    );
  });
});
