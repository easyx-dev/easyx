/**
 * 代码面板的中文文案覆盖
 *
 * CodeMirror 的查找面板、行跳转、补全列表与读屏播报都经 EditorState.phrases 取文案，
 * 包内其余界面均为中文，故在此统一覆盖（`$` / `$n` 为 CodeMirror 的占位符，不可省略）。
 */
import { EditorState } from '@codemirror/state';

/** 查找 / 替换 / 跳转行 / 补全的文案表 */
export const CODE_PHRASES: Record<string, string> = {
  Find: '查找',
  Replace: '替换',
  next: '下一个',
  previous: '上一个',
  all: '全部',
  'match case': '区分大小写',
  regexp: '正则',
  'by word': '全词',
  replace: '替换',
  'replace all': '全部替换',
  close: '关闭',
  'current match': '当前匹配',
  'on line': '所在行',
  'replaced match on line $': '已替换第 $ 行',
  'replaced $ matches': '已替换 $ 处匹配',
  'Go to line': '跳转到行',
  go: '跳转',
  Completions: '补全',
};

/** 文案覆盖扩展 */
export const codePhrases = EditorState.phrases.of(CODE_PHRASES);
