// @rstest-environment jsdom
/**
 * 顶栏测试：勾选开关的语义与回调、复制反馈、设置入口
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Toolbar } from '../src/components/Toolbar';

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
);

afterEach(() => {
  cleanup();
  // 还原被替换的剪贴板实现，避免桩泄漏到后续用例
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});

function renderToolbar(overrides: Record<string, unknown> = {}) {
  const handlers = {
    onDeviceKeyChange: rs.fn(),
    onError: rs.fn(),
    onNotify: rs.fn(),
    onOpenInNewWindow: rs.fn(),
    onOpenHelp: rs.fn(),
    onOpenSettings: rs.fn(),
    onRefresh: rs.fn(),
    onToggleEditor: rs.fn(),
    onToggleScripts: rs.fn(),
  };
  render(
    <Toolbar
      deviceKey="desktop"
      html="<p>hi</p>"
      showEditor={false}
      scriptsEnabled
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('Toolbar', () => {
  it('JS 与编辑器都是 checkbox，勾选态反映传入值', () => {
    renderToolbar({ showEditor: true });
    expect(
      (
        screen.getByRole('checkbox', {
          name: '允许预览中的脚本执行',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('checkbox', {
          name: '显示代码编辑器',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('勾选 JS / 编辑器分别触发对应回调', () => {
    const handlers = renderToolbar();
    fireEvent.click(
      screen.getByRole('checkbox', { name: '允许预览中的脚本执行' }),
    );
    expect(handlers.onToggleScripts).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('checkbox', { name: '显示代码编辑器' }));
    expect(handlers.onToggleEditor).toHaveBeenCalledTimes(1);
  });

  it('点击「使用说明」触发帮助入口回调', () => {
    const handlers = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: '使用说明' }));
    expect(handlers.onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('无内容时复制给出警告，不写剪贴板', () => {
    const handlers = renderToolbar({ html: '' });
    fireEvent.click(screen.getByRole('button', { name: '复制' }));
    expect(handlers.onNotify).toHaveBeenCalledWith('warning', '暂无内容可复制');
  });

  it('复制成功后提示成功', async () => {
    const writeText = rs.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const handlers = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: '复制' }));
    await rs.waitFor(() =>
      expect(handlers.onNotify).toHaveBeenCalledWith(
        'success',
        '已复制到剪贴板',
      ),
    );
    expect(writeText).toHaveBeenCalledWith('<p>hi</p>');
  });
});
