/**
 * 代码编辑面板的懒加载边界
 *
 * CodeMirror 与语法解析器只在「编辑器」开关打开时才拉取，不进主包；
 * 加载期间占位文案复用代码面板容器，避免布局跳动。
 */
import { lazy, Suspense } from 'react';
import type { MediaConfig } from '../media/types';
import type { AiRichErrorHandler } from '../types';

const CodeEditor = lazy(() =>
  import('../code-editor/CodeEditor').then((mod) => ({
    default: mod.CodeEditor,
  })),
);

interface EditorPanelProps {
  value: string;
  onChange?: (value: string) => void;
  /** 媒体能力：驱动面板内的上传 / 媒体库插入 */
  media?: MediaConfig;
  /** 宿主追加允许的协议（网络地址页签校验用） */
  allowedUrlSchemes?: readonly string[];
  /** 错误上报（未配置接口、上传失败、地址非法等） */
  onError?: AiRichErrorHandler;
}

export function EditorPanel({
  value,
  onChange,
  media,
  allowedUrlSchemes,
  onError,
}: EditorPanelProps) {
  return (
    <Suspense
      fallback={
        <div className="easyx-ai-rich-editor__code-panel">
          <div className="easyx-ai-rich-editor__code-loading">
            代码编辑器加载中...
          </div>
        </div>
      }
    >
      <CodeEditor
        allowedUrlSchemes={allowedUrlSchemes}
        media={media}
        onChange={onChange}
        onError={onError}
        value={value}
      />
    </Suspense>
  );
}
