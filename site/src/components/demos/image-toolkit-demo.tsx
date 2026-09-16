/**
 * @easyx/image-toolkit 演示：浏览器内图片编辑全流程
 *
 * 源图由 canvas 现场生成（演示页无服务端），整个处理链路在浏览器内完成：
 * 魔数嗅探 → wasm 引擎加载（含进度）→ 裁切/缩放/编码 → 保存回调。
 *
 * 主题无需桥接：演示页把 data-theme 挂在 <html> 上，弹窗渲染在 portal 中也能命中。
 */
import {
  IMAGE_LIMITS,
  type ImageProcessResult,
  PROCESSABLE_FORMATS,
  sniffImage,
} from '@easyx/image-toolkit';
import { ImageEditorModal } from '@easyx/image-toolkit/ui';
import { useCallback, useEffect, useState } from 'react';

/** 现场生成一张 1600×1000 的渐变 + 几何图形图，模拟「用户上传的照片」 */
function createSourceBlob(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('当前浏览器不支持 canvas'));

  const gradient = ctx.createLinearGradient(0, 0, 1600, 1000);
  gradient.addColorStop(0, '#7c3aed');
  gradient.addColorStop(0.5, '#2563eb');
  gradient.addColorStop(1, '#06b6d4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1600, 1000);

  for (let i = 0; i < 24; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + (i % 5) * 0.04})`;
    ctx.arc(
      (i * 137) % 1600,
      (i * 233) % 1000,
      40 + ((i * 31) % 120),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('EasyX', 120, 520);
  ctx.font = '36px sans-serif';
  ctx.fillText('image-toolkit demo source', 124, 590);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('生成源图失败'));
    }, 'image/png');
  });
}

export default function ImageToolkitDemo() {
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceBytes, setSourceBytes] = useState<number | null>(null);
  const [sniffed, setSniffed] = useState<string>('—');
  const [open, setOpen] = useState(false);
  const [lastResult, setLastResult] = useState<string>('—');
  const [lastAction, setLastAction] = useState<string>('—');

  // 源图在挂载时生成一次，卸载时回收 Object URL
  useEffect(() => {
    let url = '';
    void createSourceBlob().then((blob) => {
      url = URL.createObjectURL(blob);
      setSourceUrl(url);
      setSourceBytes(blob.size);
      void blob.arrayBuffer().then((buffer) => {
        const info = sniffImage(new Uint8Array(buffer));
        setSniffed(
          info
            ? `${info.format}（${info.mimeType}）· ${info.width ?? '?'}×${info.height ?? '?'} · ${info.extension}`
            : '未识别为图片',
        );
      });
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const describe = useCallback((result: ImageProcessResult) => {
    const before = Math.round(result.sizeBefore / 1024);
    const after = Math.round(result.sizeAfter / 1024);
    const delta = ((1 - result.sizeAfter / result.sizeBefore) * 100).toFixed(1);
    setLastResult(
      `${result.meta.format.toUpperCase()} ${result.meta.width}×${result.meta.height} · ${before} KB → ${after} KB（${Number(delta) >= 0 ? '−' : '+'}${Math.abs(Number(delta))}%）`,
    );
  }, []);

  return (
    <div className="demo-editor-container">
      <div className="demo-control-bar">
        <button
          type="button"
          className="demo-btn"
          disabled={!sourceUrl}
          onClick={() => setOpen(true)}
        >
          打开图片编辑器
        </button>
        <span className="demo-control-bar-hint">
          演示源图由 canvas 现场生成
        </span>
      </div>

      <div className="demo-editor-body" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {sourceUrl ? (
            <img
              src={sourceUrl}
              alt="演示源图"
              style={{
                width: 320,
                borderRadius: 8,
                border: '1px solid var(--demo-border)',
              }}
            />
          ) : null}
          <div
            style={{
              fontSize: 13,
              lineHeight: 2,
              color: 'var(--demo-text-muted)',
            }}
          >
            <div>
              源图字节：
              {sourceBytes ? `${Math.round(sourceBytes / 1024)} KB` : '—'}
            </div>
            <div>魔数嗅探：{sniffed}</div>
            {/* 保存回调的结果就地展示（演示页不接服务端，无成功提示可弹） */}
            <div>上次处理结果：{lastResult}</div>
            <div>最近一次保存：{lastAction}</div>
            <div style={{ marginTop: 8, color: 'var(--demo-text-dim)' }}>
              可处理格式：{PROCESSABLE_FORMATS.join(' / ')}
            </div>
            <div style={{ color: 'var(--demo-text-dim)' }}>
              输入上限：{IMAGE_LIMITS.maxInputBytes / 1024 / 1024} MB ·{' '}
              {IMAGE_LIMITS.maxInputPixels / 10000} 万像素
            </div>
          </div>
        </div>
      </div>

      {sourceUrl ? (
        <ImageEditorModal
          open={open}
          src={sourceUrl}
          fileName="demo.png"
          onReplace={async (result) => {
            describe(result);
            setLastAction('已「覆盖原图」（演示仅更新统计，未写回服务端）');
            setOpen(false);
          }}
          onSaveAsNew={async (result) => {
            describe(result);
            setLastAction('已「另存为新文件」（演示仅更新统计）');
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
