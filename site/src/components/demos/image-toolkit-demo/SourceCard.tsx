/**
 * 源图卡片：内置样张切换、本地上传，以及魔数嗅探信息与输入上限
 */
import {
  IMAGE_LIMITS,
  type ImageSniffResult,
  PROCESSABLE_FORMATS,
} from '@easyx/image-toolkit';
import { useRef } from 'react';
import { formatBytes } from './format';
import { DEMO_SOURCES } from './sources';

export interface LoadedSource {
  url: string;
  fileName: string;
  bytes: number;
  sniff: ImageSniffResult | null;
}

export interface SourceCardProps {
  source: LoadedSource | null;
  sourceError: string | null;
  loading: boolean;
  sourceKey: string;
  localFile: File | null;
  onSelectBuiltIn: (key: string) => void;
  onSelectLocal: (file: File) => void;
}

/** 嗅探结果转一行可读文本 */
function describeSniff(info: ImageSniffResult | null): string {
  if (!info) return '未识别为图片';
  return `${info.format.toUpperCase()} · ${info.mimeType} · ${info.width ?? '?'}×${info.height ?? '?'} · .${info.extension}`;
}

export function SourceCard({
  source,
  sourceError,
  loading,
  sourceKey,
  localFile,
  onSelectBuiltIn,
  onSelectLocal,
}: SourceCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSource =
    DEMO_SOURCES.find((item) => item.key === sourceKey) ?? DEMO_SOURCES[0];

  return (
    <section className="demo-image-card">
      <div className="demo-image-card-head">
        <span className="demo-image-card-title">源图</span>
        {loading ? <span className="demo-image-tag">生成中…</span> : null}
      </div>

      <div className="demo-image-preview">
        {sourceError ? (
          <p className="demo-image-error">{sourceError}</p>
        ) : source ? (
          <img
            alt={source.fileName}
            className="demo-image-preview-img"
            src={source.url}
          />
        ) : null}
      </div>

      <div className="demo-image-chips">
        {DEMO_SOURCES.map((item) => (
          <button
            aria-pressed={!localFile && item.key === sourceKey}
            className="demo-image-chip"
            key={item.key}
            onClick={() => onSelectBuiltIn(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <button
          aria-pressed={localFile !== null}
          className="demo-image-chip"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          本地图片
        </button>
        <input
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onSelectLocal(file);
            // 允许连续选择同一个文件
            event.target.value = '';
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>

      <p className="demo-image-note">
        {localFile ? `已选择本地文件：${localFile.name}` : activeSource.note}
      </p>

      <dl className="demo-image-facts">
        <div>
          <dt>文件名</dt>
          <dd>{source?.fileName ?? '—'}</dd>
        </div>
        <div>
          <dt>文件体积</dt>
          <dd>{source ? formatBytes(source.bytes) : '—'}</dd>
        </div>
        <div>
          <dt>魔数嗅探</dt>
          <dd>{describeSniff(source?.sniff ?? null)}</dd>
        </div>
        <div>
          <dt>可处理格式</dt>
          <dd>{PROCESSABLE_FORMATS.join(' / ')}</dd>
        </div>
        <div>
          <dt>输入上限</dt>
          <dd>
            {IMAGE_LIMITS.maxInputBytes / 1024 / 1024} MB ·{' '}
            {IMAGE_LIMITS.maxInputPixels / 10000} 万像素
          </dd>
        </div>
      </dl>
    </section>
  );
}
