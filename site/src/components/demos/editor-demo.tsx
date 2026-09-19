import type { EventHandler } from '@easyx/editor';
import { createEditor } from '@easyx/editor';
import { useCallback, useEffect, useRef, useState } from 'react';

const initialContent = `<h1>EasyX Editor 功能速览</h1>
<p>这份文档快速展示了编辑器支持的所有内容类型——<strong>加粗</strong>、<em>斜体</em>、<u>下划线</u>、<s>删除线</s>、<code>行内代码</code>、上标 E = mc<sup>2</sup> 和下标 H<sub>2</sub>O 均可在段落中自由组合。</p>
<h2>颜色与字号</h2>
<p>文本可设定<span style="color: hsl(0, 70%, 50%)">任意前景色</span>，也可添加<mark style="background-color: var(--easyx-editor-color-highlight-yellow)">黄色高亮</mark>、<mark style="background-color: var(--easyx-editor-color-highlight-blue)">蓝色高亮</mark>或<mark style="background-color: var(--easyx-editor-color-highlight-green)">绿色高亮</mark>。<span style="font-size: 36px">大字标题</span>与<span style="font-size: 12px">小字注释</span>通过字号控件一键调整，<span style="font-size: 18px">中文字号</span>同样灵活适配。</p>
<h2>标题层级</h2>
<h3>三级标题——用于章节划分</h3>
<h4>四级标题——用于小节</h4>
<h5>五级标题——用于条目</h5>
<h6>六级标题——用于细节标注</h6>
<h2>段落排版</h2>
<p style="text-align: left">左对齐：常规段落默认采用此方式，从左向右自然排列。</p>
<p style="text-align: center">居中对齐：适合短句、引言或视觉焦点内容。</p>
<p style="text-align: right">右对齐：常用于署名、日期或附加信息。</p>
<p style="text-align: justify">两端对齐：文字在左右两端均匀分布，在排布长段落时使页面边缘整齐划一，提升阅读体验。</p>
<p data-indent="2" style="text-indent: 2em">首行缩进两字符，是中文正式文档的常见规范。多次点击缩进按钮可增加缩进量，适合长篇正文。</p>
<h2>引用与代码</h2>
<blockquote><p><em>"Stay hungry, stay foolish."</em> —— Steve Jobs</p></blockquote>
<pre><code>// 一段 TypeScript 工具函数
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return \`\${y}-\${m}-\${d}\`;
}</code></pre>
<h2>列表</h2>
<h3>无序列表</h3>
<ul>
  <li><p><strong>模块化架构</strong>：每个功能独立为 plugin，按需加载</p></li>
  <li><p><strong>类型安全</strong>：完整的 TypeScript 类型定义</p></li>
  <li><p><strong>主题支持</strong>：浅色 / 深色 / 跟随系统三种模式</p></li>
</ul>
<h3>有序列表</h3>
<ol>
  <li><p>准备数据源与素材</p></li>
  <li><p>在编辑器中撰写内容</p></li>
  <li><p>导出为 HTML 或 Markdown</p></li>
</ol>
<h3>任务列表</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><p>完成核心编辑器集成</p></li>
  <li data-type="taskItem" data-checked="true"><p>实现 19 个功能插件</p></li>
  <li data-type="taskItem" data-checked="false"><p>编写组件文档与示例</p></li>
  <li data-type="taskItem" data-checked="false"><p><strong>发布 1.0 版本</strong></p></li>
</ul>
<h2>表格</h2>
<table>
  <tr><th><p><strong>功能</strong></p></th><th><p><strong>快捷键</strong></p></th><th><p><strong>状态</strong></p></th></tr>
  <tr><td><p>加粗</p></td><td><p style="text-align: center"><code>⌘ B</code></p></td><td><p style="text-align: center">✓</p></td></tr>
  <tr><td><p>斜体</p></td><td><p style="text-align: center"><code>⌘ I</code></p></td><td><p style="text-align: center">✓</p></td></tr>
  <tr><td><p>下划线</p></td><td><p style="text-align: center"><code>⌘ U</code></p></td><td><p style="text-align: center">✓</p></td></tr>
  <tr><td><p>删除线</p></td><td><p style="text-align: center"><code>⌘ ⇧ S</code></p></td><td><p style="text-align: center">✓</p></td></tr>
  <tr><td><p>撤销</p></td><td><p style="text-align: center"><code>⌘ Z</code></p></td><td><p style="text-align: center">✓</p></td></tr>
  <tr><td><p>重做</p></td><td><p style="text-align: center"><code>⌘ ⇧ Z</code></p></td><td><p style="text-align: center">✓</p></td></tr>
</table>
<h2>媒体内容</h2>
<h3>图片</h3>
<p>选中图片后可通过拖拽手柄调整宽度，也可设置对齐方式和滤镜效果。</p>
<img src="https://template.tiptap.dev/images/tiptap-ui-placeholder-image.jpg" alt="示例图片" data-width="480px" data-alignment="center" />
<h3>视频</h3>
<p>支持插入视频并设置封面图、播放控件、自动播放和循环播放。</p>
<video src="https://09597157-0eab-4d78-9f1b-3dc3e4ddc353.mdnplay.dev/shared-assets/videos/flower.webm" width="720" data-alignment="center" controls></video>
<h3>音频</h3>
<p>音频以卡片形式展示，内嵌原生播放控件。</p>
<audio src="https://a65c28c1-a726-4e4b-aac3-b94931f43200.mdnplay.dev/shared-assets/audio/t-rex-roar.mp3" controls></audio>
<h3>附件</h3>
<p>文件附件显示文件名、类型和大小，并提供下载入口。</p>
<a data-type="attachment" href="https://picsum.photos/seed/1/400/300" download="季度报告.pdf" data-file-size="3145728" data-file-type="application/pdf">季度报告.pdf</a>
<h2>链接与智能排版</h2>
<p>这是一段包含<a href="https://tiptap.dev" target="_blank" rel="noopener noreferrer nofollow">外部链接</a>的文本。编辑器内置智能排版：输入 <code>(c)</code> 自动替换为 ©，<code>-></code> 变为 →，<code>1/2</code> 变为 ½。更多替换规则可在输入法中体验。</p>`;

function simulateUpload(
  file: File,
): Promise<{ id: string; url: string; name: string; size: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: file.name,
        url: reader.result as string,
        name: file.name,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
}

/** 模拟媒体库：返回固定图片列表并支持分页过滤 */
function simulateGetList(params: {
  page: number;
  pageSize: number;
  keyword?: string;
}): Promise<{
  items: { id: string; url: string; name: string }[];
  total: number;
}> {
  const all = Array.from({ length: 24 }, (_, i) => ({
    id: String(i + 1),
    url: `https://picsum.photos/seed/demo${i + 1}/400/300`,
    name: `示例图片 ${i + 1}`,
  }));
  const filtered = params.keyword
    ? all.filter((item) => item.name.includes(params.keyword!))
    : all;
  const start = (params.page - 1) * params.pageSize;
  return Promise.resolve({
    items: filtered.slice(start, start + params.pageSize),
    total: filtered.length,
  });
}

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export default function EditorDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof createEditor> | null>(null);
  const isDark = useIsDark();
  const theme = isDark ? 'dark' : 'light';

  const [html, setHtml] = useState('');
  const [isDisabled, setIsDisabled] = useState(false);

  const refreshState = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    setHtml(ed.getHTML());
    setIsDisabled(ed.isDisabled());
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = createEditor(containerRef.current, {
      defaultContent: initialContent,
      defaultTheme: theme,
      placeholder: '请输入内容…',
      // 演示最大高度 + 可拖拽调高：内容超出上限内部滚动，底边可拖拽或方向键调高
      maxHeight: 520,
      resizable: true,
      image: { upload: simulateUpload, getList: simulateGetList },
      video: { upload: simulateUpload },
      audio: { upload: simulateUpload },
      attachment: { upload: simulateUpload },
    });

    editorRef.current = editor;

    const changeHandler: EventHandler = () => refreshState();
    const readyHandler: EventHandler = () => refreshState();

    editor.on('change', changeHandler);
    editor.on('ready', readyHandler);
    refreshState();

    return () => {
      editor.off('change', changeHandler);
      editor.off('ready', readyHandler);
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    editorRef.current?.setTheme(theme);
  }, [theme]);

  const handleReset = useCallback(() => {
    editorRef.current?.setHTML(initialContent);
    refreshState();
  }, [refreshState]);

  const handleClear = useCallback(() => {
    editorRef.current?.clear();
    refreshState();
  }, [refreshState]);

  const handleToggleDisabled = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (ed.isDisabled()) {
      ed.enable();
    } else {
      ed.disable();
    }
    refreshState();
  }, [refreshState]);

  return (
    <div className="demo-editor-container">
      <div className="demo-control-bar">
        <button type="button" onClick={handleReset}>
          重置内容
        </button>
        <button type="button" onClick={handleClear}>
          清空
        </button>
        <button type="button" onClick={handleToggleDisabled}>
          {isDisabled ? '启用' : '禁用'}
        </button>
        <span className="demo-control-bar-hint">
          createEditor(container, options) — 主题: {theme}
        </span>
      </div>

      <div className="demo-editor-body">
        <div className="demo-editor-wrapper" ref={containerRef} />
      </div>

      <details className="demo-editor-output">
        <summary className="demo-editor-output-summary">查看 HTML 输出</summary>
        <pre className="demo-code-block">{html || '<空>'}</pre>
      </details>
    </div>
  );
}
