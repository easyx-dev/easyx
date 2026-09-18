/**
 * AI 对话消息渲染：自研 markdown 渲染层
 *
 * 助手消息全文走 marked 词法 → React 元素（见 src/markdown/renderer.tsx），
 * ```html 围栏代码块拦截渲染为「可复制/应用到编辑器」卡片，其余代码块与行内代码
 * 由包内样式的通用块渲染。
 */
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { renderMarkdown } from '../markdown/renderer';
import type { AiRichErrorHandler, AiRichNotify } from '../types';
import { IconCode, IconCopy } from '../ui/icons';
import { Button } from '../ui/primitives/Button';
import { Tooltip } from '../ui/primitives/Tooltip';
import { copyToClipboard } from '../utils/clipboard';
import type { SanitizeUrlOptions } from '../utils/url';

/** HTML 代码块卡片：头部（标签 + 复制/应用）+ 可滚动正文 */
function HtmlCodeCard({
  html,
  onApplyHtml,
  onNotify,
  onError,
}: {
  html: string;
  onApplyHtml?: (html: string) => void;
  onNotify?: AiRichNotify;
  onError?: AiRichErrorHandler;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const isFirstRender = useRef(true);

  // 流式生成过程中内容持续增长，自动滚动到底部露出最新代码（跳过挂载首轮，避免完整代码块一出现就跳到底）
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const el = preRef.current;
    if (!el || !html) return;
    el.scrollTop = el.scrollHeight;
  }, [html]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(html);
    if (ok) {
      onNotify?.('success', '已复制代码');
      return;
    }
    onError?.(new Error('复制失败'));
  };

  return (
    <div className="easyx-ai-rich-editor__code-card">
      <div className="easyx-ai-rich-editor__code-card-head">
        <span className="easyx-ai-rich-editor__code-card-label">
          <IconCode />
          HTML
        </span>
        <div className="easyx-ai-rich-editor__code-card-actions">
          <Tooltip title="复制代码">
            <Button
              aria-label="复制代码"
              className="easyx-ai-rich-editor__code-card-copy"
              icon={<IconCopy size={14} />}
              iconOnly
              onClick={() => void handleCopy()}
              size="sm"
              variant="text"
            />
          </Tooltip>
          {onApplyHtml && (
            <Tooltip title="替换编辑器中的内容">
              <Button
                onClick={() => onApplyHtml(html)}
                size="sm"
                variant="link"
              >
                应用到编辑器
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <pre className="easyx-ai-rich-editor__code-card-body" ref={preRef}>
        <code className="easyx-ai-rich-editor__code-card-code">{html}</code>
      </pre>
    </div>
  );
}

/** 非 html 的块级代码：等宽滚动块 */
function DefaultCodeBlock({ code }: { code: string }) {
  return (
    <pre className="easyx-ai-rich-editor__code-block">
      <code className="easyx-ai-rich-editor__code-block-code">{code}</code>
    </pre>
  );
}

interface MarkdownContentProps {
  content: string;
  /** 点击「应用到编辑器」回调（传入代码块内容） */
  onApplyHtml?: (html: string) => void;
  /** 轻提示回调（复制代码等） */
  onNotify?: AiRichNotify;
  /** 错误回调（复制失败） */
  onError?: AiRichErrorHandler;
  /** 链接与图片地址的白名单选项（宿主可追加协议） */
  urlOptions?: SanitizeUrlOptions;
}

export function MarkdownContent({
  content,
  onApplyHtml,
  onNotify,
  onError,
  urlOptions,
}: MarkdownContentProps) {
  const nodes: ReactNode = useMemo(() => {
    if (!content.trim()) return null;
    return renderMarkdown(
      content,
      ({ lang, code }) =>
        // 兼容 ```html id="main" 这类带附加参数的围栏
        lang.startsWith('html') ? (
          <HtmlCodeCard
            html={code}
            onApplyHtml={onApplyHtml}
            onError={onError}
            onNotify={onNotify}
          />
        ) : (
          <DefaultCodeBlock code={code} />
        ),
      urlOptions,
    );
  }, [content, onApplyHtml, onNotify, onError, urlOptions]);

  if (!content.trim()) {
    return <span className="easyx-ai-rich-editor__empty-reply">(空回复)</span>;
  }

  return <div className="easyx-ai-rich-editor__markdown">{nodes}</div>;
}
