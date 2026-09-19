/**
 * 补丁标记判定（独立成模块）
 *
 * 声明在 patch.ts 会让 extract ↔ patch 形成循环引用：extract 需要判定
 * 「这段内容是不是补丁」以免把 `<<<<<<< SEARCH` 当成 HTML 片段，
 * 而 patch 又需要 extract 提取全量片段。把标记判定下沉到本模块即可解开环。
 */

/** 是否出现补丁起始标记（允许前导空白、大小写差异与 ≥3 连字符） */
export function hasPatchMarker(content: string): boolean {
  return /^[ \t]*<{3,}[ \t]*SEARCH\b/im.test(content);
}
