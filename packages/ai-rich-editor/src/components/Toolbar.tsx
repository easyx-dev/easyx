/**
 * 编辑器主顶栏：预览控件（设备/脚本/刷新/新窗口）+ 编辑器开关 + 复制 + 设置
 * 预览面板自身不含头部控制条，控件统一收拢到主顶栏
 */

import { PREVIEW_DEVICES } from '../constants';
import type { AiRichErrorHandler, AiRichNotify } from '../types';
import {
  IconCopy,
  IconExternalLink,
  IconHelp,
  IconReload,
  IconSetting,
} from '../ui/icons';
import { Button } from '../ui/primitives/Button';
import { Checkbox } from '../ui/primitives/Checkbox';
import { Text } from '../ui/primitives/layout';
import { Segmented } from '../ui/primitives/Segmented';
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
  /** 打开使用说明 */
  onOpenHelp: () => void;
  onNotify?: AiRichNotify;
  onError?: AiRichErrorHandler;
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
  onOpenHelp,
  onNotify,
  onError,
}: ToolbarProps) {
  const handleCopy = async () => {
    if (!html) {
      onNotify?.('warning', '暂无内容可复制');
      return;
    }
    const ok = await copyToClipboard(html);
    if (ok) {
      onNotify?.('success', '已复制到剪贴板');
      return;
    }
    onError?.(new Error('复制失败'));
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
          <Checkbox
            aria-label="允许预览中的脚本执行"
            checked={scriptsEnabled}
            onChange={onToggleScripts}
          >
            JS
          </Checkbox>
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
        <Tooltip title="显示代码编辑器">
          <Checkbox
            aria-label="显示代码编辑器"
            checked={showEditor}
            onChange={onToggleEditor}
          >
            编辑器
          </Checkbox>
        </Tooltip>

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

        <Tooltip title="打开设置">
          <Button
            icon={<IconSetting />}
            onClick={onOpenSettings}
            size="sm"
            variant="text"
          >
            设置
          </Button>
        </Tooltip>

        <Tooltip title="使用说明">
          <Button
            aria-label="使用说明"
            icon={<IconHelp />}
            iconOnly
            onClick={onOpenHelp}
            size="sm"
            variant="text"
          />
        </Tooltip>
      </div>
    </div>
  );
}
