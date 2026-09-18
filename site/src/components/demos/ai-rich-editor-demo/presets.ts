/**
 * 演示可选的模型提供方预设
 *
 * baseUrl 一律是 OpenAI 兼容 Base URL，保存时会补全 `/chat/completions`。
 * `cors` 标注浏览器直连可行性：站点是纯静态、没有服务端，跨域由提供方决定 ——
 * 大多数国内提供方不放行 CORS，需自行填写代理地址。
 */

/** 浏览器直连可行性 */
export type DemoCorsLevel = 'ok' | 'warn' | 'blocked';

export interface DemoPreset {
  key: string;
  label: string;
  /** OpenAI 兼容 Base URL；内置回放为空 */
  baseUrl: string;
  /** 默认模型名 */
  model: string;
  cors: DemoCorsLevel;
  /** 面板里的补充说明 */
  note?: string;
}

/** 内置回放的预设 key */
export const DEMO_PRESET_KEY = 'demo';

export const DEMO_PRESETS: DemoPreset[] = [
  {
    cors: 'ok',
    key: DEMO_PRESET_KEY,
    label: '内置演示（预录回放）',
    baseUrl: '',
    model: '',
    note: '不请求任何外部服务，无需密钥',
  },
  {
    cors: 'ok',
    key: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    note: '聚合站，一个密钥覆盖多数模型，明确支持浏览器直连',
  },
  {
    cors: 'warn',
    key: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    note: '官方不鼓励前端调用，直连时好时坏',
  },
  {
    cors: 'warn',
    key: 'xai',
    label: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4',
  },
  {
    cors: 'blocked',
    key: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    note: '未开放 CORS，浏览器直连必然失败，需自建代理',
  },
  {
    cors: 'warn',
    key: 'siliconflow',
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
  },
  {
    cors: 'warn',
    key: 'dashscope',
    label: '阿里云百炼（兼容模式）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    cors: 'warn',
    key: 'ark',
    label: '火山方舟',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: '',
    note: '模型名需填接入点 ID',
  },
  {
    cors: 'warn',
    key: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus',
  },
  {
    cors: 'warn',
    key: 'moonshot',
    label: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    cors: 'warn',
    key: 'ollama',
    label: '本地 Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5',
    note: '需设置 OLLAMA_ORIGINS；且 https 页面无法调 localhost，仅在 pnpm dev 下可用',
  },
  {
    cors: 'ok',
    key: 'custom',
    label: '自定义 / 自建代理',
    baseUrl: '',
    model: '',
    note: '填写任意 OpenAI 兼容端点，或你自己的转发地址',
  },
];

/** 按 key 取预设（未知 key 回落到内置回放） */
export function findPreset(key: string): DemoPreset {
  return DEMO_PRESETS.find((preset) => preset.key === key) ?? DEMO_PRESETS[0];
}

/** 把 Base URL 补全为完整对话端点（已是 /chat/completions 时原样返回） */
export function toEndpointUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return '';
  // 查询串 / 片段要留在末尾，不能拼到路径后面（如 Azure 的 ?api-version=…）
  const suffixIndex = trimmed.search(/[?#]/);
  const path = (
    suffixIndex === -1 ? trimmed : trimmed.slice(0, suffixIndex)
  ).replace(/\/+$/, '');
  const suffix = suffixIndex === -1 ? '' : trimmed.slice(suffixIndex);
  if (!path) return '';
  return path.endsWith('/chat/completions')
    ? `${path}${suffix}`
    : `${path}/chat/completions${suffix}`;
}

/** 可行性标记的展示文案 */
export const CORS_LABELS: Record<DemoCorsLevel, string> = {
  ok: '可直连',
  warn: '可能需代理',
  blocked: '需代理',
};
