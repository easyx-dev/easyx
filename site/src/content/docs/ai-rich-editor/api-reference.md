---
title: AI Rich Editor API 参考
description: AiRichEditor 的 Props、配置项、媒体能力、文档解析、导出与类型定义
---

## AiRichEditorProps

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `string` | `DEFAULT_HTML` | 当前 HTML 内容 |
| `onChange` | `(value: string) => void` | — | 内容变化回调（应用时刻已作用域化） |
| `endpointUrl` | `string` | — | **必填**，OpenAI Chat Completions 兼容端点 |
| `model` | `string` | — | **必填**，模型名 |
| `requestHeaders` | `AiRichRequestHeaders` | — | 请求头，静态对象或每次请求求值的函数 |
| `requestBody` | `Record<string, unknown>` | — | 追加进请求体的字段；`model` / `stream` / `messages` 不可覆盖 |
| `media` | `MediaConfig` | — | 媒体能力（顶层属性，非 config） |
| `tools` | `AiRichEditorTools` | — | 宿主注入的能力集合，目前含文档解析 |
| `allowedUrlSchemes` | `readonly string[]` | `[]` | 追加允许的 URL 协议（只增不减） |
| `onNotify` | `AiRichNotifyHandler` | 包内置轻提示 | 通知上报（可见文案） |
| `onError` | `AiRichErrorHandler` | `console.error` | 错误上报（错误实例） |
| `height` | `number \| string` | `640` | 工作台整体高度 |
| `config` | `AiRichEditorConfig` | 见下 | 统一配置，**仅初始值、非受控** |
| `onConfigChange` | `(config: AiRichEditorConfig) => void` | — | 设置面板保存后回写，用于持久化 |

## AiRichEditorConfig

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoApply` | `boolean` | `true` | 回复结束后自动应用到编辑器 |
| `previewEditMenu` | `boolean` | `true` | 预览区右键「用 AI 修改」入口 |
| `systemPrompt` | `string` | 内置模板 | 自定义 system 提示词，作为 `messages[0]` 发送 |
| `previewHead` | `string` | — | 预览 `<head>` 附加代码（原始 HTML） |
| `sendImagesAsMultimodal` | `boolean` | `true` | 图片附件以多模态 content parts 发送 |

## 通知与错误

错误**同时**走两条通道：可见文案走 `onNotify`，错误实例走 `onError`。

| 通道 | 类型 | 承载 | 未注入时的兜底 |
|------|------|------|----------------|
| `onNotify` | `AiRichNotifyHandler` | 用户可见文案 | 包内置轻提示 |
| `onError` | `AiRichErrorHandler` | 错误实例 | `console.error`（不上浮 UI） |

```ts
type AiRichNotifyHandler = (
  type: 'success' | 'warning' | 'error',
  content: string,
) => void;

type AiRichErrorHandler = (error: Error) => void;
```

错误类：`MediaNotConfiguredError`、`InvalidMediaUrlError`。

## 媒体能力

媒体能力经顶层 `media` 按类型注入，未配置的类型即不可用。

```ts
interface MediaConfig {
  image?: MediaUploadConfig;
  video?: MediaUploadConfig;
  audio?: MediaUploadConfig;
  attachment?: MediaUploadConfig; // 其余文件的兜底
}

interface MediaUploadConfig {
  upload: (file: File, onProgress?: MediaUploadProgress) => Promise<MediaItem>;
  getList?: (params: MediaListParams) => Promise<MediaListResult>;
}

interface MediaItem {
  id: string;
  url: string;
  name: string;
  size?: number;
  thumbnailUrl?: string;
  fileType?: string;
}

type MediaKind = 'image' | 'video' | 'audio' | 'attachment';
```

`MediaItem` / `MediaListParams` / `MediaListResult` / `MediaUploadConfig` / `MediaKind` / `MediaUploadProgress` 与 [`@easyx/editor`](/easyx/editor/api-reference/) 共用同一套媒体契约，宿主接口可复用。

## 文档解析

`tools.parseDocument` 是异步方法，本地或服务端解析皆可；不传则文档入口不出现。

```ts
interface AiRichEditorTools {
  parseDocument?: AiRichDocumentParser;
}

type AiRichDocumentParser = (file: File) => Promise<AiRichParsedDocument>;

interface AiRichParsedDocument {
  name?: string;
  kind?: 'docx' | 'pdf';
  html?: string;
  text?: string;
  pageCount?: number;
  warnings?: string[];
}
```

`./parsers` 入口（可选 peer 依赖 `mammoth` / `unpdf` 按需加载）：

| 导出 | 说明 |
|------|------|
| `createDefaultDocumentParser()` | 按扩展名分派（`.docx` → HTML，`.pdf` → 文本） |
| `createDocxParser()` / `createPdfParser()` | 只解析单一类型 |
| `UnsupportedDocumentError` / `DocumentParseError` | 错误类，供 `onError` 分支判断 |
| `resolveDocumentKind(fileName)` | 扩展名 → 文档类型 |
| `isDocumentFile(fileName, extensions?)` / `isLegacyDoc(fileName)` | 扩展名判定 / 旧版 `.doc` 判定 |
| `documentAccept(extensions?)` | 文件选择框 accept |
| `DEFAULT_DOCUMENT_EXTENSIONS` | 默认扩展名清单 |

详见[文档解析](/easyx/ai-rich-editor/documents/)。

## 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `AiRichEditor` | 组件 | 主组件 |
| `DEFAULT_HTML` | `string` | 首次打开时的默认 HTML 片段 |
| `DEFAULT_CONFIG` | `AiRichEditorConfig` | 默认配置 |
| `DEFAULT_SYSTEM_PROMPT_TEMPLATE` | `string` | 内置 system 提示词模板 |
| `PRESET_PROMPTS` | `readonly string[]` | 空态推荐指令 |
| `PREVIEW_DEVICES` | `AiRichPreviewDevice[]` | 预览设备档位 |
| `buildDefaultSystemPrompt()` | `() => string` | 构建内置 system 提示词 |
| `extractHtmlFragments(content)` | `(content: string) => string[]` | 提取回复中的全部 HTML 片段 |
| `buildPreviewDocument(html, head?)` | `(html: string, head?: string) => string` | 构建预览 iframe 文档 |
| `buildMediaSnippet(input)` | `(input) => string \| undefined` | 生成自包含媒体片段（默认校验地址，宿主来源可传 `{ trusted: true }`） |
| `mediaKindLabel(kind)` | `(kind: MediaKind) => string` | 媒体类型中文名 |
| `resolveMediaKind(fileType)` | `(fileType: string) => MediaKind` | 文件 MIME → 媒体类型 |
| `sanitizeUrl(url, options?)` | `(url, options?) => string \| undefined` | 地址协议白名单校验（不安全返回 `undefined`） |
| `listAllowedSchemes(options?)` | `(options?) => readonly string[]` | 当前生效的协议清单 |
| `MediaNotConfiguredError` / `InvalidMediaUrlError` | 错误类 | 供 `onError` 分支判断 |

## 类型

| 类型 | 说明 |
|------|------|
| `AiRichEditorProps` | 组件 Props |
| `AiRichEditorConfig` | 可序列化配置（设置面板编辑） |
| `AiRichEditorTools` | 宿主注入的能力集合 |
| `AiRichNotifyHandler` / `AiRichErrorHandler` | 通知 / 错误回调 |
| `AiRichRequestHeaders` | 对话请求头（静态对象或求值函数） |
| `AiRichPreviewDevice` | 预览设备档位 `{ key, label, width?, height? }` |
| `MediaConfig` / `MediaUploadConfig` / `MediaItem` / `MediaListParams` / `MediaListResult` / `MediaKind` / `MediaUploadProgress` | 媒体契约 |
| `AiRichDocumentParser` / `AiRichParsedDocument` / `AiRichDocumentKind` | 文档解析 |

## CSS 变量

`--easyx-ai-rich-editor-*` 覆盖背景、边框、文字、主色、阴影、圆角、字号与层级等；`--easyx-ai-rich-editor-code-*` 覆盖代码面板的选区、当前行与语法高亮。亮暗两套取值由包内定义，宿主可在自己的选择器内覆盖任一变量。

| 变量 | 说明 |
|------|------|
| `--easyx-ai-rich-editor-bg` | 面板背景色 |
| `--easyx-ai-rich-editor-bg-subtle` | 次级背景色（代码块、预览舞台） |
| `--easyx-ai-rich-editor-border` | 边框 / 分隔线色 |
| `--easyx-ai-rich-editor-text` / `-text-secondary` / `-text-tertiary` | 文字色三级 |
| `--easyx-ai-rich-editor-primary` / `-primary-hover` / `-primary-soft` | 主色三态 |
| `--easyx-ai-rich-editor-shadow` / `-radius` | 浮层阴影 / 圆角 |
| `--easyx-ai-rich-editor-preview-bg` | 预览画布背景（固定白底） |
| `--easyx-ai-rich-editor-code-selection` / `-match` / `-active-line` | 代码面板选区与当前行 |
| `--easyx-ai-rich-editor-code-tag` / `-attr` / `-string` / `-keyword` / `-comment` … | 代码面板语法高亮 |
