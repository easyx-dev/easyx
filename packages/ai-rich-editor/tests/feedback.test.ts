/**
 * 通知与错误通道测试
 *
 * 约定：错误会**同时**走两条通道 —— 可见文案经 onNotify('error', …)，
 * 错误实例经 onError；未注入时的兜底分别是内置轻提示与 console.error（不打扰用户）。
 */
// @rstest-environment jsdom
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { cleanup } from '@testing-library/react';
import {
  createErrorReporter,
  defaultOnError,
  defaultOnNotify,
} from '../src/ui/feedback';

afterEach(() => {
  cleanup();
  document
    .querySelectorAll('.easyx-ai-rich-editor__toast-host')
    .forEach((el) => el.remove());
  rs.restoreAllMocks();
});

describe('defaultOnNotify', () => {
  it('渲染包内轻提示并带上类型类名', () => {
    defaultOnNotify('success', '已复制到剪贴板');
    const item = document.querySelector('.easyx-ai-rich-editor__toast');
    expect(item?.textContent).toBe('已复制到剪贴板');
    expect(item?.className).toContain('toast--success');
  });

  it('提醒同样出提示', () => {
    defaultOnNotify('warning', '一次最多添加 6 个附件');
    expect(
      document.querySelector('.easyx-ai-rich-editor__toast')?.textContent,
    ).toBe('一次最多添加 6 个附件');
  });
});

describe('defaultOnError', () => {
  /** 临时替换 console.error 并返回还原函数 */
  function captureConsoleError() {
    const original = console.error;
    const spy = rs.fn();
    console.error = spy;
    return {
      restore: () => {
        console.error = original;
      },
      spy,
    };
  }

  it('只 console.error 打印，不弹任何界面', () => {
    const { restore, spy } = captureConsoleError();
    const alert = rs.fn();
    rs.stubGlobal('alert', alert);
    try {
      const error = new Error('未配置图片上传接口');
      defaultOnError(error);

      expect(spy).toHaveBeenCalledWith('[easyx-ai-rich-editor]', error);
      // 错误不上浮：既不弹原生 alert，也不出轻提示
      expect(alert).not.toHaveBeenCalled();
      expect(document.querySelector('.easyx-ai-rich-editor__toast')).toBeNull();
    } finally {
      restore();
    }
  });
});

describe('createErrorReporter', () => {
  it('错误同时进通知通道与错误通道', () => {
    const notify = rs.fn();
    const onError = rs.fn();
    createErrorReporter({ notify, onError })(new Error('上传失败'));

    expect(notify).toHaveBeenCalledWith('error', '上传失败');
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('上传失败');
  });

  it('未注入时两条通道都落到兜底实现', () => {
    const original = console.error;
    const spy = rs.fn();
    console.error = spy;
    try {
      createErrorReporter()(new Error('地址协议不被允许'));
      expect(spy).toHaveBeenCalled();
      expect(
        document.querySelector('.easyx-ai-rich-editor__toast')?.textContent,
      ).toBe('地址协议不被允许');
    } finally {
      console.error = original;
    }
  });

  it('通知通道可用时，错误提示文案取自 error.message', () => {
    const notify = rs.fn();
    createErrorReporter({ notify, onError: rs.fn() })(
      new Error('未配置视频上传接口'),
    );
    expect(notify).toHaveBeenCalledWith('error', '未配置视频上传接口');
  });
});
