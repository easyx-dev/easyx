/**
 * 下载记录面板：展示最近几次下载的产物缩略图与体积变化
 *
 * 演示页没有服务端，「下载」是唯一的落盘方式；这些记录由演示页（宿主）维护，
 * 组件本身不产出任何保存动作。
 */
import { describeReduction, formatBytes } from './format';

export interface ResultRecord {
  id: number;
  fileName: string;
  format: string;
  width: number;
  height: number;
  sizeBefore: number;
  sizeAfter: number;
  time: string;
  /** 结果图的 Object URL（由调用方负责回收） */
  url: string;
}

export interface ResultPanelProps {
  records: ResultRecord[];
}

export function ResultPanel({ records }: ResultPanelProps) {
  if (records.length === 0) {
    return (
      <p className="demo-image-empty">
        调整参数后点「下载最新结果」，这里会保留最近几次产物的缩略图与体积变化。
      </p>
    );
  }

  return (
    <ol className="demo-image-results">
      {records.map((record, index) => (
        <li
          className="demo-image-result"
          data-latest={index === 0}
          key={record.id}
        >
          <img
            alt={record.fileName}
            className="demo-image-result-thumb"
            src={record.url}
          />
          <div className="demo-image-result-meta">
            <div className="demo-image-result-name">
              {record.fileName}
              {index === 0 ? (
                <span className="demo-image-tag">最新</span>
              ) : null}
            </div>
            <div className="demo-image-result-line">
              {record.format.toUpperCase()} · {record.width}×{record.height} ·{' '}
              {formatBytes(record.sizeBefore)} → {formatBytes(record.sizeAfter)}
            </div>
            <div className="demo-image-result-sub">
              {describeReduction(record.sizeBefore, record.sizeAfter)} ·{' '}
              {record.time}
            </div>
          </div>
          <a className="demo-btn" download={record.fileName} href={record.url}>
            下载
          </a>
        </li>
      ))}
    </ol>
  );
}
