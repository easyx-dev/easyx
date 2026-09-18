/**
 * 演示连接配置：持久化、解析与连通性探测
 *
 * 密钥以明文存在 localStorage，仅用于本机演示 —— 面板内会显著警示。
 * 解析结果直接对应 AiRichEditor 的连接三件套；内置回放返回 undefined。
 */
import { DEMO_PRESET_KEY, findPreset, toEndpointUrl } from './presets';

const STORAGE_KEY = 'easyx-ai-rich-editor-demo-connection';

/** 探测超时：超过即视为不可达 */
const PROBE_TIMEOUT = 15000;

/** 连接草稿（本地持久化） */
export interface DemoConnection {
  /** 预设 key；内置回放为 'demo' */
  preset: string;
  /** OpenAI 兼容 Base URL */
  baseUrl: string;
  /** API Key（明文存本机） */
  apiKey: string;
  /** 模型名 */
  model: string;
}

/** 组件入参形态：解析成功时用于 AiRichEditor */
export interface ResolvedConnection {
  endpointUrl: string;
  model: string;
  requestHeaders?: Record<string, string>;
}

export const DEFAULT_CONNECTION: DemoConnection = {
  baseUrl: '',
  apiKey: '',
  model: '',
  preset: DEMO_PRESET_KEY,
};

/** 读取本地连接配置；不可用时回落默认值 */
export function readConnection(): DemoConnection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONNECTION;
    const parsed = JSON.parse(raw) as Partial<DemoConnection>;
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
      preset:
        typeof parsed.preset === 'string' ? parsed.preset : DEMO_PRESET_KEY,
    };
  } catch {
    return DEFAULT_CONNECTION;
  }
}

/** 写入本地连接配置（隐私模式等场景静默失败） */
export function writeConnection(connection: DemoConnection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
  } catch {
    // 存储不可用不影响本次会话内的使用
  }
}

/** 清除本地连接配置 */
export function clearConnection(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}

/**
 * 解析为组件入参
 *
 * 内置回放、或端点 / 模型未填全时返回 undefined（组件回落回放模式）。
 */
export function resolveConnection(
  connection: DemoConnection,
): ResolvedConnection | undefined {
  if (connection.preset === DEMO_PRESET_KEY) return undefined;
  const endpointUrl = toEndpointUrl(connection.baseUrl);
  const model = connection.model.trim();
  if (!endpointUrl || !model) return undefined;
  return {
    endpointUrl,
    model,
    requestHeaders: connection.apiKey.trim()
      ? { Authorization: `Bearer ${connection.apiKey.trim()}` }
      : undefined,
  };
}

/** 探测结果：成功返回可展示的说明 */
export async function probeConnection(
  resolved: ResolvedConnection,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
  try {
    const response = await fetch(resolved.endpointUrl, {
      body: JSON.stringify({
        messages: [{ content: 'ping', role: 'user' }],
        model: resolved.model,
        stream: true,
      }),
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...resolved.requestHeaders,
      },
      method: 'POST',
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = readErrorText(await response.text());
      throw new Error(
        detail
          ? `HTTP ${response.status}：${detail}`
          : `HTTP ${response.status} ${response.statusText}`,
      );
    }
    if (!response.body) throw new Error('响应没有可读的流式内容');

    // 读到首块数据即认为链路通；若首块就是错误对象则视为失败
    const reader = response.body.getReader();
    const first = await reader.read();
    reader.cancel().catch(() => {});
    const text = first.value ? new TextDecoder().decode(first.value) : '';
    const errorText = readErrorText(text);
    if (errorText) throw new Error(errorText);
    return '连接成功，已收到流式响应';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('连接超时，请检查端点或跨域设置');
    }
    // fetch 的网络 / 跨域失败统一抛 TypeError，给出可操作文案
    if (error instanceof TypeError) {
      throw new Error(
        '无法连接（网络不可达或跨域被拦），请检查端点地址，或改用支持浏览器直连的提供方与自建代理',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** 从错误体 / 响应片段里提取可读文案（找不到返回空串） */
function readErrorText(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
    const message = (parsed.error as { message?: unknown } | undefined)
      ?.message;
    return typeof message === 'string' ? message : '';
  } catch {
    // SSE 片段不是完整 JSON：仅当确实带 error 字段时才提取 message，
    // 否则会把模型正文里的 "message": "…" 误判成错误
    if (!/"error"\s*:/.test(raw)) return '';
    const matched = raw.match(/"message"\s*:\s*"([^"]+)"/);
    return matched ? matched[1] : '';
  }
}

/** 预设切换时套用其 Base URL 与默认模型 */
export function applyPreset(
  connection: DemoConnection,
  presetKey: string,
): DemoConnection {
  const preset = findPreset(presetKey);
  return {
    ...connection,
    baseUrl: preset.baseUrl,
    model: preset.model,
    preset: preset.key,
  };
}
