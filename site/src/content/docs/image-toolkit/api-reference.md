---
title: Image Toolkit API 参考
description: 两个入口的导出清单、引擎 API、组件与类型定义
---

## 根入口（同构纯逻辑）

零重量依赖，服务端可安全引用。

### 常量

| 导出 | 说明 |
|------|------|
| `IMAGE_LIMITS` | 处理上限：`maxDimension`（8192）/ `maxInputPixels`（5000 万）/ `maxInputBytes`（50 MB）/ `minQuality` / `maxQuality` |
| `PROCESSABLE_FORMATS` | 可编辑格式（识别 + 解码 + 编码） |
| `OUTPUT_FORMATS` | 可编码输出格式 |
| `LOSSLESS_STRATEGIES` | 各格式的无损策略表 |
| `PALETTE_COLOR_PRESETS` | 调色板颜色数预设 |
| `MIN_PALETTE_COLORS` / `MAX_PALETTE_COLORS` | 调色板颜色数上下限 |

### 函数

| 函数 | 签名 | 说明 |
|------|------|------|
| `sniffImage` | `(bytes: Uint8Array) => ImageSniffResult \| null` | 魔数嗅探格式与尺寸，非图片返回 `null` |
| `isProcessableFormat` / `isOutputFormat` | `(format: unknown) => boolean` | 格式判定 |
| `isProcessableMimeType` / `isImageMimeType` | `(mime: string) => boolean` | MIME 判定 |
| `formatToMimeType` / `formatToExtension` / `mimeTypeToFormat` | 格式与 MIME / 扩展名互转 | `mimeTypeToFormat` 无法识别返回 `null` |
| `clampQuality` | `(quality: unknown) => number \| undefined` | 质量钳制到合法区间并取整 |
| `isValidPaletteColors` | `(value: unknown) => boolean` | 调色板颜色数校验 |
| `getLosslessStrategy` | `(format: ImageFormat) => LosslessStrategy` | 取某格式的无损策略 |
| `isOptimizableLosslessly` | `(format: ImageFormat) => boolean` | 是否可无损优化（保真可用**且**可输出） |
| `normalizeImageOperation` | `(input: ImageOperation) => ImageOperation` | 操作归一化（取整、钳制、拒绝非法结构） |
| `isImageOperationEffective` | `(operation: ImageOperation) => boolean` | 是否产生实际变更 |
| `intersectCrop` | `(a, b) => ImageCrop \| null` | 裁切矩形求交 |
| `describeImageOperation` | `(operation: ImageOperation) => string` | 生成中文描述 |
| `resolveScaledSize` | `(size, request, options?) => ImageSize` | 等比缩放换算（锁比例、默认不放大、上下限钳制） |
| `scalePercent` / `isSameSize` | 缩放百分比 / 尺寸是否一致 | — |

### 类型

`ImageFormat`、`ImageOutputFormat`、`ImageFit`、`ImageCrop`、`ImageResize`、`ImageOperation`、`ImageSize`、`ImageMeta`、`ImageSniffResult`、`ImageProcessResult`、`LosslessFidelity`、`LosslessStrategy`、`ScaleRequest`、`ScaleOptions`。

## 浏览器侧入口（`./ui`）

### 引擎 API

| 函数 | 说明 |
|------|------|
| `ensureImageEngine()` | 确保引擎就绪；并发调用共享同一次加载，失败后可重试 |
| `resetImageEngine()` | 重置引擎（失败重试前调用） |
| `subscribeImageEngine(listener)` | 订阅加载状态，返回取消订阅函数 |
| `getImageEngineState()` / `isImageEngineReady()` | 读取当前加载状态 |
| `configureImageEngine({ wasmUrl })` | 注入 wasm 地址（优先于本地打包资源） |
| `getConfiguredWasmUrl()` / `resolveEngineWasmUrl()` | 读取注入地址 / 解析最终生效地址 |
| `probeImage(bytes)` | 读取图片元数据；非图片或无法解码返回 `null` |
| `transformImage(bytes, operation)` | 裁切 / 缩放 / 转格式 |
| `optimizeImageLosslessly(bytes, options)` | 无损优化；返回 `null` 表示该格式不支持 |

状态机阶段：`idle → downloading → instantiating → ready`，另有 `error`。`downloading` 阶段给出 `loaded` / `total` / `ratio`；响应带 `Content-Encoding` 时 `total` 为 `null`（避免进度冲过 100%）。

### Hooks

| Hook | 说明 |
|------|------|
| `useImageEngine()` | 订阅引擎加载状态（`useSyncExternalStore`） |

### 组件

| 组件 | 说明 |
|------|------|
| `ImageEditor` | 图片编辑内容区（预览对比 + 控制栏 + 状态行），容器与保存动作由宿主决定 |
| `ImageEngineGate` | 引擎门控：加载进度、错误与重试（`ImageEditor` 内部已用） |

对比滑块、裁切台、控制面板、预览舞台等均为内部实现，不对外导出。自定义 UI 用 `ImageEngineGate` + 引擎 API 组合即可。

### ImageEditorProps

| 属性 | 类型 | 说明 |
|------|------|------|
| `src` | `string` | 源图地址 |
| `onResultChange` | `(state: ImageEditorResult) => void` | 预览状态变化回调 |
| `theme` | `'light' \| 'dark'` | 显式指定主题；缺省按「宿主 `data-theme` 祖先 → 系统偏好」判定 |

`ImageEditorResult` 形如 `{ result, pending, noop, unsupported, error }`：`result` 为 `ImageProcessResult | null`，为 `null` 表示设置未产生实际变更、该格式不支持或尚在处理。组件不接收 `fileName`，也不渲染保存 / 取消按钮。

### 错误与类型

| 导出 | 类型 | 说明 |
|------|------|------|
| `ImageEngineError` | 错误类 | 引擎加载失败（下载 / wasm 初始化 / Worker 创建） |
| `ImageEngineConfigError` | 错误类 | 引擎未就绪或配置缺失（如 wasm 地址不可用），供宿主分支 |
| `ImageEngineStage` | 类型 | `'idle' \| 'downloading' \| 'instantiating' \| 'ready' \| 'error'` |
| `ImageEngineState` | 类型 | 按 `stage` 区分的状态联合，`downloading` 带 `loaded` / `total` / `ratio`，`error` 带 `message` |
| `UseImageEngineResult` | 类型 | `useImageEngine()` 返回值：`ImageEngineState` + `{ ready, ensure, retry }` |

## 包内约定

- `src/limits.ts` 是格式能力的**单一事实来源**，界面的可编辑 / 可输出 / 可无损优化判定都从它派生
- `src/ui/editor-settings.ts` 是 UI 状态 → 引擎入参的**唯一转换点**（纯逻辑，可单测）
- UI 原语全部基于原生元素（`select` / `range` / `radio` / `checkbox` / `number`）；导出组件的根节点带 `easyx-image-toolkit` 令牌作用域类
- 引擎结果必须经 `sniffImage` 校验后才允许流入存储
