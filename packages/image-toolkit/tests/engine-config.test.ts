/**
 * 引擎配置测试：地址注入优先级与「仅远程」构建下的明确报错
 *
 * 「仅远程」标记正常由构建期 define 注入，测试经 setRemoteOnlyBuild 覆写以覆盖该分支；
 * 本地打包资源经 bundled-wasm 模块替换（`?url` 由打包器解析，测试环境无法直接执行）。
 */
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

rs.mock('../src/ui/engine/bundled-wasm', () => ({
  loadBundledWasmUrl: () => 'file:///dist/ui/engine/magick.wasm',
}));

import {
  configureImageEngine,
  getConfiguredWasmUrl,
  resolveEngineWasmUrl,
  setRemoteOnlyBuild,
} from '../src/ui/engine/config';

describe('configureImageEngine / resolveEngineWasmUrl', () => {
  beforeEach(() => {
    configureImageEngine({ wasmUrl: null });
    setRemoteOnlyBuild(false);
  });

  afterEach(() => {
    setRemoteOnlyBuild(false);
  });

  it('注入地址后优先使用，并去除首尾空白', async () => {
    configureImageEngine({ wasmUrl: '  https://cdn.test/magick.wasm  ' });

    expect(getConfiguredWasmUrl()).toBe('https://cdn.test/magick.wasm');
    await expect(resolveEngineWasmUrl()).resolves.toBe(
      'https://cdn.test/magick.wasm',
    );
  });

  it('注入空白串视为未配置', () => {
    configureImageEngine({ wasmUrl: '   ' });

    expect(getConfiguredWasmUrl()).toBeNull();
  });

  it('仅远程构建下未注入地址时明确报错，而非静默失败', async () => {
    setRemoteOnlyBuild(true);

    await expect(resolveEngineWasmUrl()).rejects.toThrow(
      /EASYX_IMAGE_TOOLKIT_REMOTE/,
    );
  });

  it('仅远程构建下注入地址后仍可正常解析', async () => {
    setRemoteOnlyBuild(true);
    configureImageEngine({ wasmUrl: 'https://cdn.test/magick.wasm' });

    await expect(resolveEngineWasmUrl()).resolves.toBe(
      'https://cdn.test/magick.wasm',
    );
  });

  it('未注入地址且非远程模式时回退本地打包资源', async () => {
    await expect(resolveEngineWasmUrl()).resolves.toBe(
      'file:///dist/ui/engine/magick.wasm',
    );
  });
});
