/**
 * 左栏预览面板：带背景色与内边距的内容卡片，iframe sandbox 渲染 srcDoc
 * 设备档位 / 脚本开关 / 刷新 / 新窗口 控制在主顶栏（Toolbar），本组件只负责展示
 */
import { EMPTY_PREVIEW_TEXT, PREVIEW_DEVICES } from '../constants';
import { useElementSize } from '../hooks/useElementSize';
import { IconCode } from '../ui/icons';
import { buildPreviewDocument } from '../utils/extract';

interface PreviewPanelProps {
  html: string;
  deviceKey: string;
  scriptsEnabled: boolean;
  /** 顶栏「刷新」递增的 key，用于强制重载 iframe */
  reloadKey: number;
  /** 注入预览 <head> 的附加代码（原始 HTML 片段） */
  previewHead?: string;
}

export function PreviewPanel({
  html,
  deviceKey,
  scriptsEnabled,
  reloadKey,
  previewHead,
}: PreviewPanelProps) {
  const [stageRef, stageSize] = useElementSize<HTMLDivElement>();

  const device =
    PREVIEW_DEVICES.find((d) => d.key === deviceKey) ?? PREVIEW_DEVICES[0];
  // 固定设备（手机）取 PREVIEW_DEVICES 的宽高；桌面自适应
  const fixedBox =
    device.key === 'mobile' && typeof device.width === 'number'
      ? { h: device.height ?? 812, w: device.width }
      : undefined;

  // 手机框按舞台空间等比缩放（≤100%）；桌面拉伸不缩放
  let fitZoom = 1;
  if (fixedBox && stageSize.width > 0 && stageSize.height > 0) {
    fitZoom = Math.min(
      1,
      stageSize.width / fixedBox.w,
      stageSize.height / fixedBox.h,
    );
  }

  // sandbox 默认隔离；允许脚本时放开 allow-scripts（仍需 allow-same-origin 加载同源资源）
  const sandbox = scriptsEnabled
    ? 'allow-scripts allow-same-origin'
    : 'allow-same-origin';

  // 预览直接使用已完成作用域化的 value（应用时刻已 scoped），保证「预览 = 最终渲染」
  const renderScreen = (
    <iframe
      className="easyx-ai-rich-editor__preview-frame"
      key={reloadKey}
      sandbox={sandbox}
      srcDoc={buildPreviewDocument(html, previewHead)}
      title="HTML 预览"
    />
  );

  const renderEmpty = (
    <div className="easyx-ai-rich-editor__preview-empty">
      <span className="easyx-ai-rich-editor__preview-empty-icon">
        <IconCode size={22} />
      </span>
      <span className="easyx-ai-rich-editor__preview-empty-text">
        {EMPTY_PREVIEW_TEXT}
      </span>
    </div>
  );

  return (
    <div className="easyx-ai-rich-editor__preview">
      {/* 内容卡片：桌面拉伸填充，手机固定尺寸设备框居中 */}
      <div className="easyx-ai-rich-editor__preview-stage" ref={stageRef}>
        {fixedBox ? (
          <div
            className="easyx-ai-rich-editor__preview-screen"
            style={{
              height: fixedBox.h,
              transform: `scale(${fitZoom})`,
              width: fixedBox.w,
            }}
          >
            {html.trim() ? renderScreen : renderEmpty}
          </div>
        ) : (
          <div className="easyx-ai-rich-editor__preview-screen">
            {html.trim() ? renderScreen : renderEmpty}
          </div>
        )}
      </div>
    </div>
  );
}
