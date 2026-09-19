/**
 * 内置 OpenAI 路径：向已鉴权的 Chat Completions 端点发起流式请求
 *
 * 只处理标准 OpenAI 协议（`data:` + `[DONE]`）。请求体固定推送
 * `{ messages, stream: true }`，**不带 `model`** —— 模型与鉴权由端点侧决定，
 * 因此该路径不提供请求头 / 额外字段的配置能力；需要这些时改走适配器函数。
 */
import {
  parseOpenAiChunk,
  readHttpErrorMessage,
  readSseDataLines,
} from './openai-sse';
import type { AiRichChatChunk, AiRichChatMessage } from './protocol';

/**
 * 请求一轮对话并产出协议增量
 *
 * 终止以 `[DONE]` 或 `finish_reason` 为准，两者都缺失即判定流被切断并抛错，
 * 避免把半截回复当成功交给上层。abort 时静默结束。
 */
export async function* requestOpenAiStream(
  url: string,
  messages: readonly AiRichChatMessage[],
  signal: AbortSignal,
): AsyncGenerator<AiRichChatChunk> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ messages, stream: true }),
      // 同源 cookie 鉴权：宿主把端点放在自己的鉴权体系之内即可
      credentials: 'same-origin',
      signal,
    });
  } catch (error) {
    // 用户主动中止不算错误
    if (signal.aborted) return;
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `无法连接 AI 服务：${detail}（请检查端点地址、网络与跨域设置）`,
    );
  }
  if (!response.ok) throw new Error(await readHttpErrorMessage(response));
  if (!response.body) throw new Error('AI 服务响应没有可读的流式内容');

  let sawTerminal = false;
  for await (const payload of readSseDataLines(response.body, signal)) {
    const chunk = parseOpenAiChunk(payload);
    if (chunk.done) {
      sawTerminal = true;
      break;
    }
    if (chunk.finishReason) sawTerminal = true;
    if (!chunk.content && !chunk.reasoning && !chunk.finishReason) continue;
    yield {
      content: chunk.content,
      reasoning: chunk.reasoning,
      finishReason: chunk.finishReason,
    };
  }

  if (signal.aborted) return;
  if (!sawTerminal) {
    throw new Error('AI 响应流被中断（未收到结束标记）');
  }
}
