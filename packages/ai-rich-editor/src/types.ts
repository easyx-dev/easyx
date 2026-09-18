/**
 * AI Rich Editor 开放类型：会话消息、控制器配置与组件 Props
 * 协议层与 UI 库无关，由宿主透传 SSE 端点（TanStack AI useChat 消费）
 */
import type { AiRichMediaConfig } from './media/types';

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
 * 统一包配置项（设置面板展示/编辑，保存后生效）
 * 其余顶层属性（endpointUrl / height / media / onNotify / onError 等）不归入此对象
 */
export interface AiRichEditorConfig {
  /** AI 回复结束后是否自动把内容应用到编辑器（默认 true，仍保留手动「应用到编辑器」按钮） */
  autoApply?: boolean;
  /** 自定义 system 提示词（可选，缺省用包内置模板） */
  systemPrompt?: string;
  /** 预览容器 <head> 附加代码（一段原始 HTML，如内置 <style>/<script>，原样注入） */
  previewHead?: string;
}

/** 编辑器 Props */
export interface AiRichEditorProps {
  /** 当前 HTML 内容 */
  value?: string;
  /** 内容变化回调 */
  onChange?: (value: string) => void;
  /** 对话流式 SSE 端点 URL（由宿主提供，经 useChat 消费 TanStack AI SSE） */
  endpointUrl: string;
  /** 随每次对话请求透传的服务端附加元数据（如 { providerId }，经 forwardedProps 到达服务端） */
  requestMeta?: Record<string, unknown>;
  /**
   * 媒体能力（**顶层属性，非 config**）：按类型注入上传与媒体库接口。
   * - 图片 / 视频 / 音频：对话里粘贴、拖入或选择文件后，发送时经对应 upload 上传，地址随消息给模型
   * - 附件：其余类型文件的兜底
   * - 未配置的类型即不可用（粘贴/选择时报错），代码面板仍可手工填网络地址
   * 函数型配置不进设置面板，故与 config 分开。
   */
  media?: AiRichMediaConfig;
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
