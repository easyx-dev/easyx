/**
 * Demo 注册表：文档站所有演示的唯一登记点
 *
 * 新增演示时只需在此追加 slug 与标题，组件按同名文件从本目录懒加载：
 * - 路由：site/src/pages/demos/[slug].astro 由本表生成静态路径
 * - 源码：demo-sources.ts 按 slug 读取同名 .tsx 的文件文本
 *
 * 组件一律通过动态 import 懒加载，避免重依赖（React / antd / wasm 等）进入文档站主包。
 */

import type { ComponentType } from 'react';

/** 单条演示登记项 */
export interface DemoEntry {
  /** 路由与 iframe 使用的 slug，全站唯一，约定以「库名-」前缀区分，且必须与同名 .tsx 文件一致 */
  slug: string;
  /** 演示标题，用于 iframe 工具栏 */
  title: string;
  /** 懒加载演示组件 */
  load: () => Promise<{ default: ComponentType }>;
}

/** 本目录下的演示组件，键为 './<slug>.tsx' */
const demoModules = import.meta.glob<{ default: ComponentType }>('./*.tsx');

/** slug 与标题登记表，组件按同名文件懒加载 */
const demoMeta = [
  { slug: 'editor-demo', title: '全功能编辑器' },
  { slug: 'vanilla-demo', title: '原生 API' },
  { slug: 'table-plus-demo', title: '表格增强套件' },
  { slug: 'height-demo', title: '高度模式' },
];

export const demos: DemoEntry[] = demoMeta.map(({ slug, title }) => {
  const load = demoModules[`./${slug}.tsx`];
  if (!load) {
    throw new Error(
      `Demo 注册表与文件名不一致：缺少 src/components/demos/${slug}.tsx（slug 必须与演示文件名相同，否则路由与「查看代码」会失效）`,
    );
  }
  return { slug, title, load };
});

/** 按 slug 查找演示登记项 */
export function getDemoEntry(slug: string): DemoEntry | undefined {
  return demos.find((demo) => demo.slug === slug);
}
