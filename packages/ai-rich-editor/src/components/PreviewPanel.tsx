/**
 * 左栏预览面板：带背景色与内边距的内容卡片，iframe sandbox 渲染 srcDoc
 * 设备档位 / 脚本开关 / 刷新 / 新窗口 控制在主顶栏（Toolbar），本组件只负责展示。
 *
 * 预览文档由「源片段 + 作用域前缀」现场生成：编辑入口开启时给每个元素打
 * data-easyx-id 编号，右键命中即可映射回源片段文本（见 utils/blocks）。
 * 父页经 allow-same-origin 读取 iframe DOM 挂监听，不向预览注入脚本；
 * 无法访问 contentDocument（宿主改动 sandbox）时静默降级为普通预览。
 *
 * 支持多选：普通右键替换为单个目标，Shift + 右键追加/移除（用于「让两个元素一致」
 * 这类关系型改动）；同时把命中元素的关键计算样式一并带入上下文。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_PREVIEW_TEXT, PREVIEW_DEVICES } from '../constants';
import { useElementSize } from '../hooks/useElementSize';
import type { AiRichNotify } from '../types';
import { isScopeDark } from '../ui/cx';
import { IconCode } from '../ui/icons';
import {
  buildInteractivePreviewDocument,
  PREVIEW_NODE_ATTR,
  type PreviewTarget,
  resolvePreviewTarget,
} from '../utils/blocks';
import { summarizeComputedStyle } from '../utils/computed-style';
import { buildPreviewDocument } from '../utils/extract';
import { scopedRichContent } from '../utils/scope';
import { PreviewEditMenu } from './PreviewEditMenu';

interface PreviewPanelProps {
  /** 源片段（未作用域化） */
  source: string;
  /** 实例级作用域前缀 */
  scopePrefix: string;
  deviceKey: string;
  scriptsEnabled: boolean;
  /** 顶栏「刷新」递增的 key，用于强制重载 iframe */
  reloadKey: number;
  /** 注入预览 <head> 的附加代码（原始 HTML 片段） */
  previewHead?: string;
  /** 是否启用右键「用 AI 修改」入口 */
  editMenuEnabled?: boolean;
  onNotify?: AiRichNotify;
  /** 提交预览定向修改：目标区域（可多个）+ 用户指令 */
  onSubmitEdit?: (targets: PreviewTarget[], instruction: string) => void;
}

/** 视口坐标的高亮矩形（已按 iframe 缩放换算） */
interface HighlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 一个已选目标及其持久高亮 */
interface SelectedTarget {
  target: PreviewTarget;
  highlights: HighlightRect[];
}

/** 右键浮层的定位、主题与已选目标 */
interface MenuState {
  x: number;
  y: number;
  dark: boolean;
  selected: SelectedTarget[];
}

/** iframe 内的矩形 → 父页视口坐标（考虑 CSS 缩放） */
function toViewportRects(
  frame: HTMLIFrameElement,
  rects: DOMRectList | DOMRect[],
): HighlightRect[] {
  const rect = frame.getBoundingClientRect();
  const scaleX = frame.clientWidth ? rect.width / frame.clientWidth : 1;
  const scaleY = frame.clientHeight ? rect.height / frame.clientHeight : 1;
  const out: HighlightRect[] = [];
  for (const item of Array.from(rects)) {
    if (item.width <= 0 || item.height <= 0) continue;
    out.push({
      x: rect.left + item.left * scaleX,
      y: rect.top + item.top * scaleY,
      w: item.width * scaleX,
      h: item.height * scaleY,
    });
  }
  return out;
}

export function PreviewPanel({
  source,
  scopePrefix,
  deviceKey,
  scriptsEnabled,
  reloadKey,
  previewHead,
  editMenuEnabled = true,
  onNotify,
  onSubmitEdit,
}: PreviewPanelProps) {
  const [stageRef, stageSize] = useElementSize<HTMLDivElement>();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

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

  // 编辑入口开启时生成带元素编号的可交互文档，否则生成普通作用域预览
  const doc = editMenuEnabled
    ? buildInteractivePreviewDocument(source, scopePrefix, previewHead)
    : buildPreviewDocument(scopedRichContent(source, scopePrefix), previewHead);

  const closeMenu = useCallback(() => setMenu(null), []);

  // 预览内容变化后旧的右键目标可能失效，收起浮层
  useEffect(() => {
    setMenu(null);
  }, [source]);

  // 在 iframe 文档上挂 contextmenu 监听：命中元素后换算坐标浮出输入框
  useEffect(() => {
    if (!editMenuEnabled) return;
    const frame = frameRef.current;
    if (!frame) return;
    let detach: (() => void) | undefined;

    const attach = () => {
      detach?.();
      let docEl: Document | null = null;
      try {
        docEl = frame.contentDocument;
      } catch {
        // 跨源或 sandbox 限制：静默降级，不提供右键入口
        return;
      }
      if (!docEl) return;

      const onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        const target = event.target as Element | null;
        // closest 从事件目标向上找，命中的是最内层元素
        const nodeEl = target?.closest(`[${PREVIEW_NODE_ATTR}]`);
        if (!nodeEl) return;
        const elementId = Number(nodeEl.getAttribute(PREVIEW_NODE_ATTR));
        if (!Number.isFinite(elementId)) return;

        const selectionApi = docEl.getSelection?.() ?? null;
        const selection = selectionApi?.toString() ?? '';
        const resolved = resolvePreviewTarget(source, elementId, selection);
        if (!resolved) return;

        // 计算样式摘要：让模型看到实际生效值，而不是只看到源码
        const view = frame.contentWindow;
        const styles = view
          ? summarizeComputedStyle(view.getComputedStyle(nodeEl))
          : '';
        const targetInfo: PreviewTarget = styles
          ? { ...resolved, styles }
          : resolved;

        // 父页抢焦点后原生选区会被浏览器隐藏，这里记录持久高亮
        const highlights: HighlightRect[] = [];
        if (selection.trim() && selectionApi && selectionApi.rangeCount > 0) {
          highlights.push(
            ...toViewportRects(
              frame,
              selectionApi.getRangeAt(0).getClientRects(),
            ),
          );
        }
        if (highlights.length === 0) {
          highlights.push(
            ...toViewportRects(frame, [nodeEl.getBoundingClientRect()]),
          );
        }

        // iframe 可能被 CSS 缩放，换算回父页视口坐标
        const rect = frame.getBoundingClientRect();
        const scaleX = frame.clientWidth ? rect.width / frame.clientWidth : 1;
        const scaleY = frame.clientHeight
          ? rect.height / frame.clientHeight
          : 1;
        const anchor = {
          x: Math.min(
            rect.left + event.clientX * scaleX,
            window.innerWidth - 320,
          ),
          y: Math.min(
            rect.top + event.clientY * scaleY,
            window.innerHeight - 200,
          ),
        };
        const darkNow = isScopeDark(frame);
        // 只有 Shift 是有意义的修饰键：Ctrl/Cmd + 点击在部分系统上本身就是右键
        const addToSelection = event.shiftKey;

        setMenu((prev) => {
          if (!addToSelection || !prev) {
            return {
              ...anchor,
              dark: darkNow,
              selected: [{ target: targetInfo, highlights }],
            };
          }
          const exists = prev.selected.some(
            (item) => item.target.elementId === elementId,
          );
          const selected = exists
            ? prev.selected.filter(
                (item) => item.target.elementId !== elementId,
              )
            : [...prev.selected, { target: targetInfo, highlights }];
          if (selected.length === 0) return null;
          return { ...anchor, dark: darkNow, selected };
        });
      };

      docEl.addEventListener('contextmenu', onContextMenu);
      detach = () => docEl.removeEventListener('contextmenu', onContextMenu);
    };

    attach();
    frame.addEventListener('load', attach);
    return () => {
      frame.removeEventListener('load', attach);
      detach?.();
    };
  }, [source, editMenuEnabled]);

  const renderScreen = (
    <iframe
      className="easyx-ai-rich-editor__preview-frame"
      key={reloadKey}
      ref={frameRef}
      sandbox={sandbox}
      srcDoc={doc}
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

  const allHighlights = menu?.selected.flatMap((item) => item.highlights) ?? [];

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
            {source.trim() ? renderScreen : renderEmpty}
          </div>
        ) : (
          <div className="easyx-ai-rich-editor__preview-screen">
            {source.trim() ? renderScreen : renderEmpty}
          </div>
        )}
      </div>

      {/* 持久高亮：原生选区在父页抢焦点后会被隐藏，这里用覆盖层保持目标可见 */}
      {editMenuEnabled && allHighlights.length > 0 && (
        <div
          aria-hidden="true"
          className="easyx-ai-rich-editor__preview-highlight-layer"
        >
          {allHighlights.map((rect, index) => (
            <span
              className="easyx-ai-rich-editor__preview-highlight"
              key={`${rect.x}-${rect.y}-${index}`}
              style={{
                height: rect.h,
                left: rect.x,
                top: rect.y,
                width: rect.w,
              }}
            />
          ))}
        </div>
      )}

      {editMenuEnabled && (
        <PreviewEditMenu
          anchor={menu ? { x: menu.x, y: menu.y } : null}
          dark={menu?.dark ?? false}
          onClose={closeMenu}
          onNotify={onNotify}
          onSubmit={(instruction) => {
            if (menu && onSubmitEdit) {
              onSubmitEdit(
                menu.selected.map((item) => item.target),
                instruction,
              );
            }
          }}
          targets={menu?.selected.map((item) => item.target) ?? []}
        />
      )}
    </div>
  );
}
