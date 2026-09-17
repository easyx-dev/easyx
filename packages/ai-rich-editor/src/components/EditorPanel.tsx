/**
 * 代码编辑面板的懒加载边界
 *
 * CodeMirror 与语法解析器只在「编辑器」开关打开时才拉取，不进主包；
 * 加载期间占位文案复用代码面板容器，避免布局跳动。
 */
import { lazy, Suspense } from 'react';

const CodeEditor = lazy(() =>
  import('../code-editor/CodeEditor').then((mod) => ({
    default: mod.CodeEditor,
  })),
);

interface EditorPanelProps {
  value: string;
  onChange?: (value: string) => void;
}

export function EditorPanel({ value, onChange }: EditorPanelProps) {
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
      <CodeEditor onChange={onChange} value={value} />
    </Suspense>
  );
}
