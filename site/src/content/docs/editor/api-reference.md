---
title: Editor API 参考
description: createEditor 的完整参数、实例方法、事件与媒体类型定义
---

## createEditor

```ts
import { createEditor } from '@easyx/editor';

const editor = createEditor(container: HTMLElement, options: EditorOptions);
```

在指定容器中创建编辑器实例，返回 `EditorInstance`。容器为空时抛出 `Error`。

## EditorOptions

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `defaultContent` | `EditorContentType` | — | 初始 HTML 内容 |
| `defaultTheme` | `EditorTheme` | `'light'` | 初始主题，同时决定表格增强套件主题 |
| `placeholder` | `string` | `'输入内容…'` | 空内容时的占位文字 |
| `readOnly` | `boolean` | `false` | 只读模式 |
| `autoFocus` | `boolean` | `false` | 创建后自动聚焦 |
| `height` | `number \| 'auto' \| string` | `'auto'` | 见[高度模式](/easyx/editor/height/) |
| `minHeight` | `number \| string` | — | 最小高度，`number` 视为 `px` |
| `maxHeight` | `number \| string` | — | 最大高度，超出后内部滚动 |
| `resizable` | `boolean` | `false` | 右下角拖拽手柄调节高度 |
| `image` | `EditorImageConfig` | — | 图片上传、媒体库与缩放配置 |
| `video` | `MediaUploadConfig` | — | 视频上传与媒体库配置 |
| `audio` | `MediaUploadConfig` | — | 音频上传与媒体库配置 |
| `attachment` | `MediaUploadConfig` | — | 附件上传与媒体库配置 |
| `onChange` | `(content: EditorContentType) => void` | — | 内容变更回调 |
| `onReady` | `() => void` | — | 初始化完成回调 |
| `onFocus` | `() => void` | — | 聚焦回调 |
| `onBlur` | `() => void` | — | 失焦回调 |
| `onDestroy` | `() => void` | — | 销毁回调 |

## 实例方法

### 内容操作

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getHTML()` | `string` | 获取 HTML 内容 |
| `setHTML(html)` | `void` | 设置 HTML 内容 |
| `getJSON()` | `Record<string, unknown>` | 获取 ProseMirror JSON |
| `setJSON(json)` | `void` | 设置 ProseMirror JSON |
| `getText()` | `string` | 获取纯文本 |
| `clear()` | `void` | 清空内容 |
| `isEmpty()` | `boolean` | 是否为空 |

### 状态与控制

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `setTheme(theme)` | `void` | 切换主题（`EditorTheme`），同步表格主题 |
| `focus()` / `blur()` | `void` | 聚焦 / 失焦 |
| `isFocused()` | `boolean` | 是否聚焦 |
| `enable()` / `disable()` | `void` | 启用 / 禁用编辑 |
| `isDisabled()` | `boolean` | 是否禁用 |
| `getContainer()` | `HTMLElement` | 获取挂载容器 |
| `destroy()` | `void` | 销毁实例，清理 DOM 与事件监听 |

### 事件系统

| 方法 | 说明 |
|------|------|
| `on(event, handler)` | 监听事件 |
| `off(event, handler)` | 移除监听 |
| `once(event, handler)` | 监听一次 |
| `emit(event, ...args)` | 触发事件 |

## 事件

| 事件 | 参数 | 触发时机 |
|------|------|----------|
| `change` | `content: string` | 内容变更 |
| `ready` | — | 初始化完成 |
| `focus` | — | 获得焦点 |
| `blur` | — | 失去焦点 |
| `destroy` | — | 实例销毁 |
| `uploadError` | `file: File, error: unknown` | 粘贴 / 拖入上传失败 |

```ts
editor.on('change', (content) => console.log(content));
editor.on('uploadError', (file, error) => console.error(file.name, error));
```

## 媒体类型

### MediaUploadConfig

| 字段 | 类型 | 说明 |
|------|------|------|
| `upload` | `(file: File, onProgress?: MediaUploadProgress) => Promise<MediaItem>` | 上传单个文件 |
| `getList` | `(params: MediaListParams) => Promise<MediaListResult>` | 媒体库分页查询，提供后出现「媒体库」页签 |

### EditorImageConfig

在 `MediaUploadConfig` 基础上增加图片专属选项：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `resizable` | `boolean` | `true` | 是否启用图片拖拽缩放 |

### MediaItem

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 媒体唯一标识 |
| `url` | `string` | 资源地址 |
| `name` | `string` | 显示名称 |
| `size` | `number` | 文件大小（字节） |
| `thumbnailUrl` | `string` | 缩略图地址 |
| `duration` | `number` | 时长（音视频，单位由宿主约定） |
| `fileType` | `string` | 文件类型 |

### MediaListParams

| 字段 | 类型 | 说明 |
|------|------|------|
| `page` | `number` | 页码，从 1 开始 |
| `pageSize` | `number` | 每页条数 |
| `keyword` | `string` | 搜索关键词 |

### MediaListResult

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | `MediaItem[]` | 当前页数据 |
| `total` | `number` | 总数 |

## 媒体能力

图片、视频、音频、附件统一支持三种插入方式（工具栏媒体按钮下拉，Tab 切换）：

- **上传**：调用对应类型的 `upload`
- **网络地址**：直接粘贴 URL
- **媒体库**：调用 `getList` 浏览选择；未配置时该页签隐藏

### 图片

- **拖拽缩放**：选中图片后拖动四角手柄调整像素宽度；`resizable: false` 可关闭
- **宽度百分比**：选中浮层中按百分比设置宽度
- **对齐**：左 / 中 / 右，序列化为 `data-align`
- **选中浮层**：对齐、宽度、替代文本（alt）、删除、查看原图

### 视频

视频节点序列化到 `<video>` 标签，选中浮层可设置以下属性：

| 属性 | 说明 |
|------|------|
| `data-align` | 对齐方式，渲染在 wrapper 上 |
| `poster` | 封面地址，空值清除 |
| `controls` | 是否显示原生控制器，默认开启 |
| `autoplay` | 是否自动播放，默认关闭 |

音频与附件同样支持上传、网络地址、媒体库三种插入方式。

## 内置扩展

`createEditor` 已注册全部扩展，无需手动配置：

| 分组 | 扩展 |
|------|------|
| 基础编辑 | StarterKit（加粗 / 斜体 / 标题 / 列表 / 引用 / 代码块 / 撤销等） |
| 文本样式 | TextStyle、Color、BackgroundColor、FontSize、FontFamily、LineHeight |
| 段落 | TextAlign、Indent |
| 特殊标记 | Subscript、Superscript、Typography |
| 列表 | TaskList、TaskItem |
| 表格 | TableKit、TablePlus |
| 占位 | Placeholder |
| 气泡菜单 | BubbleMenu（文本选区）、imageBubbleMenu、videoBubbleMenu |
| 链接 | LinkOpen（`Cmd/Ctrl+Click` 与 `Alt+Enter` 打开链接） |
| 媒体 | ImageUpload、VideoNode、AudioNode、AttachmentNode |

## 公开类型

| 类型 | 说明 |
|------|------|
| `EditorOptions` | `createEditor` 配置项 |
| `EditorTheme` | `'light' \| 'dark'` |
| `EditorContentType` | 内容类型，等价 `string` |
| `EditorImageConfig` | 图片媒体配置（`MediaUploadConfig` + `resizable`） |
| `MediaUploadConfig` / `MediaItem` / `MediaListParams` / `MediaListResult` | 媒体契约，与 [`@easyx/ai-rich-editor`](/easyx/ai-rich-editor/api-reference/) 同名同形 |
| `MediaUploadProgress` | 上传进度回调 `(progress: number) => void` |
| `EditorEventHandler` | 事件监听回调 `(...args: unknown[]) => void` |
