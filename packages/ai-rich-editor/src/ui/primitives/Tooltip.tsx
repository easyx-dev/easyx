/**
 * Tooltip：基于 floating-ui 定位的轻量气泡
 *
 * 触发元素以 cloneElement 注入事件，不要求子元素转发 ref；移入延迟打开，
 * 移出/失焦即时关闭，避免扫过一排控件时闪出一串气泡。
 */
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom';
import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cx, isScopeDark, scopeClass } from '../cx';

/** 移入后延迟打开（ms） */
const SHOW_DELAY = 150;

export interface TooltipProps {
  title: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** 不展示气泡，仅渲染子元素 */
  disabled?: boolean;
  children: ReactElement<Record<string, unknown>>;
}

export function Tooltip({
  title,
  placement = 'top',
  disabled,
  children,
}: TooltipProps) {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [tip, setTip] = useState<HTMLDivElement | null>(null);
  const [dark, setDark] = useState(false);
  const timerRef = useRef<number | null>(null);
  const id = useId();

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (!trigger || !tip) return;
    // 容器滚动或尺寸变化时持续跟随，避免气泡留在原地
    return autoUpdate(trigger, tip, () => {
      void computePosition(trigger, tip, {
        placement,
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
      });
    });
  }, [trigger, tip, placement]);

  const show = (el: HTMLElement) => {
    if (disabled || !title) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setDark(isScopeDark(el));
      setTrigger(el);
    }, SHOW_DELAY);
  };

  const hide = () => {
    clearTimer();
    setTrigger(null);
  };

  const childProps = children.props as {
    onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<HTMLElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
    'aria-describedby'?: string;
  };

  const child = cloneElement(children, {
    'aria-describedby': trigger ? id : childProps['aria-describedby'],
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      childProps.onBlur?.(event);
      hide();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      childProps.onFocus?.(event);
      show(event.currentTarget);
    },
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      childProps.onMouseEnter?.(event);
      show(event.currentTarget);
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      childProps.onMouseLeave?.(event);
      hide();
    },
  });

  return (
    <>
      {child}
      {trigger &&
        createPortal(
          <div
            className={cx(scopeClass(dark), 'easyx-ai-rich-editor__tooltip')}
            id={id}
            ref={setTip}
            role="tooltip"
          >
            {title}
          </div>,
          document.body,
        )}
    </>
  );
}
