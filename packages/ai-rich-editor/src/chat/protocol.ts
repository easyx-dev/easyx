/**
 * 对话接入协议（公开）
 *
 * 包内只定义「一轮请求 → 增量流」的形状，不持有端点、鉴权与模型知识。
 * 宿主通过顶层 `chat` 属性二选一接入：
 * - 字符串：已鉴权的 OpenAI Chat Completions 端点，包内负责请求与 SSE 解析
 * - 函数：自定义适配器（server function / 自包协议），包内只消费其增量
 */

/** 内容块：文本与图片地址（图片仅 OpenAI 协议标准化） */
export type AiRichChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** 协议消息：OpenAI Chat Completions 形态，system 提示词恒为首条 */
export interface AiRichChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AiRichChatContentPart[];
}

/** 一轮对话请求：包内已完成上下文拼装（system、历史剥离、附件/文档/当前片段） */
export interface AiRichChatRequest {
  messages: AiRichChatMessage[];
}

/** 流式增量：正文 / 思考 / 结束原因，均可选 */
export interface AiRichChatChunk {
  /** 正文增量 */
  content?: string;
  /** 思考增量（厂商方言识别不到时省略） */
  reasoning?: string;
  /** 结束原因，出现即代表本轮收尾 */
  finishReason?: string;
}

/**
 * 对话适配器：把协议请求包成调用方自己的协议请求，流式返回增量。
 *
 * 迭代器正常结束即视为本轮完成；网络断开、服务端错误等异常中断应自行抛出。
 * `signal` 触发时应尽快停止并退出。
 */
export type AiRichChatAdapter = (
  request: AiRichChatRequest,
  signal: AbortSignal,
) => AsyncIterable<AiRichChatChunk>;

/** 对话接入：已鉴权的 OpenAI Chat Completions 端点 URL，或自定义适配器函数 */
export type AiRichChatSource = string | AiRichChatAdapter;
