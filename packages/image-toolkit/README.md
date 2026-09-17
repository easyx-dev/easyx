# @easyx/image-toolkit

浏览器端图片处理套件：裁切、缩放、格式转换与无损优化全部在客户端完成，服务端零图片库、零原生依赖。
内置引擎基于 [`@imagemagick/magick-wasm`](https://github.com/dlemstra/magick-wasm)（ImageMagick 编译为 WebAssembly），运行在自建 Worker 中，不阻塞主线程。

## 两个入口

| 入口 | 内容 | 依赖 |
|------|------|------|
| `@easyx/image-toolkit` | 同构纯逻辑：魔数嗅探、格式白名单、操作归一化、缩放换算 | 零重量依赖（服务端可安全引用） |
| `@easyx/image-toolkit/ui` | 浏览器侧：引擎客户端、React hooks、编辑弹窗组件 | React + wasm 引擎（惰性加载） |

> 根入口**禁止**静态引用引擎，否则 wasm glue 会被打进服务端 bundle。

## 为什么是纯客户端

服务端方案需要引入原生依赖（sharp / libvips），会带来基础镜像 libc 一致性、打包外部化与二进制 trace 等一串部署约束。
把处理放在浏览器后，服务端零图片库，能力随浏览器能力走。

代价是引擎需要一次性下载（gzip 后约 5.3 MiB），因此加载进度是一等公民：状态分阶段暴露 `idle → downloading → instantiating → ready`，下载阶段可给出百分比与已下载字节数。

## 能力矩阵（实测）

引擎版本：`ImageMagick 7.1.2-30 Q8 wasm32`（`@imagemagick/magick-wasm@0.0.43`，版本固定：glue 与 wasm 必须严格同版）。

| 格式 | 解码（可编辑） | 编码（可输出） | 无损优化 | 说明 |
| --- | --- | --- | --- | --- |
| JPEG | ✅ | ✅ | ⚠️ 近无损 | 质量 100 重编码仍有约 24% 像素字节差异（视觉不可分辨） |
| PNG | ✅ | ✅ | ✅ 逐像素无损 | `png:compression-level=9` |
| WebP | ✅ | ✅ | ✅ 逐像素无损 | `webp:lossless=true, method=6` |
| TIFF | ✅ | ✅ | ✅ 逐像素无损 | LZW |
| GIF | ✅ | ❌ | ❌ | 可读可裁；动图会被压平 |
| AVIF / HEIC | ❌ | ❌ | ❌ | 本 wasm 构建下编解码器不可用 |
| BMP / ICO / TGA | ❌ | — | ❌ | 需显式指定格式才能解码，收益低故不纳入 |
| SVG | ❌ | ❌ | ❌ | 规避 ImageMagick XML 解析器的历史外部引用风险 |

「可编辑」= 能自动识别 + 解码 + 编码，是 `PROCESSABLE_FORMATS` 的判定依据；「可输出」是 `OUTPUT_FORMATS` 的判定依据，两者都在 `src/limits.ts`。

### 无损优化的真实收益

以 `compression-level=1` 写出的 1600×1200 类照片 PNG 作为「劣质源」实测：
PNG compression-level 9 为 −41.5%（逐像素一致），WebP lossless + method 6 为 −43.2%（逐像素一致），JPEG 质量 100 为 −30.2%（**非**逐像素一致）。

用引擎自己高质量编码的图作源会得到接近 0 的收益 —— **收益高度取决于源文件编码质量**。

### 有损降色（TinyPNG 等价能力）

`ImageOperation.colors` 指定输出 PNG 的最大颜色数时，引擎先做调色板量化（Riemersma 抖动）再编码，这正是 TinyPNG 的主力手段。

一张 1772×2480 的连续色调 PNG（约 2490 KB）实测：无损转 WebP −40.7%（逐像素无损）、降色至 256 色 −68.9%（有损）、转 WebP q82 −93.9%（有损）。
连续色调（照片、渐变）降色会出现色带，扁平插画与图标几乎无感。

### 缩放

`resolveScaledSize` 提供等比换算（锁定比例、默认不放大、钳制上下限）。

**无损优化与缩放互斥**：缩放必然重采样改变像素。选中无损优化时缩放被禁用；但允许叠加裁切（裁切只取像素子集，保留区像素不变）。

## 安装

```bash
pnpm add @easyx/image-toolkit
```

`react` / `react-dom` 为 peer 依赖，需宿主自行安装（`./ui` 入口才需要）。

## 使用

### 纯逻辑（同构）

```ts
import { IMAGE_LIMITS, isProcessableFormat, sniffImage } from '@easyx/image-toolkit';

const meta = sniffImage(bytes); // 魔数嗅探：非图片返回 null
```

### 编辑弹窗（浏览器）

```tsx
import { configureImageEngine, ImageEditorModal } from '@easyx/image-toolkit/ui';

// 可选：指向 CDN 或自有静态资源（绝对 URL 需服务端提供 CORS 与 application/wasm）
configureImageEngine({ wasmUrl: '/static/magick.wasm' });

<ImageEditorModal
  open={open}
  src={sourceUrl}
  fileName="cover.png"
  onReplace={async (result) => {
    // result.data / result.mimeType / result.meta / sizeBefore / sizeAfter
    await replaceOriginal(result);
  }}
  onSaveAsNew={async (result, fileName) => {
    await uploadAsNew(result, fileName);
  }}
  onClose={() => setOpen(false)}
/>;
```

`<ImageEngineGate>` 包裹后即可获得引擎加载进度、错误与重试，无需各自处理加载态。

## wasm 资源与宿主打包器

**默认**：无需任何配置，wasm 随包发布（`dist/ui/engine/magick.wasm`，约 14 MB），内网与私有化部署开箱可用。

包内同时附带上游第三方许可声明 `dist/THIRD-PARTY-NOTICES/NOTICE`（wasm 静态链接了 ImageMagick 及若干第三方库，构建时从依赖原样复制）。

产物中的 Worker 与 wasm 都以**标准静态写法**引用：

```js
new Worker(new URL('./engine/worker.js', import.meta.url), { type: 'module' });
new URL('./engine/magick.wasm', import.meta.url);
```

宿主打包器（Vite / Rspack / Webpack）据此把它们复制进自己的产物，因此**必须**让打包器处理本包的 `dist`：

- 不要把本包产物当作「外部资源、不解析」处理
- Vite 开发态的依赖预打包（`optimizeDeps`）默认只作用于非链接安装的依赖；若预打包产物中找不到以上资源，把本包加入 `optimizeDeps.exclude` 即可

**自定义构建**：从源码构建时设置 `EASYX_IMAGE_TOOLKIT_REMOTE=1` 可剥离本地 wasm 副本，此时必须注入地址，否则启动时明确报错而非静默失败：

```bash
EASYX_IMAGE_TOOLKIT_REMOTE=1 pnpm build
```

## 界面形态

单视图左右分栏：左侧大预览（默认拖动对比原图 ↔ 处理后，进入裁切时切换为占满画布的裁切台），右侧控制栏（缩放 / 裁切 / 编码同屏可见），底部常驻体积增减与保存方式。

- **拖动对比的关键是「同区域对齐」**：两张图处于同一像素密度，分隔线两侧永远是同一块像素；对比舞台收缩到结果的适配矩形，分隔线不会走到空白区域
- **裁切为自研交互**（不依赖第三方裁切库）：裁切框可整体拖动、可拖四边与四角改尺寸，比例可选锁定或自由；裁切框可聚焦，方向键移动、Shift + 方向键改尺寸
- **自动预览**：参数变化后防抖 500ms 触发，请求带序号、过期响应丢弃、处理中保留上一次结果
- **无变更即不处理**：设置未产生实际变更时不调用引擎，界面提示「尚未做任何修改」

## 主题

样式走包内 SCSS + CSS 变量（`--easyx-image-toolkit-*`，定义见 `src/ui/styles/_variables.scss`），经 `injectStyles` 编译后内联进 JS，宿主无需单独引入样式文件，覆盖变量即可定制外观。

界面为自研实现，除 React 外不依赖任何 UI 库；表单控件一律基于原生元素（`select` / `range` / `radio` / `checkbox` / `number`），`color-scheme` 随主题切换，系统控件的下拉与滚动条不会与自绘外观割裂。

暗色按三级判定，命中即生效：

1. 令牌作用域根上的 `easyx-image-toolkit-dark` class
2. 宿主祖先的 `data-theme` 以 `dark` 结尾（如 `dark` / `admin-dark`）
3. 宿主未声明主题时跟随 `prefers-color-scheme`

弹窗渲染在 portal 中：`data-theme` 挂在 `<html>` 上时（常见做法）第 2 条依然命中；若挂在 `<html>` 之外的祖先上，请改用 `<ImageEditorModal theme="dark" />`。

## 已知取舍

- **JPEG 没有真正的无损重编码**：ImageMagick 未暴露 jpegtran 式系数透传，只能质量 100 重编码
- **不提供手动旋转**：EXIF 方向已由 `autoOrient()` 自动处理，手动旋转会破坏「裁切矩形基于定向后原图像素坐标」的约定
- **TIFF 不可无损优化**：引擎具备 TIFF LZW 能力，但 TIFF 不在 `OUTPUT_FORMATS` 内，界面据此提示而非静默无反应
- **输入上限**：超过 `IMAGE_LIMITS.maxInputBytes`（50 MB）或 `maxInputPixels`（5000 万像素）的图不在浏览器内处理
- **覆盖原图时格式若变化，文件名后缀同步更新**，避免列表与实际内容不符
- **编码会丢元数据**：需要保留 EXIF / ICC 时不要勾选「剥离元数据」
- **编码结果必须校验**：`encode()` 复制字节后用 `sniffImage` 校验格式，避免损坏数据流入存储

## 测试

```bash
pnpm --filter @easyx/image-toolkit test
```

- 纯逻辑（`sniff` / `limits` / `lossless` / `operation` / `resize`）为常规单测，其中 `sniff` 覆盖「HTML 伪装成 image/png 返回 null」
- 引擎加载编排用 FakeWorker 驱动，覆盖状态机推进、并发去重、进度映射、`Content-Encoding` 降级与错误路径
- 引擎操作实测在 Node 里初始化真实 wasm，断言裁切 / 缩放 / 转格式 / 无损优化各路径的产出能被 `sniffImage` 识别
