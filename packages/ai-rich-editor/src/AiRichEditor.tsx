/**
 * AI Rich Editor 主容器：顶栏 + 左(预览，可选编辑器)/右(AI 对话) 两栏工作台
 * 默认两栏：左=预览区、右=AI 对话面板（min400/max600）；「编辑器」为顶栏开关，打开后在左栏与预览并排。
 * value / onChange 兼容受控注入；对话能力经 OpenAI 兼容端点（endpointUrl + model + requestHeaders）注入；
 * 包配置项统一收拢到 config（经设置面板编辑保存生效），函数型注入项（media/onNotify/onError）留在顶层
 *
 * 编辑模型：AI 与代码面板都作用于「源片段」（未作用域化的干净 HTML），作用域化只在输出/预览时派生；
 * 修改类回复给出「改动后的完整片段」，客户端整段替换（对话历史即版本序列）；
 * 模型若仍输出差异补丁，则只渲染为卡片供手动应用，不自动落地。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildSendBody,
  createInstanceChatOverrides,
  EditorCfgContext,
  useAppChat,
} from './chat/ChatProvider';
import {
  buildCurrentFragmentBlock,
  buildTargetBlock,
} from './chat/prompt-blocks';
import { EditorPanel } from './components/EditorPanel';
import { HelpPanel } from './components/HelpPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Toolbar } from './components/Toolbar';
import { DEFAULT_CONFIG, DEFAULT_HTML } from './constants';
import type { AiRichEditorConfig, AiRichEditorProps } from './types';
import { cx, SCOPE_CLASS } from './ui/cx';
import { createErrorReporter, defaultOnNotify } from './ui/feedback';
import { Splitter, SplitterPane } from './ui/Splitter';
import type { PreviewTarget } from './utils/blocks';
import { buildPreviewDocument, lastHtmlFragment } from './utils/extract';
import {
  applyPatchBlocks,
  hasPatchMarker,
  parseEditReply,
  parsePatchBlocks,
} from './utils/patch';
import {
  generateScopePrefix,
  scopedRichContent,
  unscopeRichContent,
} from './utils/scope';
import { listAllowedSchemes, type SanitizeUrlOptions } from './utils/url';

/** 流式实时同步：只同步「已闭合」的完整片段（见下） */

/** 程序化发送一条用户消息（预览右键定向修改） */
interface ProgrammaticSendInput {
  text: string;
  /** 预览右键选中的目标区域（可多个） */
  targets?: PreviewTarget[];
}

type ProgrammaticSend = (input: ProgrammaticSendInput) => void;

export function AiRichEditor({
  value = DEFAULT_HTML,
  onChange,
  endpointUrl,
  model,
  requestHeaders,
  requestBody,
  media,
  tools,
  allowedUrlSchemes,
  onNotify,
  onError,
  height = 640,
  config,
  onConfigChange,
}: AiRichEditorProps) {
  // 作用域前缀：实例（会话）创建时生成一次并一直沿用，避免每次应用换随机前缀导致前缀漂移/重复包裹
  const [scopePrefix] = useState(() => generateScopePrefix());
  const [showEditor, setShowEditor] = useState(false);
  const [deviceKey, setDeviceKey] = useState('desktop');
  const [scriptsEnabled, setScriptsEnabled] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // 运行期配置：config 作为初始值，设置面板保存后更新（不受 config 后续变化影响）
  const [runtimeConfig, setRuntimeConfig] = useState<AiRichEditorConfig>(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
  );
  const {
    autoApply,
    systemPrompt,
    previewHead,
    sendImagesAsMultimodal,
    previewEditMenu,
  } = runtimeConfig;
  // 通知与错误各走各的通道：宿主注入即完全接管，未注入用包内兜底
  const notify = onNotify ?? defaultOnNotify;
  // 错误一律先经通知呈现给用户，再上报错误实例（见 createErrorReporter）
  const reportError = useMemo(
    () => createErrorReporter({ notify: onNotify, onError }),
    [onNotify, onError],
  );
  // 链接与媒体地址的白名单选项（宿主可追加协议，不能移除默认项）
  const urlOptions = useMemo<SanitizeUrlOptions>(
    () => ({ extraSchemes: allowedUrlSchemes }),
    [allowedUrlSchemes],
  );

  // 源片段：编辑与 AI 补丁都作用于此；作用域化只在输出/预览时派生
  const source = useMemo(
    () => unscopeRichContent(value, scopePrefix),
    [value, scopePrefix],
  );
  const sourceRef = useRef(source);
  sourceRef.current = source;
  // 已应用过的源片段（避免同一片段重复落地）
  const lastAppliedRef = useRef('');
  // 当前流式处理中的 assistant 消息 id（新一轮消息出现时重置同步基准）
  const lastStreamMsgIdRef = useRef<string | null>(null);

  // 流结束回调：以「完整片段」为主——每次回复都整体替换，对话历史即版本序列；
  // 若模型仍输出补丁格式，则不自动应用（保留卡片，可在气泡里手动应用）
  const handleAiComplete = useCallback(
    (content: string) => {
      if (!autoApply) return;
      const reply = parseEditReply(content);

      if (reply.kind === 'html') {
        lastAppliedRef.current = reply.html;
        onChange?.(scopedRichContent(reply.html, scopePrefix));
        return;
      }

      if (reply.kind === 'patch') {
        notify?.(
          'warning',
          '本次回复是差异补丁而非完整片段，未自动应用；可点卡片上的「应用修改」，或让 AI 重新给出完整片段',
        );
        return;
      }

      if (reply.kind === 'invalid') {
        notify?.('warning', reply.errors.join('；'));
        return;
      }

      notify?.('warning', '本次回复未检测到可应用的内容，已跳过自动应用');
    },
    [autoApply, onChange, scopePrefix, notify],
  );

  // 「应用修改」：手动把补丁块应用到当前源片段（autoApply 关闭时的入口）
  const handleApplyPatch = useCallback(
    (content: string) => {
      const blocks = parsePatchBlocks(content);
      if (blocks.length === 0) {
        notify?.('warning', '补丁块不完整，无法应用');
        return;
      }
      const outcome = applyPatchBlocks(sourceRef.current, blocks);
      if (!outcome.ok) {
        notify?.('error', '补丁未能应用：SEARCH 文本未命中或命中不唯一');
        return;
      }
      onChange?.(scopedRichContent(outcome.result, scopePrefix));
    },
    [notify, onChange, scopePrefix],
  );

  // 「应用到编辑器」：AI 生成的完整片段整体替换当前内容
  const handleApplyHtml = useCallback(
    (html: string) => onChange?.(scopedRichContent(html, scopePrefix)),
    [onChange, scopePrefix],
  );

  // 顶栏「新窗口预览」：以同源 about:blank 写入完整文档。
  // 说明：内容为受信编辑器产物，与预览 iframe（allow-scripts + allow-same-origin）同权；
  // 采用 document.write 是为保住同源相对资源（Blob URL 会脱离同源导致资源失效）。
  const handleOpenInNewWindow = useCallback(() => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    // value 在应用时刻已作用域化，此处直接构造文档外壳
    win.document.write(buildPreviewDocument(value, previewHead));
    win.document.close();
  }, [value, previewHead]);

  // 每实例 chat 连接信息：endpointUrl / model / requestHeaders 经 overrides 注入，多实例互不串线；
  // 三者都在每次请求时从 ref 读取，因此宿主更换连接后无需重挂载
  const endpointUrlRef = useRef(endpointUrl);
  useEffect(() => {
    endpointUrlRef.current = endpointUrl;
  }, [endpointUrl]);
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  const requestHeadersRef = useRef(requestHeaders);
  useEffect(() => {
    requestHeadersRef.current = requestHeaders;
  }, [requestHeaders]);
  const onCompleteRef = useRef<((content: string) => void) | undefined>(
    handleAiComplete,
  );
  useEffect(() => {
    onCompleteRef.current = handleAiComplete;
  }, [handleAiComplete]);

  const chatOverrides = useMemo(
    () =>
      createInstanceChatOverrides(
        endpointUrlRef,
        modelRef,
        requestHeadersRef,
        onCompleteRef,
      ),
    [],
  );
  // 对话实例（headless UI）：连接信息与结束回调经 overrides 注入，多实例互不串线
  const chat = useAppChat(chatOverrides);

  /** 程序化发送：直接在容器内组装消息经 chat 发出，不经输入框，避免依赖子组件的临时通道 */
  const sendUserMessage = useCallback<ProgrammaticSend>(
    (input) => {
      const content = [
        input.text,
        buildCurrentFragmentBlock(sourceRef.current),
        ...(input.targets ?? []).map((target) => buildTargetBlock(target)),
      ]
        .filter(Boolean)
        .join('\n\n');
      chat
        .sendMessage(
          { content },
          {
            body: buildSendBody({
              requestBody,
              sendImagesAsMultimodal,
              systemPrompt,
            }),
          },
        )
        .catch(() => {});
    },
    [chat, requestBody, sendImagesAsMultimodal, systemPrompt],
  );

  // 预览区右键「用 AI 修改」：把目标区域（可多个）与指令交给对话发送
  const handlePreviewEdit = useCallback(
    (targets: PreviewTarget[], instruction: string) => {
      if (chat.isLoading) {
        notify?.('warning', 'AI 正在回复，请稍候再改');
        return;
      }
      sendUserMessage({ text: instruction, targets });
    },
    [chat.isLoading, notify, sendUserMessage],
  );

  // 流式实时同步：回复里出现**已闭合**的完整片段才落地到编辑器与预览。
  // 不在未闭合时同步——半成品可能是被上游长度截断的残缺 HTML，写进去会留下坏文档。
  useEffect(() => {
    if (!autoApply) return;
    const lastMsg = chat.messages.at(-1);
    if (lastMsg?.role !== 'assistant') return;
    // 新一轮 assistant 消息出现时重置基准
    if (lastStreamMsgIdRef.current !== lastMsg.id) {
      lastStreamMsgIdRef.current = lastMsg.id;
      lastAppliedRef.current = '';
    }
    let full = '';
    for (const part of lastMsg.parts) {
      if (part.type === 'text' && typeof part.content === 'string') {
        full += part.content;
      }
    }
    // 补丁块不在此落地（仅作兜底，需手动应用）
    if (hasPatchMarker(full)) return;
    const frag = lastHtmlFragment(full);
    if (!frag || frag === lastAppliedRef.current) return;
    lastAppliedRef.current = frag;
    onChange?.(scopedRichContent(frag, scopePrefix));
  }, [chat.messages, autoApply, onChange, scopePrefix]);

  const editorCfg = useMemo(
    () => ({
      media,
      tools,
      onApplyHtml: handleApplyHtml,
      onApplyPatch: handleApplyPatch,
      onError: reportError,
      onNotify: notify,
      requestBody,
      sendImagesAsMultimodal,
      systemPrompt,
      urlOptions,
      currentSource: source,
    }),
    [
      systemPrompt,
      sendImagesAsMultimodal,
      requestBody,
      media,
      tools,
      handleApplyHtml,
      handleApplyPatch,
      notify,
      reportError,
      urlOptions,
      source,
    ],
  );

  // 代码面板的媒体插入：共用实例级媒体配置、协议白名单与错误上报
  const codePanelCfg = useMemo(
    () => ({
      allowedUrlSchemes,
      media,
      onError: reportError,
    }),
    [media, allowedUrlSchemes, reportError],
  );

  // 设置面板保存：回写运行期配置并通知宿主
  const handleSaveSettings = useCallback(
    (cfg: AiRichEditorConfig) => {
      setRuntimeConfig(cfg);
      onConfigChange?.(cfg);
      setSettingsOpen(false);
    },
    [onConfigChange],
  );

  return (
    <div
      className={cx('easyx-ai-rich-editor', SCOPE_CLASS)}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <Toolbar
        deviceKey={deviceKey}
        html={value}
        onDeviceKeyChange={setDeviceKey}
        onError={reportError}
        onNotify={notify}
        onOpenInNewWindow={handleOpenInNewWindow}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onRefresh={() => setReloadKey((k) => k + 1)}
        onToggleEditor={() => setShowEditor((prev) => !prev)}
        onToggleScripts={() => setScriptsEnabled((prev) => !prev)}
        scriptsEnabled={scriptsEnabled}
        showEditor={showEditor}
      />

      <Splitter className="easyx-ai-rich-editor__body">
        {/* 左栏：预览区（编辑器开启时与编辑器并排） */}
        <SplitterPane>
          {showEditor ? (
            <Splitter className="easyx-ai-rich-editor__body-inner">
              <SplitterPane min={300}>
                <EditorPanel
                  allowedUrlSchemes={codePanelCfg.allowedUrlSchemes}
                  media={codePanelCfg.media}
                  onChange={onChange}
                  onError={codePanelCfg.onError}
                  value={value}
                />
              </SplitterPane>
              <SplitterPane min={320}>
                <PreviewPanel
                  deviceKey={deviceKey}
                  editMenuEnabled={previewEditMenu !== false}
                  onNotify={notify}
                  onSubmitEdit={handlePreviewEdit}
                  previewHead={previewHead}
                  reloadKey={reloadKey}
                  scopePrefix={scopePrefix}
                  scriptsEnabled={scriptsEnabled}
                  source={source}
                />
              </SplitterPane>
            </Splitter>
          ) : (
            <PreviewPanel
              deviceKey={deviceKey}
              editMenuEnabled={previewEditMenu !== false}
              onNotify={notify}
              onSubmitEdit={handlePreviewEdit}
              previewHead={previewHead}
              reloadKey={reloadKey}
              scopePrefix={scopePrefix}
              scriptsEnabled={scriptsEnabled}
              source={source}
            />
          )}
        </SplitterPane>

        {/* 右栏：AI 对话面板 */}
        <SplitterPane defaultSize={420} max={600} min={400}>
          <EditorCfgContext.Provider value={editorCfg}>
            <chat.AppChat />
          </EditorCfgContext.Provider>
        </SplitterPane>
      </Splitter>

      <SettingsPanel
        config={runtimeConfig}
        errorConfigured={Boolean(onError)}
        notifyConfigured={Boolean(onNotify)}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        open={settingsOpen}
        urlSchemes={listAllowedSchemes(urlOptions)}
      />

      <HelpPanel onClose={() => setHelpOpen(false)} open={helpOpen} />
    </div>
  );
}
