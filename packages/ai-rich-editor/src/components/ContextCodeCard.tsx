/**
 * 用户消息中的上下文代码卡片（只读）
 *
 * 展示随消息发送的「当前片段」「目标区域」，让喂给模型的技术输入对用户可见，
 * 但不参与编辑：限高滚动，不提供应用按钮。
 */
interface ContextCodeCardProps {
  label: string;
  code: string;
}

export function ContextCodeCard({ label, code }: ContextCodeCardProps) {
  return (
    <div className="easyx-ai-rich-editor__context-card">
      <div className="easyx-ai-rich-editor__context-card-head">
        <span className="easyx-ai-rich-editor__context-card-label">
          {label}
        </span>
      </div>
      <pre className="easyx-ai-rich-editor__context-card-body">
        <code>{code}</code>
      </pre>
    </div>
  );
}
