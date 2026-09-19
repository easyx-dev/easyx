/**
 * AI 富编辑器对话区：TanStack AI headless 数据流 + 包内自研渲染层
 * 基于 @tanstack/ai-react/ui 的 createChatHook：模块作用域注册一次，
 * components（layout/message/input）+ partsComponents（text/thinking/fallback）
 * 驱动消息渲染；宿主经 EditorCfgContext 注入 runtime 配置（systemPrompt/requestBody/onApplyHtml/notify）。
 * 数据流底层是标准 OpenAI Chat Completions 流式连接（见 chat/openai-connection.ts），
 * 渲染侧全部走包内原语：气泡、输入框、推荐指令、思考块均为自研实现。
 *
 * 单实例假设：编辑器一页一个；createChatHook 的 options 在模块作用域固定，
 * 每实例的连接信息（endpointUrl/model/requestHeaders）与结束回调经 overrides 注入。
 */
import type { ConnectConnectionAdapter, UIMessage } from '@tanstack/ai-react';
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
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ContextCodeCard } from '../components/ContextCodeCard';
import { MarkdownContent } from '../components/MarkdownContent';
import type { MediaPick } from '../components/MediaPicker';
import {
  CHAT_INPUT_PLACEHOLDER,
  MEDIA_ATTACHMENT_LIMIT,
  PRESET_PROMPTS,
} from '../constants';
import {
  createLibraryAttachment,
  type PendingAttachment,
  parseSentAttachments,
  planFileAttachments,
  toSentAttachment,
} from '../media/attachment';
import { toError } from '../media/errors';
import { buildAttachmentBlock } from '../media/prompt-text';
import type { AiRichMediaConfig, SentAttachment } from '../media/types';
import { uploadMediaFile } from '../media/upload';
import { buildDefaultSystemPrompt } from '../prompts';
import type {
  AiRichErrorHandler,
  AiRichNotify,
  AiRichRequestHeaders,
} from '../types';
import { IconRobot, IconTrash } from '../ui/icons';
import { Alert } from '../ui/primitives/Alert';
import { Button } from '../ui/primitives/Button';
import { Tooltip } from '../ui/primitives/Tooltip';
import type { SanitizeUrlOptions } from '../utils/url';
import { AttachmentBar } from './AttachmentBar';
import { ChatComposer } from './ChatComposer';
import { createOpenAiConnection } from './openai-connection';
import { buildCurrentFragmentBlock, splitPromptBlocks } from './prompt-blocks';
import { ThinkBlock } from './ThinkBlock';

/** 运行期注入给 chat 组件的配置（不含连接信息，后者走模块 ref） */
export interface EditorChatConfig {
  /** 自定义 system 提示词（缺省用包内置模板） */
  systemPrompt?: string;
  /** 图片是否以多模态 content parts 发送（缺省 true） */
  sendImagesAsMultimodal?: boolean;
  /** 追加进对话请求体的字段（如 { temperature: 0.7 }） */
  requestBody?: Record<string, unknown>;
  /** 「应用到编辑器」回调（完整 HTML 代码块替换当前内容） */
  onApplyHtml?: (html: string) => void;
  /** 「应用修改」回调（补丁块应用到当前内容） */
  onApplyPatch?: (content: string) => void;
  /** 通知回调（复制代码等轻提示） */
  onNotify?: AiRichNotify;
  /** 错误上报（上传失败、会话流错误等） */
  onError?: AiRichErrorHandler;
  /** 媒体能力（上传 / 媒体库）：对话附件与代码面板插入共用 */
  media?: AiRichMediaConfig;
  /** 链接与图片地址的白名单选项（宿主可追加协议） */
  urlOptions?: SanitizeUrlOptions;
  /** 最新的源片段：每条发出的用户消息都会附带一份 */
  currentSource?: string;
}

/** 供宿主在 <chat.AppChat/> 外层提供运行期配置 */
export const EditorCfgContext = createContext<EditorChatConfig>({});

// ---- createChatHook options（模块作用域固定；connection/onFinish 由各实例经 overrides 注入） ----
const chatOptions = {};

/** 每实例 chat 覆盖项：connection 为包内自研的 OpenAI 适配器 */
export interface InstanceChatOverrides {
  /** OpenAI Chat Completions 连接适配器 */
  connection: ConnectConnectionAdapter;
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

/** 消息 metadata 里携带的已上传附件（键名由包内约定，逐项校验后使用） */
function readMessageAttachments(message: UIMessage): SentAttachment[] {
  const raw = (message.metadata as Record<string, unknown> | undefined)
    ?.easyxAttachments;
  return parseSentAttachments(raw);
}

/** 已上传附件 → 只读附件条所需形态（进度视为完成） */
function toReadonlyAttachments(items: SentAttachment[]): PendingAttachment[] {
  return items.map((item, index) => ({
    id: `sent-${index}`,
    kind: item.kind,
    name: item.name,
    size: item.size,
    url: item.url,
    progress: 1,
  }));
}

/**
 * 组装每次发送的保留字段与透传请求体
 *
 * systemPrompt / sendImagesAsMultimodal 是适配器的保留键（会被摘出并单独处理），
 * 其余字段（requestBody）原样合并进 OpenAI 请求体。保留键放在最后，避免被透传字段覆盖。
 */
export function buildSendBody(
  cfg: Pick<
    EditorChatConfig,
    'requestBody' | 'systemPrompt' | 'sendImagesAsMultimodal'
  >,
): Record<string, unknown> {
  return {
    ...cfg.requestBody,
    systemPrompt: cfg.systemPrompt ?? buildDefaultSystemPrompt(),
    sendImagesAsMultimodal: cfg.sendImagesAsMultimodal ?? true,
  };
}

/**
 * 构建每个实例的 chat 运行时覆盖项（connection / onFinish）。
 * createChatHook 的 options 在模块作用域固定，而连接信息是每实例动态值，
 * 故经 useAppChat 的 overrides 注入（运行时 {...options, ...overrides} 覆盖同名字段），
 * 使多实例互不串线。
 */
export function createInstanceChatOverrides(
  endpointUrlRef: { current: string },
  modelRef: { current: string },
  requestHeadersRef: { current: AiRichRequestHeaders | undefined },
  onCompleteRef: { current: ((content: string) => void) | undefined },
): InstanceChatOverrides {
  return {
    connection: createOpenAiConnection({
      endpointUrl: endpointUrlRef,
      model: modelRef,
      requestHeaders: requestHeadersRef,
    }),
    onFinish: (message: UIMessage) => {
      const content = textOf(message);
      if (content.trim()) onCompleteRef.current?.(content);
    },
  };
}

// ---- UI 组件 ----

/** 标记某条消息当前是否正在流式生成（区分「思考中」与「已思考」） */
const MessageStreamContext = createContext(false);

/**
 * 标记某条消息是不是最后一条
 *
 * 补丁卡片的「应用修改」只对最后一条开放：补丁不自动落地，最后一轮时当前源片段
 * 仍等于该补丁对应的内容；旧卡片的 SEARCH 可能已被后续回复改掉，应用会误伤。
 * 完整片段卡片不受此限（「应用到编辑器」正是回退历史版本的入口）。
 */
const MessageLatestContext = createContext(false);

/** 消息壳：user 右对齐填充气泡；assistant 无边框气泡（Parts 自动分发 text/thinking/fallback） */
function ChatMessage({ message, Parts }: MessageProps<typeof chatOptions>) {
  const chat = useChatContext();
  if (message.role === 'user') {
    // 发送时附在末尾的上下文块用于喂模型，气泡里还原：原话 + 附件条 + 片段/目标代码卡片
    const attachments = readMessageAttachments(message);
    const blocks = splitPromptBlocks(textOf(message));
    return (
      <div className="easyx-ai-rich-editor__bubble easyx-ai-rich-editor__bubble--user">
        {attachments.length > 0 && (
          <AttachmentBar
            attachments={toReadonlyAttachments(attachments)}
            variant="message"
          />
        )}
        {blocks.text && (
          <span className="easyx-ai-rich-editor__chat-user-text">
            {blocks.text}
          </span>
        )}
        {blocks.fragment && (
          <ContextCodeCard
            code={blocks.fragment}
            label="当前片段（随消息发送）"
          />
        )}
        {blocks.targets.map((html, index) => (
          <ContextCodeCard
            code={html}
            key={`${index}-${html.slice(0, 24)}`}
            label={
              blocks.targets.length > 1 ? `目标区域 ${index + 1}` : '目标区域'
            }
          />
        ))}
        {blocks.selectedText && (
          <span className="easyx-ai-rich-editor__chat-user-selection">
            选中：{blocks.selectedText}
          </span>
        )}
      </div>
    );
  }
  // 正在流式生成的必然是消息列表最后一条；按消息判定而非全局 isLoading，
  // 避免「已完成消息」也显示「思考中」，与进行中的串了
  const last = chat.messages.at(-1);
  const isStreaming = Boolean(chat.isLoading && last?.id === message.id);
  const isLatest = last?.id === message.id;
  return (
    <div className="easyx-ai-rich-editor__bubble easyx-ai-rich-editor__bubble--assistant">
      <MessageStreamContext.Provider value={isStreaming}>
        <MessageLatestContext.Provider value={isLatest}>
          <Parts />
        </MessageLatestContext.Provider>
      </MessageStreamContext.Provider>
    </div>
  );
}

/** 文本 part：markdown 渲染（```html 代码块「应用到编辑器」） */
function TextPart({ part }: PartProps<typeof chatOptions, 'text'>) {
  const cfg = useEditorCfg();
  const isLatest = useContext(MessageLatestContext);
  return (
    <MarkdownContent
      content={part.content}
      onApplyHtml={cfg.onApplyHtml}
      // 补丁只对最新一轮开放手动应用（旧补丁的 SEARCH 可能已失效）
      onApplyPatch={isLatest ? cfg.onApplyPatch : undefined}
      onError={cfg.onError}
      onNotify={cfg.onNotify}
      urlOptions={cfg.urlOptions}
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
        <MarkdownContent content={content} onError={cfg.onError} />
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
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // 新会话（消息清空）时一并清掉未发出的附件
  useEffect(() => {
    if (chat.messages.length === 0) setAttachments([]);
  }, [chat.messages.length]);

  /** 附件容量已满时提示（媒体库条目没有「类型未配置」问题） */
  const appendLibraryAttachment = (attachment: PendingAttachment) => {
    if (attachments.length >= MEDIA_ATTACHMENT_LIMIT) {
      cfg.onNotify?.(
        'warning',
        `一次最多添加 ${MEDIA_ATTACHMENT_LIMIT} 个附件`,
      );
      return;
    }
    setAttachments([...attachments, attachment]);
  };

  /** 粘贴 / 拖入 / 选择文件：先按类型校验上传能力，避免发送时才发现未配置 */
  const handleAddFiles = (files: File[]) => {
    const plan = planFileAttachments(
      files,
      cfg.media,
      attachments,
      MEDIA_ATTACHMENT_LIMIT,
    );
    for (const error of plan.errors) cfg.onError?.(error);
    for (const message of plan.warnings) cfg.onNotify?.('warning', message);
    if (plan.accepted.length > 0) {
      setAttachments([...attachments, ...plan.accepted]);
    }
  };

  const handlePickMedia = (pick: MediaPick) => {
    if (pick.type === 'upload') {
      handleAddFiles([pick.file]);
      return;
    }
    if (pick.type === 'library') {
      appendLibraryAttachment(createLibraryAttachment(pick.item, pick.kind));
    }
  };

  /**
   * 组装并发送：用户文本 + 附件清单 + 当前片段
   * 上下文块按固定顺序拼接，模型据此产出补丁；失败由 chat.error 驱动界面提示
   */
  const sendText = useCallback(
    async (text: string, items: SentAttachment[]) => {
      const content = [
        text,
        buildAttachmentBlock(items),
        buildCurrentFragmentBlock(cfg.currentSource ?? ''),
      ]
        .filter(Boolean)
        .join('\n\n');
      await chat.sendMessage(
        items.length > 0
          ? { content, metadata: { easyxAttachments: items } }
          : { content },
        { body: buildSendBody(cfg) },
      );
    },
    [chat, cfg],
  );

  /**
   * 发送：先把本地文件并发上传，再把附件清单与上下文块拼进消息文本
   * （模型需要真实地址与当前片段），附件明细同时写入 metadata 供气泡渲染。
   * 上传失败则不发送，保留输入与附件供重试。
   */
  const sendWithAttachments = async (value: string) => {
    setUploading(true);
    try {
      const sent = await Promise.all(
        attachments.map(async (attachment) => {
          if (attachment.url) return toSentAttachment(attachment);
          const file = attachment.file;
          if (!file) return undefined;
          const item = await uploadMediaFile(
            cfg.media,
            attachment.kind,
            file,
            (progress) => {
              setAttachments((prev) =>
                prev.map((current) =>
                  current.id === attachment.id
                    ? { ...current, progress }
                    : current,
                ),
              );
            },
          );
          // 记回地址：发送失败重试时不再重复上传
          setAttachments((prev) =>
            prev.map((current) =>
              current.id === attachment.id
                ? { ...current, url: item.url, progress: 1 }
                : current,
            ),
          );
          return toSentAttachment({ ...attachment, url: item.url });
        }),
      );
      const items = sent.filter(
        (item): item is SentAttachment => item !== undefined,
      );

      setInput('');
      setAttachments([]);
      sendText(value, items).catch(() => {});
    } catch (error) {
      cfg.onError?.(toError(error));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (text: string) => {
    if (chat.isLoading || uploading) return;
    const value = text.trim();
    if (!value && attachments.length === 0) return;
    void sendWithAttachments(value);
  };

  return (
    <ChatComposer
      attachments={attachments}
      loading={chat.isLoading}
      media={cfg.media}
      onAddFiles={handleAddFiles}
      onCancel={() => chat.stop()}
      onChange={setInput}
      onError={(error) => cfg.onError?.(error)}
      onPickMedia={handlePickMedia}
      onRemoveAttachment={(id) =>
        setAttachments((prev) => prev.filter((item) => item.id !== id))
      }
      onSubmit={handleSubmit}
      placeholder={CHAT_INPUT_PLACEHOLDER}
      uploading={uploading}
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

  // 会话流错误：对话区保留 Alert（属对话状态），同时向上抛给宿主的 onError
  const onErrorRef = useRef(cfg.onError);
  useEffect(() => {
    onErrorRef.current = cfg.onError;
  }, [cfg.onError]);
  useEffect(() => {
    if (chat.error) onErrorRef.current?.(chat.error);
  }, [chat.error]);

  const handlePreset = (preset: string) => {
    if (chat.isLoading) return;
    // 失败由 chat.error 驱动界面提示并上报 onError；此处吞掉 rejection 避免未处理 promise
    chat.sendMessage(preset, { body: buildSendBody(cfg) }).catch(() => {});
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
const useChatContext = chatHook.useChatContext;
