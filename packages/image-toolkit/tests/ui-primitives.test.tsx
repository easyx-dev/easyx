// @rstest-environment jsdom
/**
 * UI 原语测试：覆盖「原生控件包装」中容易出错的两处 ——
 * number 输入的草稿与夹取时机、分段控件的选中与禁用
 */

import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Checkbox } from '../src/ui/primitives/Checkbox';
import { NumberInput } from '../src/ui/primitives/NumberInput';
import { Segmented } from '../src/ui/primitives/Segmented';

afterEach(() => {
  cleanup();
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
