import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  base: '/easyx/',
  site: 'https://easyx-dev.github.io/easyx/',
  integrations: [
    react(),
    starlight({
      title: 'EasyX',
      description:
        'EasyX 系列独立库：零框架依赖的 Tiptap 富文本编辑器、表格增强套件，以及更多 Web 能力',
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
      ],
    }),
  ],
});
