/**
 * 外部 value → 编辑器文档的落地策略（纯函数）
 *
 * 代码面板的 value 有三种来源：用户输入、AI 流式增量同步、应用整段片段。
 * 后两者由宿主经 value 回灌，若一律整篇替换会带来两个问题：
 * 1. 流式场景每 200 字符就重置一次光标与选区，用户无法在生成过程中继续编辑；
 * 2. 外部写入进撤销栈后，Ctrl+Z 会逐段回退 AI 内容而不是用户自己的输入。
 *
 * 因此把「怎么落地」抽成可单测的判定：与当前文档成前缀关系时只追加尾部，
 * 否则整篇替换；两种外部写入都不进撤销栈。
 */
import { type ChangeSpec, Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** 文档同步动作 */
export type DocSyncPlan =
  /** 与当前文档一致，无需改动 */
  | { type: 'noop' }
  /** 尾部增量：只追加新增部分，光标与选区保持不变 */
  | { type: 'append'; insert: string }
  /** 整篇替换：外部内容与当前文档不是前缀关系（应用新片段、宿主整体改写） */
  | { type: 'replace'; doc: string };

/**
 * 计算把文档从 current 变为 next 的落地方式
 * @param current 编辑器当前文档内容
 * @param next 宿主给出的目标内容
 */
export function planDocSync(current: string, next: string): DocSyncPlan {
  if (current === next) return { type: 'noop' };
  // 前缀关系覆盖「流式追加」与「用户已删掉尾部后宿主继续追加」两种情形
  if (next.startsWith(current)) {
    return { type: 'append', insert: next.slice(current.length) };
  }
  return { type: 'replace', doc: next };
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
 * - 整篇替换：原位置在新内容中已无意义，落到新内容末尾
 *   （不显式指定的话 CodeMirror 会把落在被删区间内的位置映射到起点）
 * - 尾部追加：仅当光标原本就停在末尾时跟随追加，否则原地不动 ——
 *   流式生成期间用户可能正在中间编辑，不能被同步打断
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
  if (plan.type === 'replace') return plan.doc.length;
  const atEnd = caret.empty && caret.head === prevLength;
  return atEnd ? prevLength + plan.insert.length : null;
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
  const changes: ChangeSpec =
    plan.type === 'append'
      ? { from: doc.length, insert: plan.insert }
      : { from: 0, to: doc.length, insert: plan.doc };
  view.dispatch({
    changes,
    // 选区偏移量针对改动后的文档
    selection: caret === null ? undefined : { anchor: caret },
    annotations: Transaction.addToHistory.of(false),
  });
  return true;
}
