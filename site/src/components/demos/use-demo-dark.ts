/**
 * 演示页主题判定：读取演示页文档根的 data-theme（由 [slug].astro 注入并按宿主消息切换）
 */
import { useEffect, useState } from 'react';

function detect(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function useDemoDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(detect());
    const observer = new MutationObserver(() => setIsDark(detect()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
