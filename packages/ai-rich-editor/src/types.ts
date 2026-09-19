/**
 * AI Rich Editor 开放类型：会话消息、控制器配置与组件 Props
 *
 * 对话对外协议是标准 OpenAI Chat Completions 流式接口：宿主只需提供一个
 * OpenAI 兼容端点（endpointUrl + model + requestHeaders），无需配套服务端 SDK。
 */
import type { AiRichMediaConfig } from './media/types';
import type { AiRichDocumentParser } from './parsers/types';

/**
 * 通知回调：承载所有用户可见提示（成功 / 提醒 / 错误）
 *
 * 错误会先经此呈现，同时另经 onError 上报给宿主，两者互不替代：
 * - onNotify：给人看的文案（兜底为包内轻提示）
 * - onError：给程序看的错误实例（兜底为 console.error）
 */
export type AiRichNotify = (
  type: 'success' | 'warning' | 'error',
  content: string,
) => void;

/** 错误上报回调（返回值即抛出的错误实例，可按类分支） */
export type AiRichErrorHandler = (error: Error) => void;

/**
 * 宿主注入的能力集合（函数型，与可序列化的 config 分开）
 *
 * 这里的「tools」指宿主提供的能力函数，与模型 function/tool calling 无关 ——
 * 本包不声明也不触发任何模型工具调用。
 */
export interface AiRichEditorTools {
  /**
   * 文档解析能力（Word / PDF）：异步方法，可本地解析或接宿主服务端解析接口。
   * 传入后对话输入区出现文档入口；不传则文档能力整体不出现。
   * 浏览器端开箱可用可传 `createDefaultDocumentParser()`（见 `./parsers` 入口）。
   */
  parseDocument?: AiRichDocumentParser;
}

/**
 * 对话请求头：静态对象，或每次请求求值的函数（便于轮换 token）。
 * 用于鉴权（如 `Authorization: Bearer …`），包内不持有任何密钥知识。
 */
export type AiRichRequestHeaders =
  | Record<string, string>
  | (() => Record<string, string>);

/**
 * 统一包配置项（设置面板展示/编辑，保存后生效）
 * 其余顶层属性（endpointUrl / model / media / onNotify / onError 等）不归入此对象
 */
export interface AiRichEditorConfig {
  /** AI 回复结束后是否自动把内容应用到编辑器（默认 true，仍保留手动「应用到编辑器」按钮） */
  autoApply?: boolean;
  /** 自定义 system 提示词（可选，缺省用包内置模板） */
  systemPrompt?: string;
  /** 预览容器 <head> 附加代码（一段原始 HTML，如内置 <style>/<script>，原样注入） */
  previewHead?: string;
  /** 预览区右键「用 AI 修改」入口（默认 true） */
  previewEditMenu?: boolean;
  /**
   * 图片附件是否以多模态 content parts 发送（默认 true）
   * 关闭后图片只以文本清单里的地址出现，兼容不支持多模态的纯文本网关
   */
  sendImagesAsMultimodal?: boolean;
}

/** 编辑器 Props */
export interface AiRichEditorProps {
  /** 当前 HTML 内容 */
  value?: string;
  /** 内容变化回调 */
  onChange?: (value: string) => void;
  /** 对话流式端点（**OpenAI Chat Completions 兼容**，如 `/v1/chat/completions`） */
  endpointUrl: string;
  /** 模型名（OpenAI 协议必填，如 `gpt-4o-mini`、`deepseek-chat`） */
  model: string;
  /** 对话请求头（鉴权等，如 `{ Authorization: 'Bearer …' }`） */
  requestHeaders?: AiRichRequestHeaders;
  /**
   * 追加进每次对话请求体的字段（如 `{ temperature: 0.7 }`）。
   * `model` / `stream` / `messages` 由包内决定，同名键不会被覆盖。
   */
  requestBody?: Record<string, unknown>;
  /**
   * 媒体能力（**顶层属性，非 config**）：按类型注入上传与媒体库接口。
   * - 图片 / 视频 / 音频：对话里粘贴、拖入或选择文件后，发送时经对应 upload 上传，地址随消息给模型
   * - 附件：其余类型文件的兜底
   * - 未配置的类型即不可用（粘贴/选择时报错），代码面板仍可手工填网络地址
   * 函数型配置不进设置面板，故与 config 分开。
   */
  media?: AiRichMediaConfig;
  /**
   * 宿主注入的能力集合（函数型，与 config 分开）：目前含文档解析（Word / PDF）。
   * 不传 `tools.parseDocument` 时文档入口不出现。
   */
  tools?: AiRichEditorTools;
  /**
   * 追加允许的 URL 协议（如 ['ipfs:', 'app:']），只增不减：
   * javascript: / data: 等危险协议无论何时都被拦下。
   * 只影响「用户手输地址」与「AI 回复里的链接」，宿主接口返回的地址视为可信。
   */
  allowedUrlSchemes?: readonly string[];
  /**
   * 通知上报（成功 / 提醒 / 错误的可见文案）：不注入时用包内置轻提示。
   * 显示什么文案由包内决定，宿主只负责呈现。
   */
  onNotify?: AiRichNotify;
  /**
   * 错误上报（错误实例，供日志 / 上报 / 分支处理）：不注入时兜底 `console.error`。
   * 包内不持有错误 UI —— 错误对用户的呈现一律走 `onNotify('error', …)`。
   */
  onError?: AiRichErrorHandler;
  /** 编辑器整体高度（默认 640，宿主布局参数） */
  height?: number | string;
  /**
   * 统一包配置（**仅初始值，非受控**）。
   * 挂载后 config 变化不会生效；运行期改配置请走设置面板（保存后即时生效），
   * 并经 onConfigChange 回写宿主以持久化。
   */
  config?: AiRichEditorConfig;
  /** 设置面板保存后回写（可选，用于宿主持久化） */
  onConfigChange?: (config: AiRichEditorConfig) => void;
}
