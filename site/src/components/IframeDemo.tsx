import { useCallback, useEffect, useRef, useState } from 'react';
import { getDemoEntry } from './demos/registry';

interface IframeDemoProps {
  /** Demo 页面 slug，对应 src/components/demos/ 下的文件名（不含扩展名） */
  slug: string;
  /** 工具栏显示的标题，缺省时取注册表中的演示标题 */
  title?: string;
  /** 源码内容，可选。传入后显示"查看代码"按钮 */
  sourceCode?: string;
}

function getParentTheme(): string {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * 同步复制兜底：execCommand 已废弃，但非安全上下文（HTTP）下没有可用的替代 API，
 * 这里以结构化类型声明调用，绕开 TypeScript 对该 API 的弃用提示
 */
function execLegacyCopy(): boolean {
  const execCommand = (
    document as unknown as { execCommand?: (commandId: string) => boolean }
  ).execCommand;

  return (
    typeof execCommand === 'function' && execCommand.call(document, 'copy')
  );
}

export default function IframeDemo({
  slug,
  title,
  sourceCode,
}: IframeDemoProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [theme, setTheme] = useState(getParentTheme);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(getParentTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'theme', theme },
      '*',
    );
  }, [theme]);

  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data?.type === 'resize' && iframeRef.current) {
      iframeRef.current.style.height = `${e.data.height}px`;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const handleOpenNewWindow = useCallback(() => {
    window.open(
      `${import.meta.env.BASE_URL}demos/${slug}?theme=${theme}`,
      '_blank',
    );
  }, [slug, theme]);

  const handleCopyCode = useCallback(async () => {
    if (!sourceCode) return;
    try {
      await navigator.clipboard.writeText(sourceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：fallback 到 textarea 方式
      const textarea = document.createElement('textarea');
      textarea.value = sourceCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      execLegacyCopy();
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [sourceCode]);

  const displayTitle = title || getDemoEntry(slug)?.title || slug;

  return (
    <div className="demo-iframe-wrapper">
      <div className="demo-iframe-toolbar">
        <span className="demo-iframe-label">{displayTitle} 演示</span>
        <div className="demo-iframe-actions">
          {sourceCode && (
            <button
              type="button"
              className={`demo-btn demo-btn-code${showCode ? ' demo-btn-code--active' : ''}`}
              onClick={() => setShowCode((prev) => !prev)}
            >
              {showCode ? '隐藏代码' : '查看代码'}
            </button>
          )}
          <button
            type="button"
            className="demo-btn"
            onClick={handleOpenNewWindow}
          >
            新窗口打开
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginLeft: 4, verticalAlign: -2 }}
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {showCode && sourceCode && (
        <div className="demo-iframe-code-panel">
          <div className="demo-iframe-code-header">
            <span className="demo-iframe-code-filename">{slug}.tsx</span>
            <button
              type="button"
              className="demo-btn demo-btn-copy"
              onClick={handleCopyCode}
            >
              {copied ? (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 4, verticalAlign: -2 }}
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  已复制
                </>
              ) : (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 4, verticalAlign: -2 }}
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  复制代码
                </>
              )}
            </button>
          </div>
          <pre className="demo-code-block demo-iframe-code">
            <code>{sourceCode}</code>
          </pre>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={`${import.meta.env.BASE_URL}demos/${slug}?theme=${theme}`}
        className="demo-iframe"
        title={`${slug} Demo`}
      />
    </div>
  );
}
