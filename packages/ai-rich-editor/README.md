# @easyx/ai-rich-editor

AI 驱动的「代码编辑 + 实时预览」工作台（React 组件）：由对话生成自由 HTML 片段，产物自带样式作用域，可直接嵌入宿主内容字段。

[![npm version](https://img.shields.io/npm/v/@easyx/ai-rich-editor.svg)](https://www.npmjs.com/package/@easyx/ai-rich-editor)
[![license](https://img.shields.io/npm/l/@easyx/ai-rich-editor.svg)](https://github.com/easyx-dev/easyx/blob/main/LICENSE)

[文档](https://easyx-dev.github.io/easyx/ai-rich-editor/) · [演示](https://easyx-dev.github.io/easyx/ai-rich-editor/demo/) · [API 参考](https://easyx-dev.github.io/easyx/ai-rich-editor/api-reference/)

定位为**另一种形态的富文本**：只产出可嵌入内容字段的 HTML 片段（fragment），不输出整页文档，与 [`@easyx/editor`](https://www.npmjs.com/package/@easyx/editor)（传统富文本）互补。

## 特性

- **标准 OpenAI 协议**：连接三件套 `endpointUrl` + `model` + `requestHeaders`，宿主后端只需 OpenAI 兼容，无需配套 SDK
- **实时预览**：设备档位、脚本开关、刷新与新窗口预览；可选并排代码面板（CodeMirror 6）
- **片段作用域化**：片段内 `<style>` 选择器自动加前缀，直接嵌入宿主页面不污染全局
- **媒体插入**：对话与代码面板两条路径，支持上传、网络地址与媒体库
- **文档解析**：Word / PDF 交给 AI，据此生成新片段或改写现有内容（可选依赖）
- **版本回退**：每条回复即一个完整版本，点历史代码卡片即可回退
- **UI 自研**：除 React 外不依赖任何 UI 库

## 安装

```bash
pnpm add @easyx/ai-rich-editor
```

`react` / `react-dom` 为 peer 依赖，需宿主自行安装；样式已内联进 JS 产物。

## 快速上手

```tsx
import { AiRichEditor, DEFAULT_HTML } from '@easyx/ai-rich-editor';
import { useState } from 'react';

export function MyPage() {
  const [html, setHtml] = useState(DEFAULT_HTML);

  return (
    <AiRichEditor
      value={html}
      onChange={setHtml}
      endpointUrl="/v1/chat/completions"
      model="gpt-4o-mini"
      requestHeaders={{ Authorization: 'Bearer sk-…' }}
    />
  );
}
```

对接协议、媒体与文档解析、通知与错误、主题等见 [使用指南](https://easyx-dev.github.io/easyx/ai-rich-editor/usage/)；Props 与全部导出见 [API 参考](https://easyx-dev.github.io/easyx/ai-rich-editor/api-reference/)。

## 许可

[MIT](https://github.com/easyx-dev/easyx/blob/main/LICENSE)

## 从 v1 迁移

v2 把媒体类型统一为与 `@easyx/editor` 相同的命名与形状，并规整回调类型名：

| v1 | v2 |
|----|----|
| `AiRichMediaItem` | `MediaItem` |
| `AiRichMediaListParams` / `AiRichMediaListResult` | `MediaListParams` / `MediaListResult` |
| `AiRichMediaUploadConfig` / `AiRichMediaUploadProgress` | `MediaUploadConfig` / `MediaUploadProgress` |
| `AiRichMediaKind` / `AiRichMediaConfig` | `MediaKind` / `MediaConfig` |
| `PreviewDevice` | `AiRichPreviewDevice` |
| `AiRichNotify` | `AiRichNotifyHandler` |
