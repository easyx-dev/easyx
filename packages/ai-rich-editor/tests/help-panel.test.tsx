// @rstest-environment jsdom
/**
 * 使用说明面板测试：标题与分区渲染、关闭行为、关闭态不渲染
 */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HelpPanel } from '../src/components/HelpPanel';
import { HELP_SECTIONS } from '../src/help-content';

afterEach(() => cleanup());

describe('HelpPanel', () => {
  it('open 时以「使用说明」为标题渲染全部分区', () => {
    render(<HelpPanel onClose={() => {}} open />);
    expect(screen.getByRole('dialog').textContent).toContain('使用说明');
    for (const section of HELP_SECTIONS) {
      expect(screen.getByText(section.title)).toBeTruthy();
    }
  });

  it('Esc 触发关闭回调', () => {
    const onClose = rs.fn();
    render(<HelpPanel onClose={onClose} open />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('open 为 false 时不渲染对话框', () => {
    render(<HelpPanel onClose={() => {}} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
