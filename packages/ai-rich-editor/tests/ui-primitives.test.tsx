// @rstest-environment jsdom
/**
 * 分栏与 UI 原语测试
 *
 * Splitter 的尺寸约束是这里最值得钉住的部分：拖拽、键盘、容器尺寸变化三条路径
 * 都要落在「首栏 min/max 与次栏 min/max 共同给出的区间」内。
 * jsdom 无布局引擎，需桩掉 offsetWidth/offsetHeight 才能驱动尺寸计算。
 */

import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { Checkbox } from '../src/ui/primitives/Checkbox';
import { Dropdown } from '../src/ui/primitives/Dropdown';
import { Segmented } from '../src/ui/primitives/Segmented';
import { Splitter, SplitterPane } from '../src/ui/Splitter';

const CONTAINER_WIDTH = 1000;
const CONTAINER_HEIGHT = 600;

/**
 * jsdom 未实现 ResizeObserver，用一个「观察即回调」的假实现驱动尺寸
 * useElementSize 正是靠它在挂载时拿到容器尺寸
 */
class FakeResizeObserver {
  private readonly cb: ResizeObserverCallback;

  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }

  observe(): void {
    this.cb(
      [
        {
          contentRect: {
            bottom: CONTAINER_HEIGHT,
            height: CONTAINER_HEIGHT,
            left: 0,
            right: CONTAINER_WIDTH,
            top: 0,
            width: CONTAINER_WIDTH,
            x: 0,
            y: 0,
          },
        },
      ] as unknown as ResizeObserverEntry[],
      this as unknown as ResizeObserver,
    );
  }

  unobserve(): void {}

  disconnect(): void {}
}

beforeEach(() => {
  rs.stubGlobal('ResizeObserver', FakeResizeObserver);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => CONTAINER_WIDTH,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => CONTAINER_HEIGHT,
  });
  rs.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: CONTAINER_HEIGHT,
    height: CONTAINER_HEIGHT,
    left: 0,
    right: CONTAINER_WIDTH,
    top: 0,
    width: CONTAINER_WIDTH,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  rs.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
});

/** 取得分隔条当前值 */
function handleValue(): number {
  const handle = screen.getByRole('separator', { name: '调整分栏' });
  return Number(handle.getAttribute('aria-valuenow'));
}

/** 渲染两栏：次栏给定 defaultSize/min/max，首栏 min */
function renderSplitter(options?: {
  firstMin?: number;
  secondDefault?: number;
  secondMin?: number;
  secondMax?: number;
}) {
  render(
    <Splitter>
      <SplitterPane min={options?.firstMin}>左</SplitterPane>
      <SplitterPane
        defaultSize={options?.secondDefault}
        max={options?.secondMax}
        min={options?.secondMin}
      >
        右
      </SplitterPane>
    </Splitter>,
  );
}

describe('Splitter', () => {
  it('按次栏 defaultSize 初始化首栏尺寸（容器 1000 - 分隔条 5 - 420）', () => {
    renderSplitter({ secondDefault: 420, secondMin: 400, secondMax: 600 });
    expect(handleValue()).toBe(575);
  });

  it('拖拽按位移更新，且夹在「次栏 min/max」给出的区间内', () => {
    renderSplitter({ secondDefault: 420, secondMin: 400, secondMax: 600 });
    const handle = screen.getByRole('separator', { name: '调整分栏' });
    // 次栏 min 400 → 首栏上限 595；次栏 max 600 → 首栏下限 395
    const drag = (from: number, to: number) => {
      fireEvent.pointerDown(handle, { clientX: from, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: to, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientX: to, pointerId: 1 });
    };

    drag(575, 675);
    expect(handleValue()).toBe(595);

    drag(595, 0);
    expect(handleValue()).toBe(395);
  });

  it('抬起后继续移动不再改变位置', () => {
    renderSplitter({ secondDefault: 420, secondMin: 400, secondMax: 600 });
    const handle = screen.getByRole('separator', { name: '调整分栏' });

    fireEvent.pointerDown(handle, { clientX: 575, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 600, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 600, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 });

    // 位移 +25 会撞上次栏 min 给出的上界 595
    expect(handleValue()).toBe(595);
  });

  it('键盘方向键与 Home/End 都能调整', () => {
    renderSplitter({ secondDefault: 420, secondMin: 400, secondMax: 600 });
    const handle = screen.getByRole('separator', { name: '调整分栏' });

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handleValue()).toBe(559);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handleValue()).toBe(575);
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handleValue()).toBe(395);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handleValue()).toBe(595);
  });

  it('无 defaultSize 时两栏平分', () => {
    renderSplitter({ firstMin: 100 });
    expect(handleValue()).toBe(498);
  });

  it('无障碍属性齐全（可聚焦 + aria 区间）', () => {
    renderSplitter({ secondDefault: 420, secondMin: 400, secondMax: 600 });
    const handle = screen.getByRole('separator', { name: '调整分栏' });
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-valuemin')).toBe('395');
    expect(handle.getAttribute('aria-valuemax')).toBe('595');
  });
});

describe('Dropdown', () => {
  it('点击展开、选择后回传 key 并关闭', () => {
    const onSelect = rs.fn();
    render(
      <Dropdown
        items={[
          { key: 'a', label: '项目一' },
          { key: 'b', label: '项目二' },
        ]}
        onSelect={onSelect}
        trigger={<button type="button">打开</button>}
      />,
    );

    fireEvent.click(screen.getByText('打开'));
    expect(screen.getByRole('menu')).toBeTruthy();
    // portal 根带上令牌作用域，脱离宿主 DOM 后样式仍成立
    expect(
      screen.getByRole('menu').classList.contains('easyx-ai-rich-editor-scope'),
    ).toBe(true);

    fireEvent.click(screen.getByText('项目一'));
    expect(onSelect).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Esc 关闭', () => {
    render(
      <Dropdown
        items={[{ key: 'a', label: '项目一' }]}
        onSelect={() => {}}
        trigger={<button type="button">打开</button>}
      />,
    );
    fireEvent.click(screen.getByText('打开'));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Checkbox', () => {
  it('是原生 checkbox，回调新状态', () => {
    const onChange = rs.fn();
    render(
      <Checkbox aria-label="允许脚本" checked={false} onChange={onChange}>
        允许脚本
      </Checkbox>,
    );
    const input = screen.getByRole('checkbox', { name: '允许脚本' });
    expect((input as HTMLInputElement).checked).toBe(false);

    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('方框与标签是原生控件的兄弟节点，勾选态由受控 checked 决定', () => {
    const { rerender } = render(
      <Checkbox aria-label="显示编辑器" checked={false} onChange={() => {}}>
        编辑器
      </Checkbox>,
    );
    const input = screen.getByRole('checkbox', { name: '显示编辑器' });
    expect((input as HTMLInputElement).checked).toBe(false);
    // 方框与标签都是原生控件的兄弟节点，保证样式选择器可命中
    expect(input.nextElementSibling?.className).toContain(
      'easyx-ai-rich-editor__checkbox-box',
    );

    rerender(
      <Checkbox aria-label="显示编辑器" checked onChange={() => {}}>
        编辑器
      </Checkbox>,
    );
    expect(
      (screen.getByRole('checkbox', { name: '显示编辑器' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
});

describe('Segmented', () => {
  it('渲染为 radio 组，选中态与禁用项正确', () => {
    const onChange = rs.fn();
    render(
      <Segmented
        aria-label="设备"
        onChange={onChange}
        options={[
          { label: '桌面', value: 'desktop' },
          { disabled: true, label: '手机', value: 'mobile' },
        ]}
        value="desktop"
      />,
    );

    expect(
      (screen.getByRole('radio', { name: '桌面' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByRole('radio', { name: '手机' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    // 禁用项由原生 disabled 阻断交互，浏览器不会再派发 change
  });
});

describe('toast', () => {
  it('创建带令牌作用域的宿主，并追加对应语气的提示', async () => {
    const { toast } = await import('../src/ui/toast');
    toast('success', '已复制');

    const host = document.querySelector('.easyx-ai-rich-editor__toast-host');
    expect(host?.classList.contains('easyx-ai-rich-editor-scope')).toBe(true);
    const item = host?.querySelector('.easyx-ai-rich-editor__toast--success');
    expect(item?.textContent).toBe('已复制');
    expect(item?.getAttribute('role')).toBe('status');

    // 清理：避免残留宿主影响其他用例
    act(() => {
      host?.remove();
    });
  });
});
