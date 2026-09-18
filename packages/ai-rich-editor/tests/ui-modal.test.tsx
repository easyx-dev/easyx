// @rstest-environment jsdom
/**
 * 模态框测试：就地渲染、Esc/遮罩关闭、焦点归还、尺寸参数
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '../src/ui/primitives/Modal';

afterEach(() => cleanup());

function renderModal(overrides: Record<string, unknown> = {}) {
  const onClose = rs.fn();
  render(
    <Modal onClose={onClose} open title="设置" {...overrides}>
      <input aria-label="提示词" />
    </Modal>,
  );
  return { onClose };
}

describe('Modal', () => {
  it('就地渲染（不 portal 到 body 末尾之外）并带上对话框语义', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('设置');
  });

  it('默认高度上限 90%、宽度上限 800px', () => {
    renderModal();
    const dialog = screen.getByRole('dialog') as HTMLElement;
    expect(dialog.style.maxHeight).toBe('90%');
    expect(dialog.style.maxWidth).toBe('800px');
  });

  it('可覆盖尺寸参数', () => {
    renderModal({ maxHeightRatio: 0.5, maxWidth: 420 });
    const dialog = screen.getByRole('dialog') as HTMLElement;
    expect(dialog.style.maxHeight).toBe('50%');
    expect(dialog.style.maxWidth).toBe('420px');
  });

  it('传入 footer 时渲染底部操作区', () => {
    renderModal({ footer: <button type="button">保存</button> });
    const foot = document.querySelector('.easyx-ai-rich-editor__modal-foot');
    expect(foot?.textContent).toContain('保存');
  });

  it('Esc 关闭', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('点击遮罩关闭，点击面板不关闭', () => {
    const { onClose } = renderModal();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(
      document.querySelector('.easyx-ai-rich-editor__modal-overlay') as Element,
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('打开时把焦点移入面板，关闭后归还触发元素', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <Modal onClose={() => {}} open title="设置">
        <input aria-label="提示词" />
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('open 为 false 时不渲染', () => {
    render(
      <Modal onClose={() => {}} open={false} title="设置">
        <span>内容</span>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
