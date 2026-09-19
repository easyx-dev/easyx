---
title: API 参考
description: Image Toolkit 两个入口的导出清单、引擎 API 与类型定义
---

# API 参考

## 根入口（同构纯逻辑）

### 常量

| 导出 | 说明 |
|------|------|
| `IMAGE_LIMITS` | 输入上限：`maxDimension` / `maxInputPixels` / `maxInputBytes` / `minQuality` / `maxQuality` |
| `PROCESSABLE_FORMATS` | 可编辑格式（能自动识别 + 解码 + 编码） |
| `OUTPUT_FORMATS` | 可输出格式 |
| `PALETTE_COLOR_PRESETS` | 调色板颜色数预设 |
| `MIN_PALETTE_COLORS` / `MAX_PALETTE_COLORS` | 调色板颜色数上下限 |
| `LOSSLESS_STRATEGIES` | 各格式无损策略表 |

### 函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `sniffImage` | `(bytes: Uint8Array) => ImageSniffResult \| null` | 魔数嗅探格式与尺寸，非图片返回 `null` |
| `isProcessableFormat` / `isOutputFormat` | `(format) => boolean` | 格式判定 |
| `isProcessableMimeType` / `isImageMimeType` | `(mime) => boolean` | MIME 判定 |
| `formatToMimeType` / `formatToExtension` / `mimeTypeToFormat` | — | 格式与 MIME / 扩展名互转 |
| `clampQuality` | `(quality: number) => number` | 质量钳制到合法区间 |
| `isValidPaletteColors` | `(colors: number) => boolean` | 调色板颜色数校验 |
| `getLosslessStrategy` | `(format) => LosslessStrategy \| null` | 取某格式的无损策略 |
| `isOptimizableLosslessly` | `(format) => boolean` | 是否可无损优化（保真等级可用 **且** 可编码输出） |
| `normalizeImageOperation` | `(operation) => ImageOperation` | 操作归一化（取整、钳制、拒绝非法结构） |
| `isImageOperationEffective` | `(operation) => boolean` | 是否产生实际变更 |
| `intersectCrop` | `(a, b) => ImageCrop \| null` | 裁切矩形求交 |
| `describeImageOperation` | `(operation) => string` | 生成中文描述 |
| `resolveScaledSize` | `(size, request, options?) => ImageSize` | 等比缩放换算（锁比例、禁放大、上下限钳制） |
| `scalePercent` | `(from, to) => number` | 缩放百分比 |
| `isSameSize` | `(a, b) => boolean` | 尺寸是否一致 |

### 类型

`ImageFormat`、`ImageOutputFormat`、`ImageFit`、`ImageCrop`、`ImageResize`、`ImageOperation`、`ImageSize`、`ImageMeta`、`ImageSniffResult`、`ImageProcessResult`、`LosslessFidelity`、`LosslessStrategy`、`ScaleRequest`、`ScaleOptions`。

## 浏览器侧入口（`./ui`）

### 引擎 API

| 函数 | 说明 |
|------|------|
| `configureImageEngine({ wasmUrl })` | 注入 wasm 地址（优先于本地打包资源） |
| `getConfiguredWasmUrl()` | 读取当前注入地址（便于诊断） |
| `resolveEngineWasmUrl()` | 解析最终生效的 wasm 地址 |
| `ensureImageEngine()` | 确保引擎就绪；并发调用共享同一次加载，失败后可重试 |
| `resetImageEngine()` | 重置引擎（失败重试前调用） |
| `subscribeImageEngine(listener)` | 订阅加载状态，返回取消订阅函数 |
| `getImageEngineState()` / `isImageEngineReady()` | 读取当前加载状态 |
| `probeImage(bytes)` | 读取图片元数据；非图片或无法解码返回 `null` |
| `transformImage(bytes, operation)` | 裁切 / 缩放 / 转格式 |
| `optimizeImageLosslessly(bytes, options)` | 无损优化；返回 `null` 表示该格式不支持 |

状态机阶段：`idle → downloading → instantiating → ready`，另有 `error`。
`downloading` 阶段给出 `loaded` / `total` / `ratio`，响应带 `Content-Encoding` 时 `total` 为 `null`（避免进度冲过 100%）。

### Hooks

| Hook | 说明 |
|------|------|
| `useImageEngine()` | 订阅引擎加载状态（`useSyncExternalStore`） |

> 预览编排（`useImagePreview`）与容器尺寸测量（`useElementSize`）属于编辑内容区的内部实现，未对外导出；自定义 UI 用 `ImageEngineGate` + 引擎 API 组合即可。

### 组件

| 组件 | 说明 |
|------|------|
| `ImageEditor` | 图片编辑内容区（预览对比 + 控制栏 + 状态行），容器与保存动作由宿主决定 |
| `ImageEngineGate` | 引擎门控：加载进度、错误与重试（`ImageEditor` 内部已用） |
| `ImageCompareSlider` | 拖动对比（同区域对齐） |
| `ImageCropStage` | 裁切台（含取消 / 应用裁切） |
| `ImageResizePanel` / `ImageEncodePanel` / `ImageEditorControls` | 控制栏分组面板 |
| `ImageEditorStage` | 预览舞台与处理状态 |

### ImageEditorProps

| 属性 | 类型 | 说明 |
|------|------|------|
| `src` | `string` | 源图地址 |
| `onResultChange` | `(state: ImageEditorResult) => void` | 预览状态变化回调；保存 / 下载由宿主自行实现 |
| `theme` | `'light' \| 'dark'` | 强制暗色；缺省按「宿主 `[data-theme]` 祖先 → 系统偏好」判定 |

`ImageEditorResult` 形如 `{ result, pending, noop, unsupported, error }`：`result` 为 `ImageProcessResult | null`，为 `null` 表示设置未产生实际变更、该格式不支持或尚在处理。组件不接收 `fileName`，也不渲染任何保存 / 取消按钮。

## 包内约定

- `src/limits.ts` 是格式能力的**单一事实来源**，界面的可编辑 / 可输出 / 可无损优化判定都从它派生
- `src/ui/editor-settings.ts` 是 UI 状态 → 引擎入参的**唯一转换点**（纯逻辑，可单测）
- `src/ui/primitives/` 是自研 UI 原语，全部基于原生元素（`select` / `range` / `radio` / `checkbox` / `number`）；导出组件的根节点带 `easyx-image-toolkit` 令牌作用域类，脱离宿主 DOM 层级也能取到 CSS 变量
- 引擎结果必须经 `sniffImage` 校验后才允许流入存储
