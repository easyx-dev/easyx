/**
 * AI Rich Editor 主容器：顶栏 + 左(预览，可选编辑器)/右(AI 对话) 两栏工作台
 * 默认两栏：左=预览区、右=AI 对话面板（min400/max600）；「编辑器」为顶栏开关，打开后在左栏与预览并排。
 * value / onChange 兼容受控注入；对话能力经 OpenAI 兼容端点（endpointUrl + model + requestHeaders）注入；
 * 包配置项统一收拢到 config（经设置面板编辑保存生效），函数型注入项（media/onNotify/onError）留在顶层
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInstanceChatOverrides,
  EditorCfgContext,
  useAppChat,
} from './chat/ChatProvider';
import { EditorPanel } from './components/EditorPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Toolbar } from './components/Toolbar';
import { DEFAULT_CONFIG, DEFAULT_HTML } from './constants';
import type { AiRichEditorConfig, AiRichEditorProps } from './types';
import { cx, SCOPE_CLASS } from './ui/cx';
import { createErrorReporter, defaultOnNotify } from './ui/feedback';
import { Splitter, SplitterPane } from './ui/Splitter';
import {
  buildPreviewDocument,
  currentHtmlFragment,
  lastHtmlFragment,
} from './utils/extract';
import { generateScopePrefix, scopedRichContent } from './utils/scope';
import { listAllowedSchemes, type SanitizeUrlOptions } from './utils/url';

/** 流式实时同步阈值：HTML 代码块累计新增达到该字符数时同步到编辑器+预览 */
const LIVE_SYNC_CHAR_THRESHOLD = 200;

export function AiRichEditor({
  value = DEFAULT_HTML,
  onChange,
  endpointUrl,
  model,
  requestHeaders,
  requestBody,
  media,
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
  // 运行期配置：config 作为初始值，设置面板保存后更新（不受 config 后续变化影响）
  const [runtimeConfig, setRuntimeConfig] = useState<AiRichEditorConfig>(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
  );
  const { autoApply, systemPrompt, previewHead, sendImagesAsMultimodal } =
    runtimeConfig;
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
  // 已应用过的 HTML 片段（用于流式实时同步判断「累计新增」的基准）
  const lastAppliedRef = useRef('');
  // 当前流式处理中的 assistant 消息 id（新一轮消息出现时重置同步基准）
  const lastStreamMsgIdRef = useRef<string | null>(null);

  // 流结束回调：AI 生成的 HTML 代码块自动应用到编辑器（保留手动按钮）；
  // 应用前先做样式作用域化（沿用实例级 scopePrefix），使产物自带 scope 前缀，宿主可直接当作 HTML 引入（不污染全局）
  const handleAiComplete = useCallback(
    (content: string) => {
      if (!autoApply) return;
      // 修改类回复可能先贴旧/分块内容再给最终产物，取最后一个代码块更贴近「改动后的完整片段」
      const html = lastHtmlFragment(content);
      if (html) {
        lastAppliedRef.current = html;
        onChange?.(scopedRichContent(html, scopePrefix));
      } else {
        notify?.('warning', '本次回复未检测到 HTML 代码块，已跳过自动应用');
      }
    },
    [autoApply, onChange, scopePrefix, notify],
  );

  // 「应用到编辑器」：AI 生成的代码块替换当前内容（同样先作用域化）
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

  // 流式实时同步：AI 生成中，最后一条 assistant 消息的 HTML 代码块累计新增达到阈值，
  // 即把当前已生成片段同步到编辑器与预览（作用域化沿用实例级 scopePrefix）
  useEffect(() => {
    if (!autoApply) return;
    const lastMsg = chat.messages.at(-1);
    if (lastMsg?.role !== 'assistant') return;
    // 新一轮 assistant 消息（如二次修改重写）出现时重置基准，避免因新片段更短导致长度差为负而漏同步
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
    const frag = currentHtmlFragment(full);
    if (!frag) return;
    if (
      frag.length - lastAppliedRef.current.length <
      LIVE_SYNC_CHAR_THRESHOLD
    ) {
      return;
    }
    lastAppliedRef.current = frag;
    onChange?.(scopedRichContent(frag, scopePrefix));
  }, [chat.messages, autoApply, onChange, scopePrefix]);

  const editorCfg = useMemo(
    () => ({
      media,
      onApplyHtml: handleApplyHtml,
      onError: reportError,
      onNotify: notify,
      requestBody,
      sendImagesAsMultimodal,
      systemPrompt,
      urlOptions,
    }),
    [
      systemPrompt,
      sendImagesAsMultimodal,
      requestBody,
      media,
      handleApplyHtml,
      notify,
      reportError,
      urlOptions,
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
                  html={value}
                  previewHead={previewHead}
                  reloadKey={reloadKey}
                  scriptsEnabled={scriptsEnabled}
                />
              </SplitterPane>
            </Splitter>
          ) : (
            <PreviewPanel
              deviceKey={deviceKey}
              html={value}
              previewHead={previewHead}
              reloadKey={reloadKey}
              scriptsEnabled={scriptsEnabled}
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
    </div>
  );
}
