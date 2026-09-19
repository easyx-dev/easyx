/**
 * 外部 value → 编辑器文档的落地策略（纯函数）
 *
 * 代码面板的 value 有三种来源：用户输入、AI 流式同步、整段替换 / 手动应用补丁。
 * 后两者由宿主经 value 回灌，若一律整篇替换会带来两个问题：
 * 1. 流式场景每次同步都重置光标与选区，用户无法在生成过程中继续编辑；
 * 2. 外部写入进撤销栈后，Ctrl+Z 会逐段回退 AI 内容而不是用户自己的输入。
 *
 * 因此把「怎么落地」抽成可单测的判定：按公共前缀/后缀求出最小改动区间，
 * 只替换变化的那一段；外部写入都不进撤销栈。
 */
import { type ChangeSpec, Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** 文档同步动作 */
export type DocSyncPlan =
  /** 与当前文档一致，无需改动 */
  | { type: 'noop' }
  /** 最小改动：只替换 [from, to) 为 insert（整篇替换是 from=0 的特例，尾部追加是 from=to 的特例） */
  | { type: 'edit'; from: number; to: number; insert: string };

/**
 * 计算把文档从 current 变为 next 的最小改动
 *
 * 取公共前缀与公共后缀，中间的差异段即改动区间：
 * - AI 流式追加 → from=to=末尾，只补尾部；
 * - 作用域前缀改写导致的中段差异 → 只替换真正变化的部分，不再整篇重置。
 *
 * @param current 编辑器当前文档内容
 * @param next 宿主给出的目标内容
 */
export function planDocSync(current: string, next: string): DocSyncPlan {
  if (current === next) return { type: 'noop' };

  const maxPrefix = Math.min(current.length, next.length);
  let start = 0;
  while (start < maxPrefix && current[start] === next[start]) start++;

  // 公共后缀不与公共前缀重叠
  let endCurrent = current.length;
  let endNext = next.length;
  while (
    endCurrent > start &&
    endNext > start &&
    current[endCurrent - 1] === next[endNext - 1]
  ) {
    endCurrent--;
    endNext--;
  }

  return {
    type: 'edit',
    from: start,
    to: endCurrent,
    insert: next.slice(start, endNext),
  };
}

/** 需要落地的同步动作（排除 noop） */
export type AppliedDocSync = Exclude<DocSyncPlan, { type: 'noop' }>;

/** 光标状态：只关心是否为空选区与主光标位置 */
export interface CaretState {
  head: number;
  empty: boolean;
}

/**
 * 计算外部写入后光标应落到的位置
 *
 * - 尾部追加且光标原本就在末尾：跟随到新末尾（否则 CodeMirror 会把光标留在插入点之前）
 * - 光标落在改动区间之外：返回 null，交给 CodeMirror 自行映射，保持相对位置
 * - 光标落在被删除的区间内：落到插入内容末尾（原位置在新内容中已无意义）
 * - 纯插入且光标正位于插入点：返回 null，原地不动
 *
 * @param plan 落地动作
 * @param caret 写入前的光标状态
 * @param prevLength 写入前的文档长度
 * @returns 目标位置（针对改动后的文档）；null 表示交给 CodeMirror 自行映射
 */
export function resolveCaretTarget(
  plan: AppliedDocSync,
  caret: CaretState,
  prevLength: number,
): number | null {
  const appendedAtEnd =
    plan.from === prevLength &&
    plan.to === prevLength &&
    caret.head === prevLength;
  if (caret.empty && appendedAtEnd) return plan.from + plan.insert.length;

  if (caret.head < plan.from || caret.head > plan.to) return null;
  if (plan.from === plan.to) return null;
  return plan.from + plan.insert.length;
}

/**
 * 把宿主给出的内容写入编辑器
 *
 * 外部写入不进撤销栈：撤销只回退用户自己的输入，流式增量不该被逐段撤销。
 * @returns 是否发生了写入（内容一致时为 false）
 */
export function writeDocSync(view: EditorView, next: string): boolean {
  const { doc, selection } = view.state;
  const plan = planDocSync(doc.toString(), next);
  if (plan.type === 'noop') return false;
  const caret = resolveCaretTarget(plan, selection.main, doc.length);
  const changes: ChangeSpec = {
    from: plan.from,
    to: plan.to,
    insert: plan.insert,
  };
  view.dispatch({
    changes,
    // 选区偏移量针对改动后的文档
    selection: caret === null ? undefined : { anchor: caret },
    annotations: Transaction.addToHistory.of(false),
  });
  return true;
}
