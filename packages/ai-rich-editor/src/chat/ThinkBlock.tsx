/**
 * 思考块：默认折叠，展开后展示推理内容
 *
 * 流式期间标题显示「思考中…」并带转圈，与「已思考」区分。
 */
import { type ReactNode, useState } from 'react';
import { cx } from '../ui/cx';
import { IconCaretDown } from '../ui/icons';

export interface ThinkBlockProps {
  /** 本条消息是否仍在流式生成 */
  loading: boolean;
  /** 标题文案（随生成状态变化） */
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function ThinkBlock({
  loading,
  title,
  defaultExpanded = false,
  children,
}: ThinkBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="easyx-ai-rich-editor__think">
      <button
        aria-expanded={expanded}
        className="easyx-ai-rich-editor__think-summary"
        onClick={() => setExpanded((prev) => !prev)}
        type="button"
      >
        <span
          className={cx(
            'easyx-ai-rich-editor__think-caret',
            expanded && 'easyx-ai-rich-editor__think-caret--open',
          )}
        >
          <IconCaretDown />
        </span>
        <span className="easyx-ai-rich-editor__think-title">{title}</span>
        {loading && (
          <span className="easyx-ai-rich-editor__spinner easyx-ai-rich-editor__spinner--sm" />
        )}
      </button>
      {expanded && (
        <div className="easyx-ai-rich-editor__think-body">{children}</div>
      )}
    </div>
  );
}
