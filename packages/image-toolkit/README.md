# @easyx/image-toolkit

浏览器端图片处理套件：裁切、缩放、格式转换与无损优化全部在客户端完成，服务端零图片库、零原生依赖。引擎基于 [`@imagemagick/magick-wasm`](https://github.com/dlemstra/magick-wasm)，运行在自建 Worker 中，不阻塞主线程。

[![npm version](https://img.shields.io/npm/v/@easyx/image-toolkit.svg)](https://www.npmjs.com/package/@easyx/image-toolkit)
[![license](https://img.shields.io/npm/l/@easyx/image-toolkit.svg)](https://github.com/easyx-dev/easyx/blob/main/LICENSE)

[文档](https://easyx-dev.github.io/easyx/image-toolkit/) · [演示](https://easyx-dev.github.io/easyx/image-toolkit/demo/) · [API 参考](https://easyx-dev.github.io/easyx/image-toolkit/api-reference/)

## 两个入口

| 入口 | 内容 | 依赖 |
|------|------|------|
| `@easyx/image-toolkit` | 同构纯逻辑：魔数嗅探、格式判定、操作归一化、缩放换算 | 零重量依赖（服务端可安全引用） |
| `@easyx/image-toolkit/ui` | 浏览器侧：引擎客户端、hooks、图片编辑内容区 | React + wasm 引擎（惰性加载） |

根入口禁止静态引用引擎，否则 wasm glue 会被打进服务端 bundle。

## 特性

- **纯客户端**：处理全在浏览器，服务端零图片库
- **不阻塞主线程**：wasm 实例化与处理都在 Worker 中
- **预览即所得**：拖动对比原图与结果，参数变化后防抖自动预览
- **自研裁切台**：裁切框可拖动、可拖边与角改尺寸，比例可锁定，支持键盘操作
- **无损优先**：PNG / WebP / TIFF 逐像素无损；JPEG 为视觉无损
- **UI 自研**：除 React 外不依赖任何 UI 库

## 安装

```bash
pnpm add @easyx/image-toolkit
```

`react` / `react-dom` 为 peer 依赖（仅 `./ui` 入口需要）；样式已内联进 JS 产物。

## 快速上手

### 纯逻辑（同构）

```ts
import { sniffImage } from '@easyx/image-toolkit';

const meta = sniffImage(bytes); // 魔数嗅探：非图片返回 null
```

### 图片编辑内容区（浏览器）

包内只提供编辑内容区 `<ImageEditor>`，容器与保存动作都由宿主负责：

```tsx
import { ImageEditor, type ImageEditorResult } from '@easyx/image-toolkit/ui';
import { useState } from 'react';

function CoverEditor() {
  const [preview, setPreview] = useState<ImageEditorResult | null>(null);

  return (
    <>
      <ImageEditor src={sourceUrl} onResultChange={setPreview} />
      <button
        disabled={!preview?.result || preview.pending}
        onClick={() => preview?.result && download(preview.result)}
      >
        保存
      </button>
    </>
  );
}
```

能力矩阵、无损收益、wasm 资源与宿主打包器配置见 [引擎与打包](https://easyx-dev.github.io/easyx/image-toolkit/engine/)；导出与类型见 [API 参考](https://easyx-dev.github.io/easyx/image-toolkit/api-reference/)。

## 许可

[MIT](https://github.com/easyx-dev/easyx/blob/main/LICENSE)。随包再分发的 wasm 及其第三方许可声明见 `dist/THIRD-PARTY-NOTICES/NOTICE`。

## 从 0.1 迁移

1.0 收窄了公开导出面：对比滑块、裁切台、控制面板、预览舞台等内部组件不再对外导出，请改用 `ImageEngineGate` + 引擎 API 组合自定义 UI；根入口与 `./ui` 入口结构不变，`ImageEditor` / `ImageEngineGate` / 引擎 API / 全部类型仍照常导出。
