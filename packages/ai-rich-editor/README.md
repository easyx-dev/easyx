# @easyx/ai-rich-editor

AI 驱动的「代码编辑 + 实时预览」工作台（重客户端组件）。

定位为**另一种形态的富文本**：只产出可嵌入内容字段的 HTML 片段（fragment），不输出整页文档。与 [`@easyx/editor`](https://www.npmjs.com/package/@easyx/editor)（传统富文本）互补 —— 由对话生成自由 HTML 片段，所见即所得预览。

## 定位与边界

| 项 | 约定 |
|----|------|
| 场景 | 定制化页面（新闻、活动、落地页等）的 HTML 内容生产 |
| 输出 | **fragment-only**：只产出 HTML 内容片段，无完整文档切换 |
| 防污染 | 作用域化在**应用时刻**完成，产物自带 scope 前缀，宿主可直接当 HTML 引入，端侧零处理 |
| 传输 | **不持有**任何 HTTP 端点/鉴权知识 —— 对话能力经宿主提供的 SSE 端点（`endpointUrl`）消费 |
| 样式 | 包内 SCSS + CSS 变量，编译后内联进 JS，宿主零配置 |
| 依赖 | peer：`antd` / `@ant-design/icons` / `monaco-editor` / `react` / `react-dom`；dep：`@monaco-editor/react`、`@tanstack/ai-react`、`@ant-design/x`、`@ant-design/x-markdown` |

## 布局结构

顶栏 + antd `Splitter`（水平拖拽分割）：左（预览区，可选编辑器）｜右（AI 对话面板，默认 420，min 400 / max 600）。

- **顶栏**：预览控件「设备档位 / 脚本开关 / 刷新 / 新窗口预览」+ **编辑器**开关（打开后在左栏与预览并排）+ 复制 + **设置**
- **左栏**：默认整区为预览卡片（iframe 实时预览）；开启「编辑器」后变为 `[Monaco | 预览]` 内层横向分割
- **代码面板**：Monaco 懒加载（`editor.api` + 仅 html/css/js 词法高亮，无语言服务/worker，本地打包）
- **预览面板**：控件统一收拢在主顶栏；桌面拉伸、手机为固定尺寸设备框（375×812，按舞台等比缩放）

## 安装

```bash
pnpm add @easyx/ai-rich-editor
```

`react` / `react-dom` / `antd` / `@ant-design/icons` / `monaco-editor` 为 peer 依赖，需宿主自行安装。

## 快速上手

```tsx
import { AiRichEditor, DEFAULT_HTML } from '@easyx/ai-rich-editor';

export function MyPage() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  return (
    <AiRichEditor
      value={html}
      onChange={setHtml}
      endpointUrl="/api/ai-chat" // 宿主提供的流式 SSE 端点
      config={{
        notify: (type, content) => {
          /* 宿主消息提示 */
        },
        previewHead: '<style>body{margin:0}</style>',
      }}
    />
  );
}
```

宿主需提供对接 TanStack AI 的 SSE 端点（服务端用 `chat()` + `toServerSentEventsResponse`）。

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

- 数据流基于 TanStack AI **headless UI**：`createChatHook` 在模块作用域注册 `components`（`layout` / `message` / `input`）与 `partsComponents`（`text` / `thinking` / `fallback`），`fetchServerSentEvents` 消费宿主 SSE 端点
- **渲染侧**使用 Ant Design X：消息 → `Bubble`、输入 → `Sender`、空态 → `Welcome` + `Prompts`、思考 → `Think`、错误 → `Alert`；数据流与 UI 组件解耦
- system 提示词由包内生成（`buildDefaultSystemPrompt`），可经 `config.systemPrompt` 覆盖，随每次发送透传给服务端
- `stop` 中止当前生成；`clear` / 新会话清空对话；`autoApply` 在流结束后自动应用回复中的 HTML 代码块
- 流式生成中，回复里 HTML 代码块的累计新增达到阈值即同步到编辑器与预览

## 配置与设置面板

包配置项统一收拢到 `config` 属性（`endpointUrl` / `value` / `onChange` / `height` 保持顶层），经顶栏「设置」面板编辑，**保存后生效**：

| 配置项 | 说明 | 默认 |
|--------|------|------|
| `autoApply` | AI 回复后自动应用到编辑器 | `true` |
| `systemPrompt` | 自定义 system 提示词 | 内置模板 |
| `previewHead` | 预览 `<head>` 附加代码（原始 HTML） | 空 |
| `notify` | 消息提示回调 | antd 静态提示 |

> **注意**：`config` 为**仅初始值（非受控）**——挂载后改动 `config` 不会生效；运行期请经设置面板修改，如需持久化再用 `onConfigChange` 回写宿主。

## 主题

亮暗判定优先级（与包内样式一致）：

1. 容器 class `easyx-ai-rich-editor-dark`
2. 最近的宿主 `[data-theme]` 祖先（值以 `dark` 结尾，如 `dark`、`admin-dark`）
3. 两者都没有时跟随系统 `prefers-color-scheme`

代码编辑器（Monaco）主题同步跟随上述判定。antd 组件（气泡、抽屉、输入框）的亮暗由宿主的 `ConfigProvider` 决定，包内不接管。

所有颜色经 `--easyx-ai-rich-editor-*` CSS 变量控制，可在宿主覆盖。

## 预览沙箱

`iframe` 使用 `sandbox` 隔离；默认允许脚本时 `allow-scripts allow-same-origin`（后者用于加载同源资源），脚本可在顶栏关闭。

> 安全边界：`allow-scripts` + `allow-same-origin` 组合会使 iframe 内容与宿主同源、获得 `parent.document` 写权（OWASP 反模式）。当前保留 `allow-same-origin` 是为在预览内加载同源资源，二者不可兼得，故以「受信编辑器产物」为前提，**勿把该模式用于不可信内容**。

## 单实例假设

`createChatHook` 的 options 固定在模块作用域，`endpointUrl` 与结束回调经每实例 overrides 注入（多实例互不串线）；但编辑器仍按**一页一个**设计。

## 导出

| 导出 | 内容 |
|------|------|
| `AiRichEditor` | 主组件 |
| `DEFAULT_CONFIG` / `DEFAULT_HTML` / `DEFAULT_SYSTEM_PROMPT_TEMPLATE` / `PRESET_PROMPTS` / `PREVIEW_DEVICES` | 默认常量 |
| `buildDefaultSystemPrompt` | 构建内置 system 提示词 |
| `extractHtmlFragments` / `buildPreviewDocument` | 片段提取与预览文档构建 |

## 测试

```bash
pnpm --filter @easyx/ai-rich-editor test
```

覆盖代码块提取 / 预览文档构建（含附加代码注入）、`MarkdownContent`（XMarkdown 文本、```html 代码块「应用到编辑器」、空回复占位）、样式作用域化（前缀生成 / CSS 选择器改写 / style 注入与整段包装）。

> `scopedRichContent` 的 `<style>` 选择器改写为零依赖轻量实现：覆盖常见选择器（元素 / 类 / 后代 / `@media` / `@supports` 内层）与 `@keyframes` / `@font-face` 原样保留；CSS 原生嵌套规则（规则体内嵌套规则）不做嵌套前缀改写，此类输入请让 AI 用内联样式规避。
