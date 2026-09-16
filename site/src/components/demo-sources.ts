/**
 * Demo 源码预加载模块
 *
 * 通过 import.meta.glob 在构建时读取 demos 目录下所有演示的源码文本，
 * 供文档页的「查看代码」面板按 slug 展示；目录层级不限，以文件名为 slug。
 */

const sources = import.meta.glob('./demos/**/*.tsx', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

/** 按 slug 获取演示源码文本（slug 需与演示文件名一致） */
export function getDemoSource(slug: string): string | undefined {
  for (const [path, content] of Object.entries(sources)) {
    const filename = path.split('/').pop()?.replace('.tsx', '');
    if (filename === slug) {
      return content;
    }
  }
  return undefined;
}
