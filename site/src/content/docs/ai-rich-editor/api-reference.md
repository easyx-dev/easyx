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
| `endpointUrl` | `string` | — | **必填**，对话流式 SSE 端点 |
| `requestMeta` | `Record<string, unknown>` | — | 随每次对话请求透传的服务端元数据 |
| `height` | `number \| string` | `640` | 工作台整体高度 |
| `config` | `AiRichEditorConfig` | 见下 | 统一配置（**仅初始值，非受控**） |
| `onConfigChange` | `(config: AiRichEditorConfig) => void` | — | 设置面板保存后回写（用于宿主持久化） |

## AiRichEditorConfig

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `autoApply` | `boolean` | `true` | AI 回复后自动应用到编辑器 |
| `systemPrompt` | `string` | 内置模板 | 自定义 system 提示词 |
| `previewHead` | `string` | — | 预览 `<head>` 附加代码（原始 HTML） |
| `notify` | `AiRichNotify` | antd 静态提示 | 消息提示回调 |

`AiRichNotify` 签名：`(type: 'success' | 'warning' | 'error', content: string) => void`

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

## 类型

| 类型 | 说明 |
|------|------|
| `AiRichEditorProps` | 组件 Props |
| `AiRichEditorConfig` | 包配置项 |
| `AiRichNotify` | 消息提示回调 |
| `PreviewDevice` | 预览设备档位（`{ key, label, width?, height? }`） |

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
