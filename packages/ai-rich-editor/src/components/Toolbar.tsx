/**
 * 编辑器主顶栏：预览控件（设备/脚本/刷新/新窗口）+ 编辑器开关 + 复制 + 设置
 * 预览面板自身不含头部控制条，控件统一收拢到主顶栏
 */

import { PREVIEW_DEVICES } from '../constants';
import type { AiRichNotify } from '../types';
import {
  IconCode,
  IconCopy,
  IconExternalLink,
  IconReload,
  IconSetting,
} from '../ui/icons';
import { Button } from '../ui/primitives/Button';
import { Dropdown } from '../ui/primitives/Dropdown';
import { Text } from '../ui/primitives/layout';
import { Segmented } from '../ui/primitives/Segmented';
import { Switch } from '../ui/primitives/Switch';
import { Tooltip } from '../ui/primitives/Tooltip';
import { copyToClipboard } from '../utils/clipboard';

interface ToolbarProps {
  html: string;
  // 预览控件
  deviceKey: string;
  onDeviceKeyChange: (key: string) => void;
  scriptsEnabled: boolean;
  onToggleScripts: () => void;
  onRefresh: () => void;
  onOpenInNewWindow: () => void;
  // 编辑器开关
  showEditor: boolean;
  onToggleEditor: () => void;
  /** 打开设置面板 */
  onOpenSettings: () => void;
  notify?: AiRichNotify;
}

/** 顶栏内的分组分隔线（纯装饰） */
function Sep() {
  return <span className="easyx-ai-rich-editor__toolbar-sep" />;
}

export function Toolbar({
  html,
  deviceKey,
  onDeviceKeyChange,
  scriptsEnabled,
  onToggleScripts,
  onRefresh,
  onOpenInNewWindow,
  showEditor,
  onToggleEditor,
  onOpenSettings,
  notify,
}: ToolbarProps) {
  const handleCopy = async () => {
    if (!html) {
      notify?.('warning', '暂无内容可复制');
      return;
    }
    const ok = await copyToClipboard(html);
    notify?.(ok ? 'success' : 'error', ok ? '已复制到剪贴板' : '复制失败');
  };

  return (
    <div className="easyx-ai-rich-editor__toolbar">
      <Text className="easyx-ai-rich-editor__toolbar-title">
        HTML 页面编辑器
      </Text>

      <div className="easyx-ai-rich-editor__toolbar-actions">
        {/* 预览控件组 */}
        <Segmented
          aria-label="预览设备"
          onChange={onDeviceKeyChange}
          options={PREVIEW_DEVICES.map((device) => ({
            label: device.label,
            value: device.key,
          }))}
          value={deviceKey}
        />
        <Tooltip title="允许预览中的脚本执行">
          <Switch
            aria-label="允许预览中的脚本执行"
            checked={scriptsEnabled}
            checkedChildren="JS"
            onChange={onToggleScripts}
            unCheckedChildren="JS"
          />
        </Tooltip>
        <Tooltip title="刷新预览（重新执行脚本）">
          <Button
            aria-label="刷新预览"
            icon={<IconReload />}
            iconOnly
            onClick={onRefresh}
            size="sm"
            variant="text"
          />
        </Tooltip>
        <Tooltip title="新窗口预览">
          <Button
            aria-label="新窗口预览"
            icon={<IconExternalLink />}
            iconOnly
            onClick={onOpenInNewWindow}
            size="sm"
            variant="text"
          />
        </Tooltip>

        <Sep />

        {/* 编辑器开关 */}
        <span className="easyx-ai-rich-editor__toolbar-label">
          <IconCode />
          编辑器
        </span>
        <Switch
          aria-label="显示代码编辑器"
          checked={showEditor}
          onChange={onToggleEditor}
        />

        <Sep />

        <Button
          icon={<IconCopy />}
          onClick={() => void handleCopy()}
          size="sm"
          variant="text"
        >
          复制
        </Button>

        <Sep />

        <Dropdown
          items={[{ key: 'more', label: '更多配置…' }]}
          onSelect={(key) => {
            if (key === 'more') onOpenSettings();
          }}
          trigger={
            <Button icon={<IconSetting />} size="sm" variant="text">
              设置
            </Button>
          }
        />
      </div>
    </div>
  );
}
