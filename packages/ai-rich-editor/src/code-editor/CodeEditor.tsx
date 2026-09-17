/**
 * HTML 代码编辑器：CodeMirror 6 的薄封装
 *
 * 职责边界：把 EditorView 的生命周期收敛为「挂载一次、销毁一次」，
 * value 与 onChange 都按受控组件的语义处理，但外部写入与用户输入区别对待——
 * 外部写入不进撤销栈、不触发 onChange，落地方式与光标归属见 doc-sync.ts。
 * 亮暗只驱动 CodeMirror 内置扩展的变体（暗色 facet），配色仍由 CSS 变量决定。
 */
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import { useIsDark } from '../hooks/useIsDark';
import { writeDocSync } from './doc-sync';
import { createCodeExtensions } from './extensions';

export interface CodeEditorProps {
  /** 编辑器内容（受控） */
  value: string;
  /** 用户编辑时回调；外部写入不会触发 */
  onChange?: (value: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [darkTheme] = useState(() => new Compartment());
  const isDark = useIsDark(hostRef);
  const initialRef = useRef({ value, isDark });
  const appliedDarkRef = useRef(isDark);
  const onChangeRef = useRef(onChange);
  /** 外部写入期间置位：抑制 updateListener 把程序改动回吐给宿主 */
  const applyingRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // 创建编辑器：整块生命周期只执行一次，后续变化由下面两个同步 effect 驱动
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const { value: doc, isDark: dark } = initialRef.current;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc,
        extensions: createCodeExtensions({
          darkTheme,
          isDark: dark,
          onDocChange: (next) => {
            if (applyingRef.current) return;
            onChangeRef.current?.(next);
          },
        }),
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [darkTheme]);

  // 亮暗切换：只改用 CodeMirror 自带的亮暗变体取值
  useEffect(() => {
    if (appliedDarkRef.current === isDark) return;
    appliedDarkRef.current = isDark;
    viewRef.current?.dispatch({
      effects: darkTheme.reconfigure(EditorView.darkTheme.of(isDark)),
    });
  }, [isDark, darkTheme]);

  // 外部 value 同步：流式追加只补尾部（光标不跳），整体替换才重写全文
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    applyingRef.current = true;
    try {
      writeDocSync(view, value);
    } finally {
      applyingRef.current = false;
    }
  }, [value]);

  return <div className="easyx-ai-rich-editor__code-panel" ref={hostRef} />;
}
