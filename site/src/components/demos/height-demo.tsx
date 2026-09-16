import type { EasyxEditorOptions } from '@easyx/editor';
import { createEditor } from '@easyx/editor';
import { useEffect, useRef, useState } from 'react';

/** 用于撑高内容、触发内部滚动的长文本 */
const longContent = Array.from({ length: 10 }, (_, i) => {
  const heading = `<h2>第 ${i + 1} 节标题</h2>`;
  const body = `<p>编辑器高度模式演示内容。第 ${i + 1} 段用于撑开编辑区高度，检验在「定高」「最大高度」模式下的内部滚动、在「自动高度」模式下的自然伸缩。<strong>加粗</strong> 与 <em>斜体</em> 用于展示文本样式。</p>`;
  const line = `<p style="text-align: center">居中对齐示例：高度变化时观察编辑区如何响应。</p>`;
  return heading + body + line;
}).join('\n');

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

/** 模拟上传：读为 DataURL，返回编辑器要求的媒体项结构 */
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

interface HeightCaseProps {
  title: string;
  desc: string;
  code: string;
  options?: EasyxEditorOptions;
}

/** 单个高度模式示例：标题 + 配置代码 + 编辑器实例 */
function HeightCase({ title, desc, code, options }: HeightCaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof createEditor> | null>(null);
  const isDark = useIsDark();
  const theme = isDark ? 'dark' : 'light';

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = createEditor(containerRef.current, {
      defaultContent: longContent,
      defaultTheme: theme,
      placeholder: '请输入内容…',
      image: { upload: simulateUpload },
      video: { upload: simulateUpload },
      audio: { upload: simulateUpload },
      attachment: { upload: simulateUpload },
      ...options,
    });

    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    editorRef.current?.setTheme(theme);
  }, [theme]);

  return (
    <section className="height-demo-case">
      <header className="height-demo-case-header">
        <div>
          <h3 className="height-demo-case-title">{title}</h3>
          <p className="height-demo-case-desc">{desc}</p>
        </div>
        <code className="height-demo-case-code">{code}</code>
      </header>
      <div className="height-demo-editor" ref={containerRef} />
    </section>
  );
}

export default function HeightDemo() {
  return (
    <div className="height-demo">
      <p className="height-demo-intro">
        编辑器通过 <code>height</code>、<code>minHeight</code>、
        <code>maxHeight</code> 与 <code>resizable</code> 配置控制高度行为：
        自动高度随内容伸缩；定高与最大高度在内容超出后内部滚动；开启
        <code>resizable</code> 后可在底边拖拽或按键盘方向键调节高度。
      </p>

      <HeightCase
        title="自动高度"
        desc="默认行为：编辑区随内容自然伸缩，保底 200px，不产生内部滚动条。"
        code="createEditor(el, { ... })"
      />

      <HeightCase
        title="定高 + 可拖拽调节"
        desc="固定 320px 高度，内容超出后内部滚动；开启 resizable 后可按底边拖拽或方向键调高。"
        code="createEditor(el, { height: 320, resizable: true })"
        options={{ height: 320, resizable: true }}
      />

      <HeightCase
        title="最大高度"
        desc="内容先自然伸缩，撑到 380px 上限后内部滚动，避免占满整页。"
        code="createEditor(el, { maxHeight: 380 })"
        options={{ maxHeight: 380 }}
      />
    </div>
  );
}
