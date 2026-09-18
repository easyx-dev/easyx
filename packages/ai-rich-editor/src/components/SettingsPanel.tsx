/**
 * 设置面板：统一展示/编辑包配置项（保存后生效）
 *
 * 编辑内容暂存为受控草稿，点击「保存」后回写 runtimeConfig 并触发 onConfigChange；
 * 打开时用当前配置重置草稿，取消则直接丢弃。
 * 载体是容器内模态框（不脱离宿主层级），只读区展示不可在 UI 编辑的注入项。
 */
import { useEffect, useState } from 'react';
import { buildDefaultSystemPrompt } from '../prompts';
import type { AiRichEditorConfig } from '../types';
import { Button } from '../ui/primitives/Button';
import { Checkbox } from '../ui/primitives/Checkbox';
import { Collapse } from '../ui/primitives/Collapse';
import { Section, Tag, Text } from '../ui/primitives/layout';
import { Modal } from '../ui/primitives/Modal';
import { TextArea } from '../ui/primitives/TextArea';

interface SettingsPanelProps {
  open: boolean;
  /** 当前生效的配置（用于初始化草稿与只读展示） */
  config: AiRichEditorConfig;
  /** 通知是否由宿主接管（onNotify） */
  notifyConfigured: boolean;
  /** 错误是否由宿主接管（onError） */
  errorConfigured: boolean;
  /** 生效的 URL 协议清单（默认 + 宿主追加） */
  urlSchemes: readonly string[];
  onClose: () => void;
  onSave: (config: AiRichEditorConfig) => void;
}

export function SettingsPanel({
  open,
  config,
  notifyConfigured,
  errorConfigured,
  urlSchemes,
  onClose,
  onSave,
}: SettingsPanelProps) {
  const [autoApply, setAutoApply] = useState(config.autoApply ?? true);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt ?? '');
  const [previewHead, setPreviewHead] = useState(config.previewHead ?? '');

  // 打开时用当前配置重置草稿，避免上次未保存的编辑残留
  useEffect(() => {
    if (!open) return;
    setAutoApply(config.autoApply ?? true);
    setSystemPrompt(config.systemPrompt ?? '');
    setPreviewHead(config.previewHead ?? '');
  }, [open, config]);

  const hasCustomPrompt = Boolean(systemPrompt.trim());

  const handleSave = () => {
    onSave({
      ...config,
      autoApply,
      previewHead: previewHead.trim() ? previewHead : undefined,
      systemPrompt: systemPrompt.trim() ? systemPrompt : undefined,
    });
  };

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} size="sm">
            取消
          </Button>
          <Button onClick={handleSave} size="sm" variant="primary">
            保存
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="设置"
    >
      <div className="easyx-ai-rich-editor__settings">
        <Section title="应用">
          <div className="easyx-ai-rich-editor__settings-row">
            <div className="easyx-ai-rich-editor__settings-row-main">
              <Text>自动应用到编辑器</Text>
              <Text block size="xs" tone="secondary">
                关闭后生成的片段只留在预览区，需手动复制
              </Text>
            </div>
            <Checkbox
              aria-label="自动应用到编辑器"
              checked={autoApply}
              onChange={setAutoApply}
            />
          </div>

          {/* 生效状态：随「是否填写自定义提示词」切换 */}
          <div className="easyx-ai-rich-editor__settings-status">
            <Text size="sm" tone="secondary">
              当前生效：
            </Text>
            <Tag tone={hasCustomPrompt ? 'primary' : 'default'}>
              {hasCustomPrompt ? '自定义' : '内置默认'}
            </Tag>
          </div>
        </Section>

        <Section description="留空则使用内置默认提示词" title="system 提示词">
          <TextArea
            aria-label="自定义 system 提示词"
            onChange={setSystemPrompt}
            placeholder="留空则使用内置默认提示词"
            rows={4}
            value={systemPrompt}
          />
          <Collapse title="查看内置默认提示词">
            <pre className="easyx-ai-rich-editor__settings-prompt">
              {buildDefaultSystemPrompt()}
            </pre>
          </Collapse>
        </Section>

        <Section description="原样注入预览 iframe 的 head" title="预览附加代码">
          <TextArea
            aria-label="预览附加代码"
            onChange={setPreviewHead}
            placeholder="如：<style>body{...}</style>"
            rows={3}
            value={previewHead}
          />
        </Section>

        {/* 只读区：函数型注入项无法在 UI 编辑，此处仅说明当前来源 */}
        <Section description="由宿主注入，无法在界面编辑" title="运行时">
          <dl className="easyx-ai-rich-editor__settings-meta">
            <div className="easyx-ai-rich-editor__settings-meta-item">
              <dt>通知</dt>
              <dd>
                {notifyConfigured ? '宿主回调（onNotify）' : '包内置轻提示'}
              </dd>
            </div>
            <div className="easyx-ai-rich-editor__settings-meta-item">
              <dt>错误</dt>
              <dd>
                {errorConfigured ? '宿主回调（onError）' : 'console 兜底'}
              </dd>
            </div>
            <div className="easyx-ai-rich-editor__settings-meta-item">
              <dt>URL 协议清单</dt>
              <dd>{urlSchemes.join(' / ')}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </Modal>
  );
}
