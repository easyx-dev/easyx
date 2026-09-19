import './styles/index.scss';

import { createEditorInstance } from './core/create-editor';
import type { EditorOptions, EditorTheme } from './types';
import type { EditorEventHandler } from './utils/event-emitter';

export type {
  EditorContentType,
  EditorImageConfig,
  EditorOptions,
  EditorTheme,
  MediaItem,
  MediaListParams,
  MediaListResult,
  MediaUploadConfig,
  MediaUploadProgress,
} from './types';
export type { EditorEventHandler } from './utils/event-emitter';

export function createEditor(container: HTMLElement, options: EditorOptions) {
  if (!container) throw new Error('创建编辑器失败：container 参数不能为空');
  const { editor, emitter } = createEditorInstance(container, options);

  return {
    isEmpty(): boolean {
      return editor.isEmpty;
    },

    clear(): void {
      editor.commands.clearContent();
    },

    setHTML(html: string): void {
      editor.commands.setContent(html);
    },

    getHTML(): string {
      return editor.getHTML();
    },

    getText(): string {
      return editor.getText();
    },

    setJSON(json: Record<string, unknown>): void {
      editor.commands.setContent(json);
    },

    getJSON(): Record<string, unknown> {
      return editor.getJSON() as Record<string, unknown>;
    },

    setTheme(theme: EditorTheme): void {
      if (theme === 'dark') {
        container.classList.add('easyx-editor-dark');
      } else {
        container.classList.remove('easyx-editor-dark');
      }
      editor.commands.setTablePlusTheme(theme);
    },

    focus(): void {
      editor.commands.focus();
    },

    blur(): void {
      editor.commands.blur();
    },

    isFocused(): boolean {
      return editor.isFocused;
    },

    disable(): void {
      container.classList.add('easyx-editor-disabled');
      editor.setEditable(false);
    },

    enable(): void {
      container.classList.remove('easyx-editor-disabled');
      editor.setEditable(true);
    },

    isDisabled(): boolean {
      return !editor.isEditable;
    },

    getContainer(): HTMLElement {
      return container;
    },

    destroy(): void {
      editor.destroy();
      emitter.removeAllListeners();
      container.innerHTML = '';
      container.classList.remove(
        'easyx-editor',
        'easyx-editor-dark',
        'easyx-editor-disabled',
        'easyx-editor-readonly',
      );
    },

    on(event: string, handler: EditorEventHandler): void {
      emitter.on(event, handler);
    },

    off(event: string, handler: EditorEventHandler): void {
      emitter.off(event, handler);
    },

    once(event: string, handler: EditorEventHandler): void {
      emitter.once(event, handler);
    },

    emit(event: string, ...args: unknown[]): void {
      emitter.emit(event, ...args);
    },
  };
}
