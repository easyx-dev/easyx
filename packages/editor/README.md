# @easyx/editor

零框架依赖的 Tiptap 富文本编辑器：工具栏、气泡菜单、媒体上传与表格增强开箱即用，可接入任何前端技术栈。

[![npm version](https://img.shields.io/npm/v/@easyx/editor.svg)](https://www.npmjs.com/package/@easyx/editor)
[![license](https://img.shields.io/npm/l/@easyx/editor.svg)](https://github.com/easyx-dev/easyx/blob/main/LICENSE)

[文档](https://easyx-dev.github.io/easyx/editor/) · [演示](https://easyx-dev.github.io/easyx/editor/demo/) · [API 参考](https://easyx-dev.github.io/easyx/editor/api-reference/)

## 特性

- **零框架依赖**：工具栏、气泡菜单与选中浮层均为原生 DOM，不引入 React / Vue
- **开箱即用**：内置文本样式、对齐缩进、上下标、任务列表、链接、表格等常用能力
- **表格增强**：集成 [`@easyx/tiptap-table-plus`](https://www.npmjs.com/package/@easyx/tiptap-table-plus)，支持单元格样式、选区手柄、右键菜单与块级背景色
- **媒体支持**：图片（对齐 / 拖拽缩放 / 替代文本）、视频（对齐 / 封面 / 控制器 / 自动播放）、音频、附件
- **粘贴与拖入上传**：按文件类型自动路由到对应媒体的 `upload`
- **高度与主题**：自适应 / 定高 / 最大高度 / 拖拽调节；亮暗主题经 CSS 变量控制

## 安装

```bash
pnpm add @easyx/editor
```

样式已内联进 JS 产物，无需单独引入 CSS。

## 快速上手

```ts
import { createEditor } from '@easyx/editor';

const container = document.querySelector<HTMLElement>('#editor')!;

const editor = createEditor(container, {
  placeholder: '请输入…',
  defaultTheme: 'light',
  height: 320,
  resizable: true,
  image: {
    upload: async (file) => ({
      id: file.name,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }),
  },
  onChange: (content) => console.log(content),
});

editor.setHTML('<p>Hello World</p>');
```

容器为空时 `createEditor` 抛错；实例方法、事件与媒体类型见 [API 参考](https://easyx-dev.github.io/easyx/editor/api-reference/)。

## 许可

[MIT](https://github.com/easyx-dev/easyx/blob/main/LICENSE)

## 从 v1 迁移

v2 统一了公开类型命名，行为不变：

| v1 | v2 |
|----|----|
| `EasyxEditorOptions` | `EditorOptions` |
| `ThemeType` | `EditorTheme` |
| `ContentType` | `EditorContentType` |
| `EventHandler` | `EditorEventHandler` |
| `UploadProgressCallback` | `MediaUploadProgress` |
| `ImageMediaUploadConfig` | `EditorImageConfig`（现为公开导出） |
