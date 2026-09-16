/**
 * 引擎配置：解析 wasm 地址（宿主注入优先，回退本地打包资源）
 */
import { loadBundledWasmUrl } from './bundled-wasm';
import { ImageEngineConfigError } from './errors';

let configuredWasmUrl: string | null = null;

/**
 * 是否已剥离本地 wasm 副本
 * 构建期由 define 注入；未注入的环境（测试 / 源码直引）降级为 false
 */
let remoteOnlyBuild =
  typeof __EASYX_IMAGE_TOOLKIT_REMOTE_ONLY__ !== 'undefined' &&
  __EASYX_IMAGE_TOOLKIT_REMOTE_ONLY__ === true;

/**
 * 注入图片引擎 wasm 地址（宿主可指向 CDN 或自有静态资源）
 * 留空则回退到本地打包资源
 */
export function configureImageEngine(options: {
  wasmUrl?: string | null;
}): void {
  const value = options.wasmUrl?.trim();
  configuredWasmUrl = value ? value : null;
}

/** 当前生效的注入地址（便于诊断，未注入时为 null） */
export function getConfiguredWasmUrl(): string | null {
  return configuredWasmUrl;
}

/**
 * 覆写「仅远程」构建标记
 * 仅测试使用：该标记正常由构建期 define 注入，运行期不可变
 */
export function setRemoteOnlyBuild(value: boolean): void {
  remoteOnlyBuild = value;
}

/**
 * 解析引擎 wasm 地址
 *
 * 优先级：宿主注入地址 → 本地打包资源。
 * 自定义构建（EASYX_IMAGE_TOOLKIT_REMOTE=1）会剥离本地副本，
 * 此时必须注入地址，否则明确报错而不是静默失败（见包 README）。
 */
export async function resolveEngineWasmUrl(): Promise<string> {
  if (configuredWasmUrl) return configuredWasmUrl;

  if (remoteOnlyBuild) {
    throw new ImageEngineConfigError(
      '构建时已启用远程 wasm 模式（EASYX_IMAGE_TOOLKIT_REMOTE=1），必须通过 configureImageEngine 注入 wasm 地址',
    );
  }

  return loadBundledWasmUrl();
}
