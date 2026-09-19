import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  base: '/easyx/',
  site: 'https://easyx-dev.github.io/easyx/',
  // 构建与开发分离依赖预打包目录：两者默认共用 node_modules/.vite/deps，
  // 而构建（生产）会把它改写成生产态产物，此时仍在运行的 dev server 会拿到
  // 生产态的 react/jsx-dev-runtime（其 jsxDEV 为 undefined）而报 `jsxDEV is not a function`。
  // Astro 的 defineConfig 不接受函数形式，故以 NODE_ENV 区分（CLI 在加载配置前已按命令写入）；
  // 前提是 NODE_ENV 与命令一致 —— 开发时不要在 shell 里预设 NODE_ENV=production。
  vite: {
    cacheDir:
      process.env.NODE_ENV === 'production'
        ? 'node_modules/.vite-build'
        : 'node_modules/.vite',
  },
  integrations: [
    react(),
    starlight({
      title: 'EasyX',
      description:
        'EasyX 系列独立库：零框架依赖的 Tiptap 富文本编辑器、表格增强套件、AI HTML 片段工作台与浏览器端图片处理，以及更多 Web 能力',
      defaultLocale: 'root',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/easyx-dev/easyx',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      // 侧边栏按库分组，一个库一个分组；新增库在此追加分组
      sidebar: [
        { label: '系列概览', link: '/' },
        {
          label: 'Editor',
          items: [
            { slug: 'editor' },
            { slug: 'editor/demo' },
            { slug: 'editor/vanilla-demo' },
            { slug: 'editor/height' },
            { slug: 'editor/api-reference' },
          ],
        },
        {
          label: 'Table Plus',
          items: [{ slug: 'table-plus' }, { slug: 'table-plus/api-reference' }],
        },
        {
          label: 'AI Rich Editor',
          items: [
            { slug: 'ai-rich-editor' },
            { slug: 'ai-rich-editor/demo' },
            { slug: 'ai-rich-editor/documents' },
            { slug: 'ai-rich-editor/api-reference' },
          ],
        },
        {
          label: 'Image Toolkit',
          items: [
            { slug: 'image-toolkit' },
            { slug: 'image-toolkit/demo' },
            { slug: 'image-toolkit/api-reference' },
          ],
        },
      ],
    }),
  ],
});
