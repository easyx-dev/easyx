/**
 * @easyx/ai-rich-editor 演示：对话生成 HTML 片段 + 实时预览
 *
 * 对话链路始终走真实实现（包内 OpenAI 适配器消费 SSE、流式同步到编辑器与预览）。
 * 默认模式在浏览器侧拦截演示端点、回放一段预录的 OpenAI 标准 SSE 流；
 * 经「模型连接」面板填入任意 OpenAI 兼容端点后，直接调用真实模型。
 *
 * 主题无需桥接：演示页把 data-theme 挂在 <html> 上，包内样式直接据此判定。
 */

import {
  AiRichEditor,
  type AiRichEditorTools,
  type AiRichMediaConfig,
  type AiRichMediaItem,
  DEFAULT_HTML,
} from '@easyx/ai-rich-editor';
import { createDefaultDocumentParser } from '@easyx/ai-rich-editor/parsers';
import { useEffect, useMemo, useState } from 'react';
import { ConnectPanel } from './ai-rich-editor-demo/ConnectPanel';
import {
  clearConnection,
  DEFAULT_CONNECTION,
  type DemoConnection,
  readConnection,
  resolveConnection,
  writeConnection,
} from './ai-rich-editor-demo/connection';
import {
  installFetchMock,
  MOCK_ENDPOINT,
} from './ai-rich-editor-demo/mock-stream';
import { findPreset } from './ai-rich-editor-demo/presets';

/**
 * 演示上传：延时后返回同源 Blob 地址
 *
 * 站点无服务端，用 Blob URL 让「上传 → 插入片段 → 预览显示」这条链路真实可跑；
 * 注意 Blob 地址服务端取不到，因此真实模型模式下图片不会作为多模态输入。
 */
function uploadToBlobUrl(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<AiRichMediaItem> {
  return new Promise((resolve) => {
    onProgress?.(0.35);
    window.setTimeout(() => {
      onProgress?.(1);
      resolve({
        fileType: file.type,
        id: file.name,
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
      });
    }, 450);
  });
}

/** 演示媒体库：内联 SVG 转 Blob 地址，避免依赖站点静态资源；模块级只建一次 */
let libraryCache: AiRichMediaItem[] | undefined;

function getLibraryItems(): AiRichMediaItem[] {
  if (libraryCache) return libraryCache;
  const make = (
    id: string,
    name: string,
    label: string,
    color: string,
    size: number,
  ): AiRichMediaItem => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" rx="12" fill="${color}"/><text x="120" y="90" font-family="system-ui" font-size="20" fill="#fff" text-anchor="middle">${label}</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    return {
      fileType: 'image/svg+xml',
      id,
      name,
      size,
      thumbnailUrl: url,
      url,
    };
  };
  libraryCache = [
    make('lib-1', '示例图-品牌蓝.svg', '示例图 A', '#1677ff', 1280),
    make('lib-2', '示例图-暖橙.svg', '示例图 B', '#f97316', 1340),
    make('lib-3', '示例图-青绿.svg', '示例图 C', '#0f766e', 1310),
  ];
  return libraryCache;
}

/** 演示媒体配置：图片/视频/音频/附件均可上传，媒体库共用同一份示例数据 */
function createDemoMedia(): AiRichMediaConfig {
  const getList = async () => {
    const items = getLibraryItems();
    return { items, total: items.length };
  };
  return {
    attachment: { upload: uploadToBlobUrl },
    audio: { getList, upload: uploadToBlobUrl },
    image: { getList, upload: uploadToBlobUrl },
    video: { getList, upload: uploadToBlobUrl },
  };
}

export default function AiRichEditorDemo() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  // 媒体配置只建一次，避免每次渲染重建 Blob 地址
  const [media] = useState(createDemoMedia);
  // 文档解析能力：浏览器端默认解析器（mammoth / unpdf 按需加载）
  const [tools] = useState<AiRichEditorTools>(() => ({
    parseDocument: createDefaultDocumentParser(),
  }));
  const [connection, setConnection] = useState<DemoConnection>(readConnection);
  const [panelOpen, setPanelOpen] = useState(false);

  const resolved = useMemo(() => resolveConnection(connection), [connection]);
  const statusLabel = resolved
    ? `${findPreset(connection.preset).label} · ${resolved.model}`
    : '内置回放';

  // 仅在未配置真实端点时拦截演示端点；切换模式即卸载/重装，无需重挂载编辑器
  useEffect(() => {
    if (resolved) return;
    return installFetchMock();
  }, [resolved]);

  const handleSave = (next: DemoConnection) => {
    writeConnection(next);
    setConnection(next);
    setPanelOpen(false);
  };

  const handleClear = () => {
    clearConnection();
    setConnection(DEFAULT_CONNECTION);
  };

  return (
    <div className="demo-editor-container">
      <div className="demo-control-bar">
        <button onClick={() => setPanelOpen((prev) => !prev)} type="button">
          {panelOpen ? '收起连接设置' : '模型连接'}
        </button>
        <span className="demo-control-bar-label">当前：{statusLabel}</span>
        <span className="demo-control-bar-hint">
          {resolved
            ? '媒体上传为本地 Blob，真实模型无法访问'
            : '内置回放零配置；支持添加 Word / PDF 交给 AI'}
        </span>
      </div>

      {panelOpen && (
        <ConnectPanel
          connection={connection}
          onClear={handleClear}
          onClose={() => setPanelOpen(false)}
          onSave={handleSave}
        />
      )}

      <div style={{ padding: 16 }}>
        <AiRichEditor
          endpointUrl={resolved?.endpointUrl ?? MOCK_ENDPOINT}
          height={620}
          media={media}
          model={resolved?.model ?? 'demo'}
          onChange={setHtml}
          // 演示里只接错误上报（打到控制台）；错误对用户的提示走包内轻提示
          onError={(error) => console.error(error)}
          requestHeaders={resolved?.requestHeaders}
          tools={tools}
          value={html}
        />
      </div>
    </div>
  );
}
