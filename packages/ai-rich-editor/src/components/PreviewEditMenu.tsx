/**
 * 预览区右键的就地编辑浮层
 *
 * 右键命中元素后浮出：显示目标（单个显示选区/元素摘要，多个显示已选数量），
 * 输入指令回车即发给 AI。Shift + 右键可在预览里继续增减目标。
 * 以 portal 渲染并带上令牌作用域类；Esc / 取消关闭，Shift+Enter 换行。
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AiRichNotify } from '../types';
import { cx, scopeClass } from '../ui/cx';
import { Button } from '../ui/primitives/Button';
import type { PreviewTarget } from '../utils/blocks';
import { copyToClipboard } from '../utils/clipboard';

export interface PreviewEditMenuProps {
  /** 视口坐标（已按 iframe 缩放换算） */
  anchor: { x: number; y: number } | null;
  /** 已选目标（一个或多个） */
  targets: PreviewTarget[];
  /** 是否暗色（决定令牌作用域类） */
  dark: boolean;
  onNotify?: AiRichNotify;
  onClose: () => void;
  onSubmit: (instruction: string) => void;
}

export function PreviewEditMenu({
  anchor,
  targets,
  dark,
  onNotify,
  onClose,
  onSubmit,
}: PreviewEditMenuProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const open = anchor !== null;
  // 目标增减时用它判断「选中集合是否变化」，避免依赖每次渲染都新建的 targets 数组引用
  const targetsKey = targets.map((target) => target.elementId).join(',');

  // 仅在「打开」时清空并聚焦；不依赖 anchor 对象引用，
  // 否则增减目标（或多选过程中的任何重渲染）会把已输入的指令清掉。
  useEffect(() => {
    if (!open) return;
    setValue('');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  // 目标增减后焦点可能落到 iframe 上，重新拉回输入框（保留已输入内容）
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, targetsKey]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!anchor || targets.length === 0) return null;

  const submit = () => {
    const instruction = value.trim();
    if (!instruction) return;
    onSubmit(instruction);
    onClose();
  };

  const handleCopy = async () => {
    const text = targets
      .map((target) => target.selectedText ?? target.targetHtml)
      .join('\n\n');
    const ok = await copyToClipboard(text);
    onNotify?.(ok ? 'success' : 'error', ok ? '已复制' : '复制失败');
  };

  const single = targets.length === 1 ? targets[0] : null;
  const summary = single
    ? single.selectedText
      ? `选区：${single.selectedText}`
      : `元素：${single.targetHtml.slice(0, 40)}${single.targetHtml.length > 40 ? '…' : ''}`
    : `已选 ${targets.length} 个元素`;

  return createPortal(
    <div
      className={cx(scopeClass(dark), 'easyx-ai-rich-editor__preview-edit')}
      style={{ left: anchor.x, top: anchor.y }}
    >
      <div className="easyx-ai-rich-editor__preview-edit-head">
        <span className="easyx-ai-rich-editor__preview-edit-title">
          用 AI 修改此处
        </span>
        <span
          className="easyx-ai-rich-editor__preview-edit-target"
          title={summary}
        >
          {summary}
        </span>
        <span className="easyx-ai-rich-editor__preview-edit-hint">
          Shift + 右键可增减元素
        </span>
      </div>
      <textarea
        className="easyx-ai-rich-editor__preview-edit-input"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="描述要怎么改，回车发送…"
        ref={inputRef}
        rows={2}
        value={value}
      />
      <div className="easyx-ai-rich-editor__preview-edit-actions">
        <Button onClick={() => void handleCopy()} size="sm" variant="text">
          复制
        </Button>
        <span className="easyx-ai-rich-editor__preview-edit-spacer" />
        <Button onClick={onClose} size="sm" variant="text">
          取消
        </Button>
        <Button
          disabled={!value.trim()}
          onClick={submit}
          size="sm"
          variant="primary"
        >
          发送
        </Button>
      </div>
    </div>,
    document.body,
  );
}
