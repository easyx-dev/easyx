/**
 * @easyx/image-toolkit 演示：浏览器内图片编辑全流程
 *
 * 源图由 canvas 现场生成（演示页无服务端），也可选择本地文件；整个处理链路在浏览器内完成：
 * 魔数嗅探 → wasm 引擎加载（含进度）→ 裁切/缩放/编码 → 结果回调 → 下载产物。
 *
 * 内容区 <ImageEditor> 直接嵌入页面，容器与下载动作都由本演示页（宿主）实现：
 * 组件经 onResultChange 交回处理结果，宿主据此渲染「下载最新结果」。
 * 主题无需桥接：data-theme 挂在 <html> 上。
 */
import { type ImageProcessResult, sniffImage } from '@easyx/image-toolkit';
import { ImageEditor, type ImageEditorResult } from '@easyx/image-toolkit/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { renameByMime } from './image-toolkit-demo/format';
import {
  ResultPanel,
  type ResultRecord,
} from './image-toolkit-demo/ResultPanel';
import { type LoadedSource, SourceCard } from './image-toolkit-demo/SourceCard';
import { DEMO_SOURCES, renderSource } from './image-toolkit-demo/sources';

/** 保留最近几次下载记录 */
const MAX_RECORDS = 4;

export default function ImageToolkitDemo() {
  const [sourceKey, setSourceKey] = useState(DEMO_SOURCES[0].key);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [source, setSource] = useState<LoadedSource | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [loadingSource, setLoadingSource] = useState(true);
  const [preview, setPreview] = useState<ImageEditorResult | null>(null);
  const [records, setRecords] = useState<ResultRecord[]>([]);

  // 结果图 Object URL 统一登记，卸载时回收
  const objectUrlsRef = useRef<string[]>([]);
  // 与 records 同步的镜像，便于在回调里做挤出回收而不把副作用写进 state updater
  const recordsRef = useRef<ResultRecord[]>([]);

  // 源图变化（切换内置源或选择本地文件）时重新生成并嗅探
  useEffect(() => {
    let cancelled = false;
    let url = '';
    setLoadingSource(true);
    setSourceError(null);
    setPreview(null);

    const load = async (): Promise<{ blob: Blob; fileName: string }> => {
      if (localFile) return { blob: localFile, fileName: localFile.name };
      const definition =
        DEMO_SOURCES.find((item) => item.key === sourceKey) ?? DEMO_SOURCES[0];
      const blob = await renderSource(definition);
      const extension = definition.mimeType === 'image/jpeg' ? 'jpg' : 'png';
      return { blob, fileName: `easyx-${definition.key}.${extension}` };
    };

    load()
      .then(async ({ blob, fileName }) => {
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSource({
          bytes: blob.size,
          fileName,
          sniff: sniffImage(new Uint8Array(buffer)),
          url,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setSourceError(
            error instanceof Error ? error.message : '生成源图失败',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSource(false);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sourceKey, localFile]);

  // 卸载时回收所有结果图地址
  useEffect(
    () => () => {
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  /** 记录一次产物并返回可下载的地址与文件名 */
  const pushRecord = useCallback(
    (result: ImageProcessResult): { fileName: string; url: string } => {
      const url = URL.createObjectURL(
        new Blob([result.data.slice()], { type: result.mimeType }),
      );
      objectUrlsRef.current.push(url);

      const entry: ResultRecord = {
        fileName: renameByMime(source?.fileName ?? 'image', result.mimeType),
        format: result.meta.format,
        height: result.meta.height,
        id: Date.now() + Math.random(),
        sizeAfter: result.sizeAfter,
        sizeBefore: result.sizeBefore,
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        url,
        width: result.meta.width,
      };

      const combined = [entry, ...recordsRef.current];
      const next = combined.slice(0, MAX_RECORDS);
      // 只保留最新的 MAX_RECORDS 条，被挤出的结果回收 Blob 地址
      for (const evicted of combined.slice(MAX_RECORDS)) {
        URL.revokeObjectURL(evicted.url);
        objectUrlsRef.current = objectUrlsRef.current.filter(
          (item) => item !== evicted.url,
        );
      }
      recordsRef.current = next;
      setRecords(next);

      return { fileName: entry.fileName, url };
    },
    [source],
  );

  // 宿主自己的下载动作：组件不提供保存，结果由 onResultChange 交回
  const handleDownload = useCallback(() => {
    const result = preview?.result;
    if (!result) return;
    const { fileName, url } = pushRecord(result);
    const anchor = document.createElement('a');
    anchor.download = fileName;
    anchor.href = url;
    // 挂到 DOM 再点击：部分 WebKit 版本对游离节点不触发 download
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [preview, pushRecord]);

  const selectBuiltIn = useCallback((key: string) => {
    setLocalFile(null);
    setSourceKey(key);
  }, []);

  const canDownload = preview?.result != null && !preview.pending;

  return (
    <div className="demo-editor-container">
      <div className="demo-control-bar">
        <button
          className="demo-btn demo-btn--primary"
          disabled={!canDownload}
          onClick={handleDownload}
          type="button"
        >
          下载最新结果
        </button>
        <span className="demo-control-bar-hint">
          内容区直接嵌入页面，下载动作由演示页实现（宿主职责）
        </span>
      </div>

      <div className="demo-editor-body">
        <div className="demo-image-layout">
          <SourceCard
            loading={loadingSource}
            localFile={localFile}
            onSelectBuiltIn={selectBuiltIn}
            onSelectLocal={setLocalFile}
            source={source}
            sourceError={sourceError}
            sourceKey={sourceKey}
          />

          <section className="demo-image-card">
            <div className="demo-image-card-head">
              <span className="demo-image-card-title">下载记录</span>
              {records.length > 0 ? (
                <span className="demo-image-tag">最近 {records.length} 次</span>
              ) : null}
            </div>
            <ResultPanel records={records} />
          </section>
        </div>

        {source ? (
          <section className="demo-image-card demo-image-editor">
            <div className="demo-image-card-head">
              <span className="demo-image-card-title">图片编辑内容区</span>
            </div>
            <ImageEditor
              key={source.url}
              onResultChange={setPreview}
              src={source.url}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
