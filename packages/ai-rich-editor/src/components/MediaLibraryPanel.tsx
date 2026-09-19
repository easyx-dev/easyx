/**
 * 媒体库面板：搜索 + 网格 + 分页
 *
 * 列表接口是宿主既有能力（MediaUploadConfig.getList），此处只做呈现：
 * 展示时拉一次（接口存 ref，避免宿主内联 media 导致每次渲染重拉），
 * 翻页与搜索按请求序号丢弃过期响应。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toError } from '../media/errors';
import { formatBytes, resolveItemKind } from '../media/routing';
import type {
  MediaItem,
  MediaListParams,
  MediaListResult,
} from '../media/types';
import { cx } from '../ui/cx';
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  MEDIA_KIND_ICONS,
} from '../ui/icons';

/** 每页条目数（与编辑器媒体库保持一致的量级） */
const PAGE_SIZE = 12;

export interface MediaLibraryPanelProps {
  getList: (params: MediaListParams) => Promise<MediaListResult>;
  onPick: (item: MediaItem) => void;
  /** 加载失败上报（面板内同时给出重试提示） */
  onError?: (error: Error) => void;
}

type LoadState =
  | { type: 'loading' }
  | { type: 'ready' }
  | { type: 'empty' }
  | { type: 'error' };

export function MediaLibraryPanel({
  getList,
  onPick,
  onError,
}: MediaLibraryPanelProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [state, setState] = useState<LoadState>({ type: 'loading' });
  /** 请求序号：翻页/搜索竞态时只认最后一次 */
  const seqRef = useRef(0);
  /** 接口与回调存 ref：只在意「当前用哪份实现」，不因宿主重建对象而重拉 */
  const getListRef = useRef(getList);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    getListRef.current = getList;
    onErrorRef.current = onError;
  }, [getList, onError]);

  const load = useCallback(async (targetPage: number, search: string) => {
    const seq = ++seqRef.current;
    setState({ type: 'loading' });
    try {
      const result = await getListRef.current({
        page: targetPage,
        pageSize: PAGE_SIZE,
        keyword: search || undefined,
      });
      if (seq !== seqRef.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPage(targetPage);
      setState({
        type: result.items.length === 0 ? 'empty' : 'ready',
      });
    } catch (error) {
      if (seq !== seqRef.current) return;
      setState({ type: 'error' });
      onErrorRef.current?.(toError(error));
    }
  }, []);

  // 展示时拉首页；后续翻页/搜索由交互驱动
  useEffect(() => {
    void load(1, '');
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="easyx-ai-rich-editor__library">
      <div className="easyx-ai-rich-editor__library-search">
        <input
          className="easyx-ai-rich-editor__library-search-input"
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            void load(1, keyword.trim());
          }}
          placeholder="搜索媒体…"
          type="search"
          value={keyword}
        />
        <button
          aria-label="搜索"
          className="easyx-ai-rich-editor__library-search-btn"
          onClick={() => void load(1, keyword.trim())}
          type="button"
        >
          <IconSearch />
        </button>
      </div>

      {state.type !== 'ready' && (
        <div
          className={cx(
            'easyx-ai-rich-editor__library-status',
            `easyx-ai-rich-editor__library-status--${state.type}`,
          )}
        >
          {state.type === 'loading' && '加载中…'}
          {state.type === 'empty' && '暂无媒体，试试搜索或上传'}
          {state.type === 'error' && '加载失败，请重试'}
        </div>
      )}

      {state.type === 'ready' && (
        <div className="easyx-ai-rich-editor__library-grid">
          {items.map((item) => {
            const Icon = MEDIA_KIND_ICONS[resolveItemKind(item)];
            return (
              <button
                aria-label={`选择 ${item.name}`}
                className="easyx-ai-rich-editor__library-item"
                key={item.id}
                onClick={() => onPick(item)}
                title={item.name}
                type="button"
              >
                <span className="easyx-ai-rich-editor__library-thumb">
                  {item.thumbnailUrl ? (
                    <img
                      alt={item.name}
                      loading="lazy"
                      src={item.thumbnailUrl}
                    />
                  ) : (
                    <Icon size={18} />
                  )}
                </span>
                <span className="easyx-ai-rich-editor__library-name">
                  {item.name}
                </span>
                {item.size != null && (
                  <span className="easyx-ai-rich-editor__library-size">
                    {formatBytes(item.size)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {state.type === 'ready' && total > 0 && (
        <div className="easyx-ai-rich-editor__library-pager">
          <button
            aria-label="上一页"
            className="easyx-ai-rich-editor__library-page-btn"
            disabled={page <= 1}
            onClick={() => void load(page - 1, keyword.trim())}
            type="button"
          >
            <IconChevronLeft />
          </button>
          <span className="easyx-ai-rich-editor__library-page-info">
            {page} / {pageCount} · 共 {total} 项
          </span>
          <button
            aria-label="下一页"
            className="easyx-ai-rich-editor__library-page-btn"
            disabled={page >= pageCount}
            onClick={() => void load(page + 1, keyword.trim())}
            type="button"
          >
            <IconChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
