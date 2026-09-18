/**
 * HTML 代码编辑器：CodeMirror 6 的薄封装
 *
 * 职责边界：把 EditorView 的生命周期收敛为「挂载一次、销毁一次」，
 * value 与 onChange 都按受控组件的语义处理，但外部写入与用户输入区别对待——
 * 外部写入不进撤销栈、不触发 onChange，落地方式与光标归属见 doc-sync.ts。
 * 亮暗只驱动 CodeMirror 内置扩展的变体（暗色 facet），配色仍由 CSS 变量决定。
 *
 * 媒体插入：行号左侧的入口跟在光标所在行（见 gutter-add.ts），或直接把文件拖进内容区；
 * 两条路径都先上传（未配置类型的上传接口即报错），再在光标/落点插入自包含片段。
 * 宿主 upload / getList 返回的地址属可信来源，拼装片段时不再过协议白名单。
 */
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaPick } from '../components/MediaPicker';
import { MediaPickerPanel } from '../components/MediaPicker';
import { useIsDark } from '../hooks/useIsDark';
import { MediaNotConfiguredError, toError } from '../media/errors';
import { resolveItemKind, resolveMediaKind } from '../media/routing';
import { buildMediaSnippet } from '../media/snippet';
import type { AiRichMediaConfig } from '../media/types';
import { canUpload, uploadMediaFile } from '../media/upload';
import type { AiRichErrorHandler } from '../types';
import { writeDocSync } from './doc-sync';
import { createCodeExtensions } from './extensions';

export interface CodeEditorProps {
  /** 编辑器内容（受控） */
  value: string;
  /** 用户编辑时回调；外部写入不会触发 */
  onChange?: (value: string) => void;
  /** 媒体能力（上传 / 媒体库） */
  media?: AiRichMediaConfig;
  /** 宿主追加允许的协议（用于「网络地址」页签校验） */
  allowedUrlSchemes?: readonly string[];
  /** 错误上报（未配置接口、上传失败、地址非法等） */
  onError?: AiRichErrorHandler;
}

/** 媒体入口的锚点：入口按钮 + 所在行（行变化即收起浮层） */
interface PickerAnchor {
  anchor: HTMLElement;
  line: number;
}

export function CodeEditor({
  value,
  onChange,
  media,
  allowedUrlSchemes,
  onError,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [darkTheme] = useState(() => new Compartment());
  const isDark = useIsDark(hostRef);
  const initialRef = useRef({ value, isDark });
  const appliedDarkRef = useRef(isDark);
  const onChangeRef = useRef(onChange);
  /** 外部写入期间置位：抑制 updateListener 把程序改动回吐给宿主 */
  const applyingRef = useRef(false);
  /** 扩展在挂载时创建一次，动态值一律经 ref 读取 */
  const dropRef = useRef<((files: File[], pos: number) => boolean) | undefined>(
    undefined,
  );
  const insertRef = useRef<
    ((position: number, anchor: HTMLElement) => void) | undefined
  >(undefined);
  const mediaRef = useRef(media);
  const errorRef = useRef(onError);
  const [picker, setPicker] = useState<PickerAnchor | null>(null);
  const pickerRef = useRef<PickerAnchor | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    mediaRef.current = media;
    errorRef.current = onError;
  }, [onChange, media, onError]);

  useEffect(() => {
    pickerRef.current = picker;
  }, [picker]);

  /** 在当前光标（或指定落点）插入片段，光标落到片段之后 */
  const insertSnippet = useCallback(
    (snippet: string, pos?: number): boolean => {
      const view = viewRef.current;
      if (!view) return false;
      const from = pos ?? view.state.selection.main.from;
      view.dispatch({
        changes: { from, insert: snippet },
        scrollIntoView: true,
        selection: { anchor: from + snippet.length },
      });
      return true;
    },
    [],
  );

  /** 拼装片段并插入；地址为空（理论上不可达）时上报错误 */
  const insertMediaSnippet = useCallback(
    (input: {
      kind: Parameters<typeof buildMediaSnippet>[0]['kind'];
      url: string;
      name?: string;
      size?: number;
    }): void => {
      const snippet = buildMediaSnippet(input, { trusted: true });
      if (!snippet) {
        errorRef.current?.(new Error('媒体地址为空，已跳过插入'));
        return;
      }
      insertSnippet(snippet);
    },
    [insertSnippet],
  );

  /**
   * 拖入文件：按类型逐个上传并依次插入（后一个接在前一个之后）。
   * 任一步未配置上传接口即中止，避免出现半截结果。
   */
  const handleDropFiles = useCallback(
    (files: File[], pos: number): boolean => {
      void (async () => {
        let at = pos;
        for (const file of files) {
          const kind = resolveMediaKind(file.type);
          if (!canUpload(mediaRef.current, kind)) {
            errorRef.current?.(new MediaNotConfiguredError(kind));
            return;
          }
          try {
            const item = await uploadMediaFile(mediaRef.current, kind, file);
            const snippet = buildMediaSnippet(
              {
                kind,
                url: item.url,
                name: item.name ?? file.name,
                size: item.size ?? file.size,
              },
              { trusted: true },
            );
            if (!snippet) {
              errorRef.current?.(new Error('媒体地址为空，已跳过插入'));
              continue;
            }
            insertSnippet(snippet, at);
            at += snippet.length;
          } catch (error) {
            errorRef.current?.(toError(error));
            return;
          }
        }
      })();
      return true;
    },
    [insertSnippet],
  );

  /** 点入口按钮：再点同一个按钮收起，点到别行则由 onCursorLineChange 收起 */
  const handleRequestInsert = useCallback(
    (position: number, anchor: HTMLElement) => {
      setPicker((prev) =>
        prev?.anchor === anchor ? null : { anchor, line: position },
      );
    },
    [],
  );

  useEffect(() => {
    dropRef.current = handleDropFiles;
    insertRef.current = handleRequestInsert;
  }, [handleDropFiles, handleRequestInsert]);

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
          onFilesDropped: (files, pos) =>
            dropRef.current?.(files, pos) ?? false,
          onRequestMediaInsert: (position, anchor) =>
            insertRef.current?.(position, anchor),
          // 光标换行后入口按钮会被重建，锚点随之失效，此时收起浮层
          onCursorLineChange: (lineFrom) => {
            const current = pickerRef.current;
            if (current && current.line !== lineFrom) setPicker(null);
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

  /** 媒体浮层选择结果：URL 已由浮层校验，上传/媒体库直接使用条目信息 */
  const handlePick = (pick: MediaPick) => {
    if (pick.type === 'url') {
      insertMediaSnippet({
        kind: resolveItemKind({ id: 'url', name: '', url: pick.url }),
        url: pick.url,
      });
      return;
    }

    if (pick.type === 'upload') {
      const item = pick.item;
      if (!item) {
        errorRef.current?.(new Error('上传未完成，请重试'));
        return;
      }
      insertMediaSnippet({
        kind: pick.kind,
        name: item.name ?? pick.file.name,
        size: item.size ?? pick.file.size,
        url: item.url,
      });
      return;
    }

    insertMediaSnippet({
      kind: pick.kind,
      name: pick.item.name,
      size: pick.item.size,
      url: pick.item.url,
    });
  };

  return (
    <div className="easyx-ai-rich-editor__code-panel" ref={hostRef}>
      <MediaPickerPanel
        allowUrl
        allowedUrlSchemes={allowedUrlSchemes}
        anchor={picker?.anchor ?? null}
        media={media}
        onClose={() => setPicker(null)}
        onError={(error) => errorRef.current?.(error)}
        onPick={handlePick}
        open={Boolean(picker)}
      />
    </div>
  );
}
