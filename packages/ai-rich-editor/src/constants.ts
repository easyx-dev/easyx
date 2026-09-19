/**
 * AI Rich Editor 客户端常量：默认模板、预设指令、设备档位与对话上下文上限
 */
import {
  CURRENT_FRAGMENT_BLOCK_TITLE,
  SELECTION_BLOCK_TITLE,
  TARGET_BLOCK_TITLE,
} from './chat/prompt-blocks';
import { ATTACHMENT_BLOCK_TITLE } from './media/prompt-text';

/** 首次打开时的默认 HTML 内容片段 */
export const DEFAULT_HTML = `<style>
  .hero {
    padding: 48px 24px;
    text-align: center;
    background: linear-gradient(135deg, #f5f7fa 0%, #e8edf2 100%);
  }
  .hero h2 { margin: 0 0 12px; font-size: 28px; }
  .hero p { margin: 0; color: #666; }
</style>
<div class="hero">
  <h2>欢迎使用 AI Rich Editor</h2>
  <p>在左侧用自然语言生成页面，中间直接编辑代码，右侧实时预览</p>
</div>`;

/** 空编辑器时的提示语 */
export const EMPTY_PREVIEW_TEXT =
  '左侧让 AI 生成页面，或直接编辑中间的 HTML 代码';

/** 输入框占位文案 */
export const CHAT_INPUT_PLACEHOLDER =
  '描述你想要的页面，比如：生成一个新品发布的通稿页面…';

/**
 * 默认 system 提示词模板（供适配方取用）
 * 定位为另一种形态的富文本：只产出可嵌入内容字段的 HTML 片段，而非整页文档。
 * 每次回复都给出「改动后的完整片段」——对话因此天然留有一份可回退的版本序列。
 */
export const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `你是「富文本 HTML 片段生成助手」，定位为另一种形态的富文本：产出可嵌入内容字段的内容片段，而非整页 HTML 文档。服务于内容页（新闻、活动、落地页等）定制，具备资深前端与排版能力。

输出规则：
1. 只输出 HTML 内容片段（即 <body> 内部内容）；禁止输出 <!DOCTYPE> / <html> / <head> / <body> 外壳。
2. 必须把结果包裹在 markdown 代码块中：先写 \`\`\`html，再写代码，最后以 \`\`\` 结束；不要在代码块外输出无关内容。
3. 无论新建还是修改，都输出**改动后的完整片段**，不要只给差异、不要省略未改动部分。
4. 样式自包含且不污染宿主：优先用内联 style 属性；确需 <style> 时，选择器只用能作用于片段内部的形式（元素/类/后代等），禁止 body、*、:root、html 等全局选择器；禁止依赖宿主全局样式或外部 CSS 资源。
5. 类名使用语义化命名（渲染端会把片段罩进独立作用域，无需感知前缀）。
6. 图片使用占位路径（如 /uploads/example.png）并加 HTML 注释说明用途，不要引用外部图床。
   用户消息中出现「${ATTACHMENT_BLOCK_TITLE}」时，媒体地址一律使用其中给出的 url，不要改写或编造；
   按用户要求决定插入位置与标签写法（图片用 <img>、视频用 <video controls>、音频用 <audio controls>、其它文件用 <a download>）。
7. 移动端优先、使用语义化标签、注重排版层次与可访问性（对比度、焦点可识别）。
8. 避免引入外部脚本；需要交互时以内联 <script> 自包含为主，代码保持精简。

修改类请求（用户要求修改/修复/精简/换风格/调整细节）：
- 用户消息中出现「${CURRENT_FRAGMENT_BLOCK_TITLE}」时，它是编辑器的当前内容，是你改动的唯一依据；在此基础上做最小化改动，但最终仍输出改动后的完整片段。
- 出现「${TARGET_BLOCK_TITLE}」时，重点改该区域；出现「${SELECTION_BLOCK_TITLE}」时以该文本为改动焦点。
- 未涉及的区块保持原样（含既有类名、结构、样式与注释），不要顺手重写。`;

/** 预设指令：一键生成/改写常见页面形态 */
export const PRESET_PROMPTS = [
  '生成一个产品发布会通稿页',
  '生成一个活动回顾时间线',
  '生成一个深色风格海报页',
  '生成数据卡片 / 指标墙',
  '修复预览中的布局问题',
  '精简冗余样式',
  '改成移动端适配',
] as const;

/** 预览设备档位（控制 iframe 容器宽度） */
export interface PreviewDevice {
  key: string;
  label: string;
  width: number | string;
  /** 固定档位的视口高度（仅手机等固定设备；桌面自适应无此值） */
  height?: number;
}

export const PREVIEW_DEVICES: PreviewDevice[] = [
  { key: 'desktop', label: '桌面', width: '100%' },
  { key: 'mobile', label: '手机', width: 375, height: 812 },
];

/** 包配置项的默认值（设置面板与容器共享） */
export const DEFAULT_CONFIG = {
  /** 自动应用到编辑器 */
  autoApply: true,
  /** 图片附件以多模态 content parts 发送 */
  sendImagesAsMultimodal: true,
  /** 预览区右键「用 AI 修改」入口 */
  previewEditMenu: true,
} as const;

/** 对话单次发送的附件数量上限（防止一次塞入过多文件） */
export const MEDIA_ATTACHMENT_LIMIT = 6;

/** 一个媒体入口都没有时的提示 */
export const MEDIA_PICKER_EMPTY_HINT = '未配置媒体上传或媒体库接口';
