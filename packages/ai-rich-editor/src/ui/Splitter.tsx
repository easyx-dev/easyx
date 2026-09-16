/**
 * 分栏：两栏可拖拽分隔，支持横向（左右）与纵向（上下）
 *
 * 尺寸模型以「首栏像素尺寸」为唯一状态：首栏给定像素尺寸、次栏吃掉剩余空间。
 * 拖拽与键盘的取值都夹在「首栏 min/max」与「次栏 min/max」共同给出的区间内，
 * 容器尺寸变化时重新夹取，避免缩窄窗口后首栏把次栏挤没。
 */
import {
  Children,
  isValidElement,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useElementSize } from '../hooks/useElementSize';
import { cx } from './cx';

/** 分隔条尺寸（px） */
const HANDLE_SIZE = 5;

/** 键盘调整的步进（px） */
const KEY_STEP = 16;

export interface SplitterPaneProps {
  children: ReactNode;
  /** 初始尺寸（px）；缺省时两栏各占一半 */
  defaultSize?: number;
  min?: number;
  max?: number;
}

/** 分栏子项：仅承载尺寸约束，实际渲染由 Splitter 负责 */
export function SplitterPane(_props: SplitterPaneProps) {
  return null;
}

export interface SplitterProps {
  orientation?: 'horizontal' | 'vertical';
  children: ReactNode;
  className?: string;
}

export function Splitter({
  orientation = 'horizontal',
  children,
  className,
}: SplitterProps) {
  const [containerRef, container] = useElementSize<HTMLDivElement>();
  const [firstSize, setFirstSize] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ pointer: 0, size: 0 });

  const panes = Children.toArray(children).filter(isValidElement) as Array<
    ReactElement<SplitterPaneProps>
  >;
  const [first, second] = panes;

  const vertical = orientation === 'vertical';
  const total = vertical ? container.height : container.width;
  const available = Math.max(0, total - HANDLE_SIZE);

  // 首栏可取区间：由两栏各自的约束共同夹出
  // 次栏 min → 首栏上界；次栏 max → 首栏下界（首栏越大次栏越小，两者方向相反）
  const secondMin = second?.props.min ?? 0;
  const secondMax = second?.props.max;
  let min = Math.max(first?.props.min ?? 0, 0);
  if (typeof secondMax === 'number') {
    min = Math.max(min, available - secondMax);
  }
  let max = available - secondMin;
  if (typeof first?.props.max === 'number')
    max = Math.min(max, first.props.max);
  // 约束互相冲突时退化为单点，避免出现空区间
  max = Math.max(min, max);

  // 尺寸就绪后初始化首栏，并在容器变化时重新夹取
  useEffect(() => {
    if (available <= 0) return;
    // 两栏都可以声明 defaultSize：首栏直接采用，次栏则换算成首栏尺寸（次栏占 available - 首栏）
    const firstDefault = first?.props.defaultSize;
    const secondDefault = second?.props.defaultSize;
    const preferred =
      firstDefault ??
      (typeof secondDefault === 'number'
        ? available - secondDefault
        : available / 2);
    setFirstSize((current) => {
      const value = current === null ? preferred : current;
      return Math.min(max, Math.max(min, value));
    });
  }, [
    available,
    min,
    max,
    first?.props.defaultSize,
    second?.props.defaultSize,
  ]);

  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    startRef.current = {
      pointer: vertical ? event.clientY : event.clientX,
      size: firstSize ?? min,
    };
    draggingRef.current = true;
    try {
      // 指针捕获失败不影响拖拽逻辑，仅影响快速拖出分隔条时的跟随
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // 忽略：继续以分隔条上的 pointermove 驱动
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    // 以按下时的尺寸为基准加位移，避免夹取后基准漂移
    const delta =
      (vertical ? event.clientY : event.clientX) - startRef.current.pointer;
    setFirstSize(clamp(startRef.current.size + delta));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // 未捕获成功时释放会抛错，忽略
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
    if (event.key === back || event.key === forward) {
      event.preventDefault();
      const delta = event.key === back ? -KEY_STEP : KEY_STEP;
      setFirstSize(clamp((firstSize ?? min) + delta));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setFirstSize(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      setFirstSize(max);
    }
  };

  const size = firstSize ?? min;

  return (
    <div
      className={cx(
        'easyx-ai-rich-editor__splitter',
        vertical && 'easyx-ai-rich-editor__splitter--vertical',
        className,
      )}
      ref={containerRef}
    >
      <div
        className="easyx-ai-rich-editor__splitter-pane"
        style={{ flex: `0 0 ${size}px` }}
      >
        {first?.props.children}
      </div>
      <div
        aria-label="调整分栏"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-valuemax={Math.round(max)}
        aria-valuemin={Math.round(min)}
        aria-valuenow={Math.round(size)}
        className="easyx-ai-rich-editor__splitter-handle"
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="separator"
        tabIndex={0}
      />
      <div className="easyx-ai-rich-editor__splitter-pane easyx-ai-rich-editor__splitter-pane--flex">
        {second?.props.children}
      </div>
    </div>
  );
}
