// @rstest-environment jsdom
/**
 * UI 原语测试：覆盖「原生控件包装」中容易出错的三处 ——
 * number 输入的草稿与夹取时机、select 的 null 值映射、modal 的 portal/关闭/主题
 */

import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Checkbox } from '../src/ui/primitives/Checkbox';
import { Modal } from '../src/ui/primitives/Modal';
import { NumberInput } from '../src/ui/primitives/NumberInput';
import { Segmented } from '../src/ui/primitives/Segmented';
import { Select } from '../src/ui/primitives/Select';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('NumberInput', () => {
  it('输入过程中不提交，失焦时夹取到上限', () => {
    const onChange = rs.fn();
    render(
      <NumberInput
        aria-label="宽度"
        max={100}
        min={1}
        value={50}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('宽度');

    fireEvent.change(input, { target: { value: '999' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('空输入失焦时回退到受控值，不提交', () => {
    const onChange = rs.fn();
    render(
      <NumberInput aria-label="宽度" min={1} value={50} onChange={onChange} />,
    );
    const input = screen.getByLabelText('宽度');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('50');
  });

  it('回车提交区间内的值', () => {
    const onChange = rs.fn();
    render(
      <NumberInput
        aria-label="宽度"
        min={1}
        max={100}
        value={50}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('宽度');

    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(42);
  });
});

describe('Select', () => {
  const options = [
    { label: '不降色（真彩）', value: null },
    { label: '256 色', value: 256 },
  ];

  it('null 值映射为空串，选中数字项时回传原始值', () => {
    const onChange = rs.fn();
    render(
      <Select
        aria-label="调色板"
        onChange={onChange}
        options={options}
        value={null}
      />,
    );
    const select = screen.getByLabelText('调色板') as HTMLSelectElement;

    expect(select.value).toBe('');

    fireEvent.change(select, { target: { value: '256' } });
    expect(onChange).toHaveBeenCalledWith(256);
  });
});

describe('Segmented', () => {
  it('选中项标记 checked，禁用项不可选', () => {
    const onChange = rs.fn();
    render(
      <Segmented
        aria-label="压缩模式"
        onChange={onChange}
        options={[
          { label: '有损压缩', value: 'lossy' },
          { label: '无损优化', value: 'lossless' },
          { disabled: true, label: '自定义', value: 'custom' },
        ]}
        value="lossy"
      />,
    );

    expect(
      (screen.getByRole('radio', { name: '有损压缩' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole('radio', { name: '自定义' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: '无损优化' }));
    expect(onChange).toHaveBeenCalledWith('lossless');
  });

  it('整体 disabled 时所有选项都禁用', () => {
    render(
      <Segmented
        aria-label="比例"
        disabled
        onChange={() => {}}
        options={[
          { label: '100%', value: '100' },
          { label: '75%', value: '75' },
        ]}
        value="100"
      />,
    );

    for (const label of ['100%', '75%']) {
      expect(
        (screen.getByRole('radio', { name: label }) as HTMLInputElement)
          .disabled,
      ).toBe(true);
    }
  });
});

describe('Checkbox', () => {
  it('点击回调新状态', () => {
    const onChange = rs.fn();
    render(
      <Checkbox checked={false} onChange={onChange}>
        剥离元数据
      </Checkbox>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: '剥离元数据' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Modal', () => {
  it('打开时渲染在 body 上并锁定滚动，关闭即卸载', () => {
    const onClose = rs.fn();
    const { rerender } = render(
      <Modal onClose={onClose} open title="编辑图片">
        内容
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    // portal 根自带令牌作用域，脱离宿主 DOM 后仍能取到样式变量
    expect(dialog.closest('.easyx-image-toolkit')?.className).toContain(
      'easyx-image-toolkit__overlay',
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal onClose={onClose} open={false} title="编辑图片">
        内容
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('Esc 关闭；点面板不关闭，点遮罩才关闭', () => {
    const onClose = rs.fn();
    render(
      <Modal onClose={onClose} open title="编辑图片">
        内容
      </Modal>,
    );

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    const overlay = document.querySelector('.easyx-image-toolkit__overlay');
    fireEvent.mouseDown(overlay as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('theme="dark" 时把暗色类带到 portal 根上', () => {
    render(
      <Modal onClose={() => {}} open theme="dark" title="编辑图片">
        内容
      </Modal>,
    );

    const overlay = document.querySelector('.easyx-image-toolkit__overlay');
    expect(overlay?.classList.contains('easyx-image-toolkit-dark')).toBe(true);
  });
});
