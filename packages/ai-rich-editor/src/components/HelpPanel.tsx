/**
 * 使用说明面板：顶栏「使用说明」打开的模态框
 *
 * 面向使用者的操作指南，文案来自 help-content.ts（数据与渲染分离）；
 * Esc 关闭、遮罩点击关闭与焦点归还由 Modal 承担。
 */
import { HELP_SECTIONS } from '../help-content';
import { Section, Text } from '../ui/primitives/layout';
import { Modal } from '../ui/primitives/Modal';

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  return (
    <Modal onClose={onClose} open={open} title="使用说明">
      <div className="easyx-ai-rich-editor__help">
        {HELP_SECTIONS.map((section) => (
          <Section
            description={section.description}
            key={section.title}
            title={section.title}
          >
            <ul className="easyx-ai-rich-editor__help-list">
              {section.items.map((item, index) => (
                <li
                  className="easyx-ai-rich-editor__help-item"
                  key={`${section.title}-${index}`}
                >
                  <Text size="sm">{item}</Text>
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
    </Modal>
  );
}
