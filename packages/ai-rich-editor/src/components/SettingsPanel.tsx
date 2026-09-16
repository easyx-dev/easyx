/**
 * 设置面板：统一展示/编辑包配置项（保存后生效）
 *
 * 编辑内容暂存为受控草稿，点击「保存」后回写 runtimeConfig 并触发 onConfigChange；
 * 打开时用当前配置重置草稿，取消则直接丢弃。
 */
import { useEffect, useId, useState } from 'react';
import { SETTINGS_DRAWER_WIDTH } from '../constants';
import { buildDefaultSystemPrompt } from '../prompts';
import type { AiRichEditorConfig } from '../types';
import { Button } from '../ui/primitives/Button';
import { Collapse } from '../ui/primitives/Collapse';
import { Drawer } from '../ui/primitives/Drawer';
import { Field, Stack, Tag, Text } from '../ui/primitives/layout';
import { Switch } from '../ui/primitives/Switch';
import { TextArea } from '../ui/primitives/TextArea';

interface SettingsPanelProps {
  open: boolean;
  /** 当前生效的配置（用于初始化草稿与只读展示） */
  config: AiRichEditorConfig;
  onClose: () => void;
  onSave: (config: AiRichEditorConfig) => void;
}

export function SettingsPanel({
  open,
  config,
  onClose,
  onSave,
}: SettingsPanelProps) {
  const [autoApply, setAutoApply] = useState(config.autoApply ?? true);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt ?? '');
  const [previewHead, setPreviewHead] = useState(config.previewHead ?? '');
  const promptId = useId();
  const headId = useId();

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
    <Drawer
      extra={
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
      width={SETTINGS_DRAWER_WIDTH}
    >
      <Stack size="lg">
        <Stack direction="row" size="sm" justify="between">
          <Text>自动应用到编辑器</Text>
          <Switch
            aria-label="自动应用到编辑器"
            checked={autoApply}
            checkedChildren="开"
            onChange={setAutoApply}
            unCheckedChildren="关"
          />
        </Stack>

        {/* 生效状态：随「是否填写自定义提示词」切换 */}
        <div className="easyx-ai-rich-editor__settings-status">
          <Text tone="secondary" size="sm">
            当前生效：
          </Text>
          <Tag tone={hasCustomPrompt ? 'primary' : 'default'}>
            {hasCustomPrompt ? '自定义' : '内置默认'}
          </Tag>
        </div>

        <Field htmlFor={promptId} label="自定义 system 提示词">
          <TextArea
            id={promptId}
            onChange={setSystemPrompt}
            placeholder="留空则使用内置默认提示词"
            rows={6}
            value={systemPrompt}
          />
        </Field>

        <Field htmlFor={headId} label="预览附加代码（注入 <head>）">
          <TextArea
            id={headId}
            onChange={setPreviewHead}
            placeholder="如：<style>body{...}</style>，原样注入预览 head"
            rows={5}
            value={previewHead}
          />
        </Field>

        <Text block size="xs" tone="secondary">
          消息提示：
          {config.notify ? '已配置（宿主回调）' : '使用包内置轻提示'}
        </Text>

        {/* 内置默认提示词（只读参考，默认折叠） */}
        <Collapse title="内置默认提示词">
          <pre className="easyx-ai-rich-editor__settings-prompt">
            {buildDefaultSystemPrompt()}
          </pre>
        </Collapse>
      </Stack>
    </Drawer>
  );
}
