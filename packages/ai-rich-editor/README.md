# @easyx/ai-rich-editor

AI 驱动的「代码编辑 + 实时预览」工作台（重客户端组件）。

定位为**另一种形态的富文本**：只产出可嵌入内容字段的 HTML 片段（fragment），不输出整页文档。与 [`@easyx/editor`](https://www.npmjs.com/package/@easyx/editor)（传统富文本）互补 —— 由对话生成自由 HTML 片段，所见即所得预览。

## 定位与边界

| 项 | 约定 |
|----|------|
| 场景 | 定制化页面（新闻、活动、落地页等）的 HTML 内容生产 |
| 输出 | **fragment-only**：只产出 HTML 内容片段，无完整文档切换 |
| 防污染 | 作用域化在**应用时刻**完成，产物自带 scope 前缀，宿主可直接当 HTML 引入，端侧零处理 |
| 传输 | **不持有**任何 HTTP 端点/鉴权知识 —— 对话能力经宿主提供的 OpenAI 兼容端点（`endpointUrl` + `model` + `requestHeaders`）消费 |
| 样式 | 包内 SCSS + CSS 变量，编译后内联进 JS，宿主零配置 |
| 依赖 | peer：`react` / `react-dom`；dep：`@floating-ui/dom`（浮层定位）、`marked`（对话 markdown）、`@codemirror/*` + `@lezer/highlight`（代码面板）。**除 React 外不依赖任何 UI 库**，界面全部自研 |

## 布局结构

顶栏 + 自研 `Splitter`（水平拖拽分割，支持键盘调整）：左（预览区，可选编辑器）｜右（AI 对话面板，默认 420，min 400 / max 600）。

- **顶栏**：预览控件「设备档位 / 脚本勾选 / 刷新 / 新窗口预览」+ **编辑器**勾选（打开后在左栏与预览并排）+ 复制 + **设置**
- **左栏**：默认整区为预览卡片（iframe 实时预览）；开启「编辑器」后变为 `[代码编辑器 | 预览]` 内层横向分割
- **代码面板**：CodeMirror 6 按需加载，HTML 语法高亮（含 `<style>` / `<script>` 内嵌 CSS 与 JS）、补全、查找替换与行跳转
- **预览面板**：控件统一收拢在主顶栏；桌面拉伸、手机为固定尺寸设备框（375×812，按舞台等比缩放）

## 安装

```bash
pnpm add @easyx/ai-rich-editor
```

`react` / `react-dom` 为 peer 依赖，需宿主自行安装；其余运行时依赖（含代码面板的 CodeMirror）随包安装。

## 快速上手

```tsx
import { AiRichEditor, DEFAULT_HTML } from '@easyx/ai-rich-editor';

export function MyPage() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  return (
    <AiRichEditor
      value={html}
      onChange={setHtml}
      endpointUrl="/v1/chat/completions" // OpenAI Chat Completions 兼容端点
      model="gpt-4o-mini"
      requestHeaders={{ Authorization: 'Bearer sk-…' }}
      onNotify={(type, content) => {
        /* 宿主消息提示（未注入时用包内轻提示） */
      }}
      config={{ previewHead: '<style>body{margin:0}</style>' }}
    />
  );
}
```

宿主的后端只需是任意 **OpenAI Chat Completions 兼容**服务 —— OpenAI、DeepSeek、vLLM、Ollama、one-api/new-api 之类的网关都能直接用，**不需要配套 SDK 或服务端适配层**。请求以 `endpointUrl` + `model` + `requestHeaders` 三件套描述连接，`requestBody` 追加温度等参数。

### 对话协议

| 环节 | 约定 |
|------|------|
| 请求 | `POST {endpointUrl}`，体为 `{ model, stream: true, messages }`；system 提示词作为 `messages[0]` 发送 |
| 响应 | `text/event-stream`，逐条 `data: {"choices":[{"delta":{"content":"…"}}]}`，以 `data: [DONE]` 或 `finish_reason` 收尾 |
| 思考 | 按厂商方言尽力识别 `reasoning_content` / `reasoning` / `thinking`，渲染为折叠思考块 |
| 图片 | 绝对 `http(s)` 地址且开启多模态时作为 `image_url` 发送；其余附件靠消息正文里的 `[已上传附件]` 清单传递地址 |
| 错误 | HTTP 非 2xx 与流内 `{"error":…}` 都抛出 `Error`，走 `onNotify` + `onError` 两条通道 |
| 中断 | `[DONE]` 与 `finish_reason` 都缺失即视为流被切断并报错，不会把半截回复当成功应用 |

`model` / `stream` / `messages` 由包内决定，`requestBody` 中的同名字段不会生效。

### 把生成的片段渲染进正文

AI 生成的片段在「应用到编辑器」（含 `autoApply`）时已做**样式作用域化**，产物形如：

```html
<div class="easyx-rich-content-<实例前缀>">
  <style>.easyx-rich-content-<实例前缀> .hero { … }</style>
  <div class="hero">…</div>
</div>
```

前缀在编辑器实例创建时生成一次并一直沿用。宿主把它当纯 HTML 引入即可：

```tsx
<div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: detail.html }} />
```

作用域化保证片段内嵌 `<style>` 只作用于该片段根，不污染宿主全局；内联 `style=""` 天然隔离。

> **源头约束**（内置 system 提示词）：要求内联样式优先；确需 `<style>` 时仅用可作用于片段内部的选择器，禁用 `body` / `*` / `:root` / `html`；类名语义化。

## 对话契约

- 对接协议是标准 **OpenAI Chat Completions** 流式接口，连接适配器在 `chat/openai-connection.ts`（SSE 解析与消息转换分别为 `chat/openai-sse.ts` / `chat/openai-messages.ts`，均为纯函数）
- 数据流基于 TanStack AI **headless UI**：`createChatHook` 在模块作用域注册 `components`（`layout` / `message` / `input`）与 `partsComponents`（`text` / `thinking` / `fallback`），底层消费宿主端点
- **渲染侧**为包内自研：消息 → 气泡（`ChatProvider`）、输入 → `ChatComposer`（自增高 + Input 发送 + 输入法合成期守卫生效）、空态 → 引导 + 推荐指令、思考 → `ThinkBlock`（默认折叠）、错误 → `Alert`；数据流与 UI 组件解耦，替换渲染层不影响数据链路
- 助手消息的 markdown 走「marked 词法 → React 元素」自研渲染层：markdown 里的**裸 HTML 一律丢弃**，链接协议白名单校验，全程不经过 `dangerouslySetInnerHTML`
- system 提示词由包内生成（`buildDefaultSystemPrompt`），可经 `config.systemPrompt` 覆盖，作为请求的 `messages[0]` 发送
- `stop` 中止当前生成；`clear` / 新会话清空对话；`autoApply` 在流结束后自动应用回复中的 HTML 代码块
- 流式生成中，回复里 HTML 代码块的累计新增达到阈值即同步到编辑器与预览
- 外部写入（流式同步 / 应用片段）与用户输入区别对待：与当前文档成前缀关系时只追加尾部，否则整篇替换；不进撤销栈（Ctrl+Z 只回退自己的输入），也不回吐 `onChange`。整篇替换后光标落到新内容末尾
- 注意作用域化会回溯改写 `<style>` 选择器，因此流式同步的 value 常常不是前缀延伸，会走整篇替换 —— 生成过程中手动改写的代码会被下一轮同步覆盖，这符合「生成期间内容归 AI 所有」的定位

## 媒体插入

媒体能力经**顶层 `media` 属性**注入（不在 `config` 里：上传与列表都是函数，设置面板无法编辑）：
```tsx
<AiRichEditor
  endpointUrl="/v1/chat/completions"
  model="gpt-4o-mini"
  media={{
    image: {
      upload: async (file, onProgress) => ({
        id: file.name,
        url: await myUpload(file, onProgress),
        name: file.name,
        size: file.size,
      }),
      getList: async ({ page, pageSize, keyword }) => ({ items, total }),
    },
    video: { upload, getList },
    audio: { upload, getList },
    attachment: { upload },
  }}
/>
```

`AiRichMediaItem` 字段与 `@easyx/editor` 的媒体配置一致（`id` / `url` / `name` / `size?` / `thumbnailUrl?` / `fileType?`），两包的宿主接口可以复用。

| 路径 | 交互 |
|------|------|
| 对话 | 粘贴 / 拖入输入框，或点回形针从上传与媒体库中选择；**点发送时**才调用对应类型的 `upload` |
| 代码面板 | 行号**左侧、跟随光标所在行**的「+」（上传 / 网络地址 / 媒体库），或把文件拖进代码区（按落点插入） |

- 上传成功后，附件以 `[已上传附件]` 清单形式拼进用户消息（模型需要真实地址），附件明细同时写入消息 `metadata`，气泡里还原成「用户原话 + 附件缩略条」
- 插入的是自包含片段：`<img src alt style="max-width:100%;height:auto;">`、`<video src controls playsinline style="max-width:100%">`、`<audio src controls>`、`<a href download>文件名（尺寸）</a>`
- 未配置 `upload` 的类型不可上传，**添加那一刻即报错**（不会等到发送才失败）；上传失败则不发送，输入与附件保留可重试
- 「媒体库」入口由 `getList` 决定是否出现，列表取自第一个配置了 `getList` 的类型，条目类型按 `fileType` 或扩展名推断

### 地址校验的信任边界

| 来源 | 是否校验 |
|------|----------|
| 用户手输（「网络地址」页签） | 校验 |
| AI 回复里的链接与图片 | 校验 |
| 宿主 `upload` / `getList` 返回的地址 | **不校验**（宿主服务端产物，属可信来源） |

校验规则是协议白名单：默认放行 `http(s)` / `mailto` / `tel` / `blob` 与相对路径，拦下 `javascript:` / `data:` 等。`blob:` 放行是因为它只能由同源脚本现场铸造，无法像 `data:` 那样从字符串直接构造。

宿主可用 `allowedUrlSchemes` **追加**协议（只增不减；`javascript:` / `data:` / `vbscript:` 等危险协议写进去也会被忽略）：

```tsx
<AiRichEditor allowedUrlSchemes={['ipfs:', 'app:']} … />
```

> 不走 TanStack AI 的工具调用：本包不声明任何工具，模型也无需回调宿主接口 —— 附件在发送前由客户端上传、地址写进消息，效果一致且宿主服务端零改动。

## 通知与错误

两条通道分开，均为顶层属性；**错误会同时走两条** —— 一条给人看，一条给程序看：

| 通道 | 承载 | 未注入时的兜底 |
|------|------|----------------|
| `onNotify(type, content)` | 用户可见文案：复制成功、暂无内容可复制、附件数量上限、未检测到 HTML 代码块，以及**所有错误提示** | 包内置轻提示 |
| `onError(error)` | 错误实例，供日志 / 上报 / 分支处理（不负责用户可见提示） | `console.error`（不上浮任何 UI） |

```tsx
<AiRichEditor
  endpointUrl="/v1/chat/completions"
  model="gpt-4o-mini"
  onNotify={(type, content) => myToast(type, content)}
  onError={(error) => myReporter(error)}
/>
```

- 错误提示的文案取自 `error.message`，宿主无需自己翻译；`onError` 收到的是错误实例，可按类分支：`error instanceof MediaNotConfiguredError` / `InvalidMediaUrlError`（两包均导出）
- 兜底刻意做得很轻：通知用包内轻提示，错误只打 `console.error`，绝不弹原生 alert
- 会话流错误（SSE / 发送失败）在对话区保留 `Alert`（属对话状态），同时也会走 `onNotify` / `onError`，因此会同时看到气泡区的说明与一条轻提示

## 设置面板

顶栏「设置」直接打开模态框（不再有下拉菜单）。模态框**就地渲染在编辑器容器内**（不 portal），高度随内容自适应、上限为容器的 90%，宽度上限 800px，只承载可序列化的配置（`autoApply` / `systemPrompt` / `previewHead`）；`media` / `onNotify` / `onError` / `allowedUrlSchemes` 这些函数型或代码级注入项只做只读展示。

## 配置与设置面板

包配置项统一收拢到 `config` 属性，经顶栏「设置」面板编辑，**保存后生效**：

| 配置项 | 说明 | 默认 |
|--------|------|------|
| `autoApply` | AI 回复后自动应用到编辑器 | `true` |
| `systemPrompt` | 自定义 system 提示词 | 内置模板 |
| `previewHead` | 预览 `<head>` 附加代码（原始 HTML） | 空 |
| `sendImagesAsMultimodal` | 图片附件以多模态 content parts 发送 | `true` |

`config` 只放可序列化的配置；函数型注入项（`media` / `onNotify` / `onError`）与 `allowedUrlSchemes` 一律顶层。

> **注意**：`config` 为**仅初始值（非受控）**——挂载后改动 `config` 不会生效；运行期请经设置面板修改，如需持久化再用 `onConfigChange` 回写宿主。

## 主题

亮暗判定优先级（与包内样式一致）：

1. 令牌作用域上的 class `easyx-ai-rich-editor-scope-dark`
2. 最近的宿主 `[data-theme]` 祖先（值以 `dark` 结尾，如 `dark`、`admin-dark`）
3. 两者都没有时跟随系统 `prefers-color-scheme`

代码面板的语法高亮与结构配色全部走 `--easyx-ai-rich-editor-code-*` 令牌（跟随上述判定，无需 JS）；仅 CodeMirror 内置的光标 / 选区 / 当前行 / 面板变体由包内 hook 转达暗色判定。抽屉、菜单、Tooltip、轻提示等浮层渲染在 portal 中：`data-theme` 挂在 `<html>` 上时第 2 条依然命中，包内会把触发元素所处的主题一并带到浮层根上，因此浮层不会脱主题。

所有颜色经 `--easyx-ai-rich-editor-*` CSS 变量控制，可在宿主覆盖。

## 预览沙箱

`iframe` 使用 `sandbox` 隔离；默认允许脚本时 `allow-scripts allow-same-origin`（后者用于加载同源资源），脚本可在顶栏关闭。

> 安全边界：`allow-scripts` + `allow-same-origin` 组合会使 iframe 内容与宿主同源、获得 `parent.document` 写权（OWASP 反模式）。当前保留 `allow-same-origin` 是为在预览内加载同源资源，二者不可兼得，故以「受信编辑器产物」为前提，**勿把该模式用于不可信内容**。

## 单实例假设

`createChatHook` 的 options 固定在模块作用域，连接信息（`endpointUrl` / `model` / `requestHeaders`）与结束回调经每实例 overrides 注入（多实例互不串线）；但编辑器仍按**一页一个**设计。

## 导出

| 导出 | 内容 |
|------|------|
| `AiRichEditor` | 主组件 |
| `DEFAULT_CONFIG` / `DEFAULT_HTML` / `DEFAULT_SYSTEM_PROMPT_TEMPLATE` / `PRESET_PROMPTS` / `PREVIEW_DEVICES` | 默认常量 |
| `buildDefaultSystemPrompt` | 构建内置 system 提示词 |
| `extractHtmlFragments` / `buildPreviewDocument` | 片段提取与预览文档构建 |
| `buildMediaSnippet` / `mediaKindLabel` / `resolveMediaKind` | 媒体片段生成与类型路由 |
| `sanitizeUrl` / `listAllowedSchemes` | 地址白名单校验与协议清单 |
| `MediaNotConfiguredError` / `InvalidMediaUrlError` | 媒体错误类（供 `onError` 分支） |
| `AiRichMediaConfig` / `AiRichMediaItem` 等媒体类型 | 媒体能力配置与条目类型 |
| `AiRichRequestHeaders` | 对话请求头类型（静态对象或求值函数） |

## 测试

```bash
pnpm --filter @easyx/ai-rich-editor test
```

覆盖代码块提取 / 预览文档构建（含附加代码注入）、`MarkdownContent`（```html 代码块「应用到编辑器」、空回复占位）与 `markdown/renderer`（结构映射、裸 HTML 丢弃、危险协议降级、流式半成品）、样式作用域化（前缀生成 / CSS 选择器改写 / style 注入与整段包装）、代码面板（外部 value 落地策略 / 扩展装配 / 受控同步与回环抑制 / 媒体入口跟随光标行与文件拖入）、媒体能力（类型路由 / 片段生成与转义 / 未配置报错 / 附件接纳计划与清单文本往返）、地址白名单（默认协议 / 追加协议 / 危险协议拦截）、通知与错误通道的兜底、模态框（尺寸 / Esc 与遮罩关闭 / 焦点归还）、对话输入区（粘贴 / 附件条 / 发送时机）、媒体选择浮层（入口可用性 / 地址白名单 / 媒体库选择）与 OpenAI 协议层（SSE 分帧与心跳跳过、增量归一化、system 前置与图片多模态判定、请求体形状、HTTP / 流内错误与截断、abort 静默）。

> `scopedRichContent` 的 `<style>` 选择器改写为零依赖轻量实现：覆盖常见选择器（元素 / 类 / 后代 / `@media` / `@supports` 内层）与 `@keyframes` / `@font-face` 原样保留；CSS 原生嵌套规则（规则体内嵌套规则）不做嵌套前缀改写，此类输入请让 AI 用内联样式规避。
