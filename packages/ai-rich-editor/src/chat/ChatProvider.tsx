/**
 * AI 富编辑器对话区：TanStack AI headless 数据流 + 包内自研渲染层
 * 基于 @tanstack/ai-react/ui 的 createChatHook：模块作用域注册一次，
 * components（layout/message/input）+ partsComponents（text/thinking/fallback）
 * 驱动消息渲染；宿主经 EditorCfgContext 注入 runtime 配置（systemPrompt/requestMeta/onApplyHtml/notify）。
 * 渲染侧全部走包内原语：气泡、输入框、推荐指令、思考块均为自研实现。
 *
 * 单实例假设：编辑器一页一个；createChatHook 的 options 在模块作用域固定，
 * 每实例的 endpointUrl / 结束回调经 createInstanceChatOverrides 注入。
 */
import type { UIMessage } from '@tanstack/ai-react';
import { fetchServerSentEvents } from '@tanstack/ai-react';
import type {
  ChatUIHost,
  InputProps,
  LayoutProps,
  MessageProps,
  PartProps,
} from '@tanstack/ai-react/ui';
import { createChatHook } from '@tanstack/ai-react/ui';
import {
  type ComponentType,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { MarkdownContent } from '../components/MarkdownContent';
import { CHAT_INPUT_PLACEHOLDER, PRESET_PROMPTS } from '../constants';
import { buildDefaultSystemPrompt } from '../prompts';
import type { AiRichNotify } from '../types';
import { IconRobot, IconTrash } from '../ui/icons';
import { Alert } from '../ui/primitives/Alert';
import { Button } from '../ui/primitives/Button';
import { Tooltip } from '../ui/primitives/Tooltip';
import { ChatComposer } from './ChatComposer';
import { ThinkBlock } from './ThinkBlock';

/** 运行期注入给 chat 组件的配置（不含 endpointUrl/onComplete，二者走模块 ref） */
export interface EditorChatConfig {
  /** 自定义 system 提示词（缺省用包内置模板） */
  systemPrompt?: string;
  /** 随每次发送透传的服务端元数据（如 { providerId }，经 body 进入 forwardedProps） */
  requestMeta?: Record<string, unknown>;
  /** 「应用到编辑器」回调（代码块替换当前内容） */
  onApplyHtml?: (html: string) => void;
  /** 消息提示回调（复制代码等轻提示） */
  notify?: AiRichNotify;
}

/** 供宿主在 <chat.AppChat/> 外层提供运行期配置 */
export const EditorCfgContext = createContext<EditorChatConfig>({});

// ---- createChatHook options（模块作用域固定；connection/onFinish 由各实例经 overrides 注入） ----
const chatOptions = {};

/**
 * 每实例 chat 覆盖项
 * connection 由库消费，其具体适配器类型未导出，此处以 unknown 占位；
 * 二者都不在该库 overrides 的公开类型里，因此单独声明后由 useAppChat 注入。
 */
export interface InstanceChatOverrides {
  /** 由 fetchServerSentEvents 构建的连接适配器（不透明，仅库内部消费） */
  connection: unknown;
  /** 流结束回调，取回复全文 */
  onFinish: (message: UIMessage) => void;
}

/** 对话实例：渲染层用到的公开结构（AppChat 为渲染壳） */
export type AiRichChatInstance = ChatUIHost<typeof chatOptions> & {
  AppChat: ComponentType;
};

/** createChatHook 绑定后的返回结构（与库返回类型隔离的唯一边界） */
interface ChatHookBinding {
  useAppChat: (overrides?: InstanceChatOverrides) => AiRichChatInstance;
  useChatContext: () => ChatUIHost<typeof chatOptions>;
}

/** chat 组件内部读取运行期配置 */
function useEditorCfg(): EditorChatConfig {
  return useContext(EditorCfgContext);
}

/** 提取 UIMessage 的文本内容（拼接 text part） */
function textOf(message: UIMessage): string {
  let text = '';
  for (const part of message.parts) {
    if (part.type === 'text' && typeof part.content === 'string') {
      text += part.content;
    }
  }
  return text;
}

/** 组装每次发送的 body（合并 requestMeta 与 systemPrompt） */
function sendBody(cfg: EditorChatConfig): Record<string, unknown> {
  return {
    ...cfg.requestMeta,
    systemPrompt: cfg.systemPrompt ?? buildDefaultSystemPrompt(),
  };
}

/**
 * 构建每个实例的 chat 运行时覆盖项（connection / onFinish）。
 * createChatHook 的 options 在模块作用域固定，而 endpointUrl / onComplete 是每实例动态值，
 * 故经 useAppChat 的 overrides 注入（运行时 {...options, ...overrides} 覆盖同名字段），
 * 使多实例互不串线。
 */
export function createInstanceChatOverrides(
  endpointUrlRef: { current: string },
  onCompleteRef: { current: ((content: string) => void) | undefined },
): InstanceChatOverrides {
  return {
    connection: fetchServerSentEvents(() => endpointUrlRef.current),
    onFinish: (message: UIMessage) => {
      const content = textOf(message);
      if (content.trim()) onCompleteRef.current?.(content);
    },
  };
}

// ---- UI 组件 ----

/** 标记某条消息当前是否正在流式生成（区分「思考中」与「已思考」） */
const MessageStreamContext = createContext(false);

/** 消息壳：user 右对齐填充气泡；assistant 无边框气泡（Parts 自动分发 text/thinking/fallback） */
function ChatMessage({ message, Parts }: MessageProps<typeof chatOptions>) {
  const chat = useChatContext();
  if (message.role === 'user') {
    return (
      <div className="easyx-ai-rich-editor__bubble easyx-ai-rich-editor__bubble--user">
        <span className="easyx-ai-rich-editor__chat-user-text">
          {textOf(message)}
        </span>
      </div>
    );
  }
  // 正在流式生成的必然是消息列表最后一条；按消息判定而非全局 isLoading，
  // 避免「已完成消息」也显示「思考中」，与进行中的串了
  const last = chat.messages.at(-1);
  const isStreaming = Boolean(chat.isLoading && last?.id === message.id);
  return (
    <div className="easyx-ai-rich-editor__bubble easyx-ai-rich-editor__bubble--assistant">
      <MessageStreamContext.Provider value={isStreaming}>
        <Parts />
      </MessageStreamContext.Provider>
    </div>
  );
}

/** 文本 part：markdown 渲染（```html 代码块「应用到编辑器」） */
function TextPart({ part }: PartProps<typeof chatOptions, 'text'>) {
  const cfg = useEditorCfg();
  return (
    <MarkdownContent
      content={part.content}
      notify={cfg.notify}
      onApplyHtml={cfg.onApplyHtml}
    />
  );
}

/** 思考 part：本消息流式中显示「思考中…」；默认折叠，展开后做 markdown 渲染 + 限高滚动 + 自动触底 */
function ThinkingPart({ part }: PartProps<typeof chatOptions, 'thinking'>) {
  const cfg = useEditorCfg();
  const isStreaming = useContext(MessageStreamContext);
  const content = typeof part.content === 'string' ? part.content : '';
  const scrollRef = useRef<HTMLDivElement>(null);

  // 思考内容流式增长时自动滚动到底部，露出最新推理
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !content) return;
    el.scrollTop = el.scrollHeight;
  }, [content]);

  if (!content.trim()) return null;
  return (
    <ThinkBlock
      loading={isStreaming}
      title={isStreaming ? '思考中…' : '已思考'}
    >
      <div className="easyx-ai-rich-editor__think-scroll" ref={scrollRef}>
        <MarkdownContent content={content} notify={cfg.notify} />
      </div>
    </ThinkBlock>
  );
}

/** 未识别 part 兜底：不渲染 */
function FallbackPart(_props: PartProps<typeof chatOptions>) {
  return null;
}

/** 输入区：包内自研输入框（Enter 发送、Shift+Enter 换行、输入法合成期不发送） */
function ChatInput(_props: InputProps<typeof chatOptions>) {
  const chat = useChatContext();
  const cfg = useEditorCfg();
  const [input, setInput] = useState('');

  const handleSubmit = (text: string) => {
    const value = text.trim();
    if (!value || chat.isLoading) return;
    // 失败由 chat.error 驱动界面提示；此处吞掉 rejection 避免未处理 promise
    chat.sendMessage(value, { body: sendBody(cfg) }).catch(() => {});
    setInput('');
  };

  return (
    <ChatComposer
      loading={chat.isLoading}
      onCancel={() => chat.stop()}
      onChange={setInput}
      onSubmit={handleSubmit}
      placeholder={CHAT_INPUT_PLACEHOLDER}
      value={input}
    />
  );
}

/** 布局壳：对话面板头 + 消息滚动区（空态引导 + 推荐指令）+ 底部输入框 */
function ChatLayout({
  Messages,
  Interrupts,
  Input: ChatInputRef,
}: LayoutProps<typeof chatOptions>) {
  const chat = useChatContext();
  const cfg = useEditorCfg();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 发送后、首个 assistant 内容到达前的过渡 loading：
  // assistant 消息为惰性创建（首个 content chunk 才生成），等待期 messages 末尾仍是 user
  const awaitingFirstToken =
    chat.isLoading && chat.messages.at(-1)?.role === 'user';

  // 消息数量变化（含流式增量、新会话清空）时自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || chat.messages.length === 0) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  const handlePreset = (preset: string) => {
    if (chat.isLoading) return;
    // 失败由 chat.error 驱动界面提示；此处吞掉 rejection 避免未处理 promise
    chat.sendMessage(preset, { body: sendBody(cfg) }).catch(() => {});
  };

  return (
    <div className="easyx-ai-rich-editor__chat">
      {/* 对话面板头：AI 助手 + 新会话 */}
      <div className="easyx-ai-rich-editor__chat-head">
        <span className="easyx-ai-rich-editor__chat-title">
          <IconRobot className="easyx-ai-rich-editor__chat-icon" />
          AI 助手
        </span>
        <Tooltip title="新会话（清空并重新开始）">
          <Button
            disabled={chat.messages.length === 0}
            icon={<IconTrash size={13} />}
            onClick={() => chat.setMessages([])}
            size="sm"
            variant="text"
          >
            新会话
          </Button>
        </Tooltip>
      </div>

      {/* 消息区 */}
      <div className="easyx-ai-rich-editor__chat-body" ref={scrollRef}>
        {/* 中断列表：有 pending 中断（工具审批等）时在任何状态下都展示 */}
        <Interrupts />
        {chat.messages.length === 0 ? (
          <div className="easyx-ai-rich-editor__chat-empty">
            <div className="easyx-ai-rich-editor__chat-empty-inner">
              <IconRobot className="easyx-ai-rich-editor__chat-empty-icon" />
              <span className="easyx-ai-rich-editor__chat-empty-title">
                AI 页面助手
              </span>
              <span className="easyx-ai-rich-editor__chat-empty-desc">
                输入需求，或选择下方推荐指令
              </span>
            </div>
            {/* 推荐指令：纵向排列，一行一个 */}
            <div className="easyx-ai-rich-editor__chat-prompts">
              <span className="easyx-ai-rich-editor__chat-prompts-title">
                为你推荐
              </span>
              <ul className="easyx-ai-rich-editor__chat-prompts-list">
                {PRESET_PROMPTS.map((preset) => (
                  <li key={preset}>
                    <button
                      className="easyx-ai-rich-editor__chat-prompt"
                      disabled={chat.isLoading}
                      onClick={() => handlePreset(preset)}
                      type="button"
                    >
                      {preset}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="easyx-ai-rich-editor__chat-messages">
            <Messages />
            {/* 模型反馈期间的过渡状态：首个 assistant 内容到达前显示加载占位 */}
            {awaitingFirstToken && (
              <div className="easyx-ai-rich-editor__bubble easyx-ai-rich-editor__bubble--assistant">
                <div className="easyx-ai-rich-editor__chat-pending">
                  <span className="easyx-ai-rich-editor__spinner easyx-ai-rich-editor__spinner--sm" />
                  <span>请求中…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入框：悬浮效果，与四周留出间距 */}
      <div className="easyx-ai-rich-editor__chat-input">
        <ChatInputRef />
      </div>

      {chat.error && (
        <Alert
          className="easyx-ai-rich-editor__chat-error"
          showIcon
          title={chat.error.message}
          type="error"
        />
      )}
    </div>
  );
}

// ---- createChatHook 绑定（模块作用域一次） ----
// 库的返回类型引用了未导出的内部类型，声明文件无法命名，
// 因此在此一次性收窄为渲染层实际用到的公开结构（ChatHookBinding），作为与库类型的唯一边界。
const chatHook = createChatHook({
  components: {
    input: ChatInput,
    layout: ChatLayout,
    message: ChatMessage,
  },
  options: chatOptions,
  partsComponents: {
    fallback: FallbackPart,
    text: TextPart,
    thinking: ThinkingPart,
  },
}) as unknown as ChatHookBinding;

export const useAppChat = chatHook.useAppChat;
export const useChatContext = chatHook.useChatContext;
