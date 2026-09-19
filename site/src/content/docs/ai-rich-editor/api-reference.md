---
title: API 参考
description: AI Rich Editor 组件 Props、配置项与导出清单
---

# API 参考

## AiRichEditorProps

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `string` | `DEFAULT_HTML` | 当前 HTML 内容（兼容受控注入） |
| `onChange` | `(value: string) => void` | — | 内容变化回调（应用时刻已作用域化） |
| `endpointUrl` | `string` | — | **必填**，对话流式端点（**OpenAI Chat Completions 兼容**，如 `/v1/chat/completions`） |
| `model` | `string` | — | **必填**，模型名（`gpt-4o-mini` / `deepseek-chat` …） |
| `requestHeaders` | `AiRichRequestHeaders` | — | 请求头（鉴权等），静态对象或每次请求求值的函数 |
| `requestBody` | `Record<string, unknown>` | — | 追加进请求体的字段（如 `temperature`）；`model` / `stream` / `messages` 不可覆盖 |
| `media` | `AiRichMediaConfig` | — | 媒体能力（上传 / 媒体库），**顶层属性，非 config** |
| `tools` | `AiRichEditorTools` | — | 宿主注入的能力集合；目前含文档解析 `parseDocument`（Word / PDF），**顶层属性，非 config** |
| `allowedUrlSchemes` | `readonly string[]` | `[]` | 追加允许的 URL 协议（只增不减） |
| `onNotify` | `AiRichNotify` | 包内置轻提示 | 通知上报（成功 / 提醒 / 错误的可见文案） |
| `onError` | `(error: Error) => void` | `console.error` | 错误上报（错误实例，不负责可见提示） |
| `height` | `number \| string` | `640` | 工作台整体高度 |
| `config` | `AiRichEditorConfig` | 见下 | 统一配置（**仅初始值，非受控**） |
| `onConfigChange` | `(config: AiRichEditorConfig) => void` | — | 设置面板保存后回写（用于宿主持久化） |

## AiRichEditorConfig

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoApply` | `boolean` | `true` | AI 回复后自动应用到编辑器 |
| `systemPrompt` | `string` | 内置模板 | 自定义 system 提示词（作为 `messages[0]` 的 system 发送） |
| `previewHead` | `string` | — | 预览 `<head>` 附加代码（原始 HTML） |
| `sendImagesAsMultimodal` | `boolean` | `true` | 图片附件以多模态 content parts 发送；关闭后兼容纯文本网关 |

## 通知与错误

错误会**同时**走两条通道：可见文案走 `onNotify`，错误实例走 `onError`。

| 通道 | 类型 | 承载 | 未注入时的兜底 |
|------|------|------|----------------|
| `onNotify` | `AiRichNotify` | 用户可见文案（成功 / 提醒 / 错误） | 包内置轻提示 |
| `onError` | `AiRichErrorHandler` | 错误实例（日志 / 上报 / 分支） | `console.error`（不上浮 UI） |

`AiRichNotify` 签名：`(type: 'success' | 'warning' | 'error', content: string) => void`
`AiRichErrorHandler` 签名：`(error: Error) => void`（错误类：`MediaNotConfiguredError`、`InvalidMediaUrlError`）

## 设置面板

顶栏「设置」直接打开模态框（无下拉菜单）。模态框就地渲染在编辑器容器内（不 portal），高度随内容自适应、上限为容器的 90%，宽度上限 800px；只承载 `config` 的可编辑项，函数型注入项与协议清单为只读展示。

## AiRichMediaConfig

按媒体类型给出上传与媒体库能力；未配置的类型即不可用。

| 字段 | 类型 | 说明 |
|------|------|------|
| `image` / `video` / `audio` / `attachment` | `AiRichMediaUploadConfig` | 各类型的上传与媒体库配置（`attachment` 是其余文件的兜底） |

`AiRichMediaUploadConfig`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `upload` | `(file: File, onProgress?: (p: number) => void) => Promise<AiRichMediaItem>` | 上传接口；未配置时该类型不可添加 |
| `getList` | `(params: AiRichMediaListParams) => Promise<AiRichMediaListResult>` | 媒体库列表；决定「媒体库」入口是否出现 |

`AiRichMediaItem`：`{ id, url, name, size?, thumbnailUrl?, fileType? }`
`AiRichMediaListParams`：`{ page, pageSize, keyword? }`；`AiRichMediaListResult`：`{ items, total }`
`AiRichMediaKind`：`'image' | 'video' | 'audio' | 'attachment'`

## AiRichEditorTools

函数型能力集合（顶层 `tools` 属性）；`tools` 指宿主注入的能力函数，与模型 function/tool calling 无关。

| 字段 | 类型 | 说明 |
|------|------|------|
| `parseDocument` | `AiRichDocumentParser` | 文档解析（Word / PDF）：异步方法，本地或服务端皆可；不传则文档入口不出现 |

`AiRichDocumentParser`：`(file: File) => Promise<AiRichParsedDocument>`
`AiRichParsedDocument`：`{ name?, kind?, html?, text?, pageCount?, warnings? }`

`./parsers` 入口（可选 peer 依赖 `mammoth` / `unpdf` 按需加载）：

| 导出 | 类型 | 说明 |
|------|------|------|
| `createDefaultDocumentParser()` | `() => AiRichDocumentParser` | 按扩展名分派（`.docx` → HTML，`.pdf` → 文本） |
| `createDocxParser()` / `createPdfParser()` | `() => AiRichDocumentParser` | 只解析单一类型 |
| `UnsupportedDocumentError` / `DocumentParseError` | 错误类 | 供 `onError` 分支判断 |
| `resolveDocumentKind(fileName)` | `(fileName: string) => AiRichDocumentKind \| undefined` | 扩展名 → 类型 |
| `isDocumentFile(fileName, extensions?)` / `isLegacyDoc(fileName)` | `(…) => boolean` | 扩展名判定 / 旧版 `.doc` 判定 |
| `documentAccept(extensions?)` | `(extensions?) => string` | 文件选择框 accept |
| `DEFAULT_DOCUMENT_EXTENSIONS` | `readonly string[]` | 默认 `.docx` / `.pdf` |

详见[文档解析](./documents/)。

## 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `AiRichEditor` | 组件 | 主组件 |
| `DEFAULT_HTML` | `string` | 首次打开时的默认 HTML 片段 |
| `DEFAULT_CONFIG` | `AiRichEditorConfig` | 默认配置 |
| `DEFAULT_SYSTEM_PROMPT_TEMPLATE` | `string` | 内置 system 提示词模板 |
| `PRESET_PROMPTS` | `readonly string[]` | 空态推荐指令 |
| `PREVIEW_DEVICES` | `PreviewDevice[]` | 预览设备档位 |
| `buildDefaultSystemPrompt()` | `() => string` | 构建内置 system 提示词 |
| `extractHtmlFragments(content)` | `(content: string) => string[]` | 提取回复中的全部 HTML 代码块 |
| `buildPreviewDocument(html, head?)` | `(html: string, head?: string) => string` | 构建预览 iframe 文档 |
| `buildMediaSnippet(input)` | `(input: { kind, url, name?, size? }) => string \| undefined` | 生成自包含媒体片段（默认校验地址；宿主返回的地址可传 `{ trusted: true }` 跳过） |
| `mediaKindLabel(kind)` | `(kind: AiRichMediaKind) => string` | 媒体类型中文名 |
| `resolveMediaKind(fileType)` | `(fileType: string) => AiRichMediaKind` | 文件 MIME → 媒体类型 |
| `sanitizeUrl(url, options?)` | `(url: string, options?: { extraSchemes? }) => string \| undefined` | 地址协议白名单校验（不安全返回 `undefined`） |
| `listAllowedSchemes(options?)` | `(options?: { extraSchemes? }) => readonly string[]` | 当前生效的协议清单（默认 + 追加） |
| `MediaNotConfiguredError` / `InvalidMediaUrlError` | 错误类 | 供 `onError` 分支判断 |

## 类型

| 类型 | 说明 |
|------|------|
| `AiRichEditorProps` | 组件 Props |
| `AiRichEditorConfig` | 包配置项（仅可序列化项，经设置面板编辑） |
| `AiRichNotify` | 通知回调（成功 / 提醒） |
| `AiRichErrorHandler` | 错误上报回调 |
| `AiRichRequestHeaders` | 对话请求头（静态对象或求值函数） |
| `PreviewDevice` | 预览设备档位（`{ key, label, width?, height? }`） |
| `AiRichMediaConfig` | 媒体能力配置（按类型） |
| `AiRichMediaUploadConfig` | 单一类型的上传 + 媒体库配置 |
| `AiRichMediaItem` | 媒体条目（上传结果与列表项共用） |
| `AiRichMediaListParams` / `AiRichMediaListResult` | 媒体库分页参数与结果 |
| `AiRichMediaKind` | 媒体类型 |
| `AiRichMediaUploadProgress` | 上传进度回调 |
| `AiRichEditorTools` | 宿主注入的能力集合（`parseDocument`） |
| `AiRichDocumentParser` | 文档解析异步方法 |
| `AiRichParsedDocument` | 解析产物（`html` / `text` / `pageCount` / `warnings`） |
| `AiRichDocumentKind` | 文档类型 `'docx' \| 'pdf'` |

## CSS 变量

| 变量 | 说明 |
|------|------|
| `--easyx-ai-rich-editor-bg` | 面板背景色 |
| `--easyx-ai-rich-editor-bg-subtle` | 次级背景色（代码块、预览舞台） |
| `--easyx-ai-rich-editor-border` | 边框 / 分隔线色 |
| `--easyx-ai-rich-editor-text` | 主文字色 |
| `--easyx-ai-rich-editor-text-secondary` | 次级文字色 |
| `--easyx-ai-rich-editor-text-tertiary` | 弱化文字色 |
| `--easyx-ai-rich-editor-primary` | 强调色 |
| `--easyx-ai-rich-editor-shadow` | 浮层阴影 |
| `--easyx-ai-rich-editor-radius` | 圆角 |
| `--easyx-ai-rich-editor-preview-bg` | 预览画布背景（固定白底） |

亮暗两套取值由包内定义，宿主可在自己的选择器内覆盖任一变量。
