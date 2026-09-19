/**
 * 对话中的补丁卡片：把 Search/Replace 块渲染成 diff
 *
 * 每个块分「删除（SEARCH，红底）」与「新增（REPLACE，绿底）」两段逐行展示，
 * 便于用户一眼看清改了什么。流式生成中未闭合的块解析不到，此时按原文显示；
 * 「应用修改」在 autoApply 关闭时提供手动落地入口。
 */
import { useMemo } from 'react';
import type { AiRichErrorHandler, AiRichNotify } from '../types';
import { IconCode, IconCopy } from '../ui/icons';
import { Button } from '../ui/primitives/Button';
import { Tooltip } from '../ui/primitives/Tooltip';
import { copyToClipboard } from '../utils/clipboard';
import { parsePatchBlocks, type SearchReplaceBlock } from '../utils/patch';

/** 逐行渲染一个 diff 侧（删除或新增） */
function DiffSide({ lines, kind }: { lines: string[]; kind: 'del' | 'add' }) {
  return (
    <div
      className={`easyx-ai-rich-editor__patch-side easyx-ai-rich-editor__patch-side--${kind}`}
    >
      {lines.map((line, index) => (
        <div
          className="easyx-ai-rich-editor__patch-line"
          key={`${kind}-${index}`}
        >
          <span className="easyx-ai-rich-editor__patch-sign">
            {kind === 'del' ? '-' : '+'}
          </span>
          <span className="easyx-ai-rich-editor__patch-text">{line}</span>
        </div>
      ))}
    </div>
  );
}

/** 单个补丁块 */
function PatchBlock({ block }: { block: SearchReplaceBlock }) {
  return (
    <div className="easyx-ai-rich-editor__patch-block">
      <DiffSide kind="del" lines={block.search.split('\n')} />
      <DiffSide kind="add" lines={block.replace.split('\n')} />
    </div>
  );
}

interface PatchCardProps {
  /** 代码块原文（含 Search/Replace 标记） */
  content: string;
  /** 「应用修改」回调（未提供时不显示按钮，如纯展示场景） */
  onApply?: (content: string) => void;
  onNotify?: AiRichNotify;
  onError?: AiRichErrorHandler;
}

export function PatchCard({
  content,
  onApply,
  onNotify,
  onError,
}: PatchCardProps) {
  const blocks = useMemo(() => parsePatchBlocks(content), [content]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(content);
    if (ok) {
      onNotify?.('success', '已复制补丁');
      return;
    }
    onError?.(new Error('复制失败'));
  };

  return (
    <div className="easyx-ai-rich-editor__code-card easyx-ai-rich-editor__patch-card">
      <div className="easyx-ai-rich-editor__code-card-head">
        <span className="easyx-ai-rich-editor__code-card-label">
          <IconCode />
          修改补丁
        </span>
        <div className="easyx-ai-rich-editor__code-card-actions">
          <Tooltip title="复制补丁">
            <Button
              aria-label="复制补丁"
              className="easyx-ai-rich-editor__code-card-copy"
              icon={<IconCopy size={14} />}
              iconOnly
              onClick={() => void handleCopy()}
              size="sm"
              variant="text"
            />
          </Tooltip>
          {onApply && (
            <Tooltip title="把修改应用到编辑器">
              <Button onClick={() => onApply(content)} size="sm" variant="link">
                应用修改
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      {blocks.length > 0 ? (
        <div className="easyx-ai-rich-editor__patch-body">
          {blocks.map((block, index) => (
            <PatchBlock
              block={block}
              key={`${index}-${block.search.slice(0, 24)}`}
            />
          ))}
        </div>
      ) : (
        // 流式半成品：还没有完整块，先按原文展示
        <pre className="easyx-ai-rich-editor__patch-raw">{content}</pre>
      )}
    </div>
  );
}
