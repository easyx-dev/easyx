/**
 * 演示用的小工具：体积格式化与文件名改写
 */

/** 字节数转可读文本 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 体积变化描述：增加还是减小、百分比 */
export function describeReduction(before: number, after: number): string {
  const percent = before > 0 ? (1 - after / before) * 100 : 0;
  const direction = percent >= 0 ? '减小' : '增大';
  return `${direction} ${Math.abs(percent).toFixed(1)}%`;
}

/** 按输出 MIME 改写文件名后缀（覆盖原图或另存时格式可能变化） */
export function renameByMime(fileName: string, mimeType: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '') || 'image';
  const subtype = mimeType.split('/')[1] ?? 'bin';
  return `${base}.${subtype === 'jpeg' ? 'jpg' : subtype}`;
}
