/**
 * 对话输入区：自增高 textarea + 发送/停止
 *
 * Enter 发送、Shift+Enter 换行；**输入法合成期间不发送** —— 中文候选词的上屏
 * 也会产生 Enter，若不做守卫会把半截拼音当成消息发出去。
 */
import { type KeyboardEvent, useEffect, useRef } from 'react';
import { IconArrowUp, IconStop } from '../ui/icons';
import { Button } from '../ui/primitives/Button';

/** textarea 自增高上限（px），超出后内部滚动 */
const MAX_HEIGHT = 160;

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** 生成中：展示停止按钮并屏蔽发送 */
  loading: boolean;
  onCancel: () => void;
  placeholder?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  loading,
  onCancel,
  placeholder,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // 随内容自增高：先归零再按 scrollHeight 撑开，最后夹到上限
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || loading) return;
    onSubmit(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    // 输入法合成中（含中文候选上屏）不触发发送
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="easyx-ai-rich-editor__composer">
      <textarea
        aria-label="对话输入"
        className="easyx-ai-rich-editor__composer-input"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={ref}
        rows={2}
        value={value}
      />
      <div className="easyx-ai-rich-editor__composer-actions">
        {loading ? (
          <Button
            aria-label="停止生成"
            icon={<IconStop size={14} />}
            iconOnly
            onClick={onCancel}
            variant="primary"
          />
        ) : (
          <Button
            aria-label="发送"
            disabled={!value.trim()}
            icon={<IconArrowUp size={15} />}
            iconOnly
            onClick={submit}
            variant="primary"
          />
        )}
      </div>
    </div>
  );
}
