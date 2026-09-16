/**
 * Demo 宿主：按 slug 懒加载并渲染对应的演示组件
 *
 * 以 Astro client:only 孤岛挂载，演示组件在浏览器端按需拉取，
 * 保证重依赖演示（React / wasm / Monaco 等）不随文档站主包一起加载。
 * chunk 加载失败或演示渲染期抛错时由错误边界兜底，避免整块区域静默空白。
 */

import { Component, lazy, type ReactNode, Suspense } from 'react';
import { demos, getDemoEntry } from './demos/registry';

/** 模块级缓存 lazy 组件，避免每次渲染重建导致重复加载 */
const lazyComponents = new Map(
  demos.map((demo) => [demo.slug, lazy(demo.load)]),
);

interface DemoErrorBoundaryState {
  error: Error | null;
}

/** 错误边界：React 19 仍只有类组件能捕获子树渲染错误 */
class DemoErrorBoundary extends Component<
  { children: ReactNode },
  DemoErrorBoundaryState
> {
  state: DemoErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DemoErrorBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ padding: '2rem' }}>演示加载失败：{error.message}</div>
      );
    }
    return this.props.children;
  }
}

interface DemoHostProps {
  /** 演示 slug，对应注册表中的登记项 */
  slug: string;
}

export default function DemoHost({ slug }: DemoHostProps) {
  const entry = getDemoEntry(slug);
  const Demo = entry ? lazyComponents.get(entry.slug) : undefined;

  if (!Demo) {
    return <div style={{ padding: '2rem' }}>未找到演示：{slug}</div>;
  }

  return (
    <DemoErrorBoundary>
      <Suspense fallback={<div style={{ padding: '2rem' }}>演示加载中…</div>}>
        <Demo />
      </Suspense>
    </DemoErrorBoundary>
  );
}
