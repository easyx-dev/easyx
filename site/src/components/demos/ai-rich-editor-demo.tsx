/**
 * @easyx/ai-rich-editor 演示：对话生成 HTML 片段 + 实时预览
 *
 * 文档站是纯静态站点、没有服务端，因此这里在浏览器侧拦截该端点并回放一段预录的
 * TanStack AI 标准 SSE 流（同样的 chunk 序列，逐字下发），AI 对话链路本身走真实实现。
 */
import { AiRichEditor, DEFAULT_HTML } from '@easyx/ai-rich-editor';
import { theme as antdTheme, ConfigProvider } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useDemoDark } from './use-demo-dark';

/** 演示端点：只在本次演示内被拦截，不影响页面其他请求 */
const MOCK_ENDPOINT = '/__easyx_demo__/ai-chat';

/** 预录回复：markdown 正文 + ```html 片段（片段内含 <style>，用于演示作用域化） */
const CANNED_REPLY = [
  '这是一个活动落地页片段，样式已内联并在外层的 `<style>` 中声明，类名保持语义化。',
  '',
  '```html',
  '<div class="promo-hero">',
  '  <span class="promo-tag">限时活动</span>',
  '  <h2 class="promo-title">春季新品发布会</h2>',
  '  <p class="promo-desc">3 月 18 日 20:00 线上直播，前 500 名预约用户可领取新品体验装。</p>',
  '  <div class="promo-stats">',
  '    <span class="promo-stat"><b>12</b> 款新品</span>',
  '    <span class="promo-stat"><b>2</b> 小时直播</span>',
  '  </div>',
  '  <a class="promo-btn" href="#signup">立即预约</a>',
  '</div>',
  '<style>',
  '  .promo-hero { padding: 40px 32px; border-radius: 16px; background: linear-gradient(135deg, #1e1b4b, #4338ca); color: #f8fafc; font-family: system-ui, sans-serif; }',
  '  .promo-tag { display: inline-block; padding: 4px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.16); font-size: 13px; }',
  '  .promo-title { margin: 16px 0 8px; font-size: 32px; line-height: 1.25; }',
  '  .promo-desc { margin: 0; max-width: 560px; line-height: 1.7; opacity: 0.86; }',
  '  .promo-stats { display: flex; gap: 28px; margin: 24px 0; }',
  '  .promo-stat b { font-size: 24px; margin-right: 6px; }',
  '  .promo-btn { display: inline-block; padding: 10px 24px; border-radius: 999px; background: #f8fafc; color: #312e81; font-weight: 600; text-decoration: none; }',
  '</style>',
  '```',
].join('\n');

/** 思考过程文本 */
const CANNED_THINKING =
  '用户要一个活动落地页片段。产出应为 fragment：外层用语义化类名，样式集中在一段 <style> 中且只作用于片段内部，避免 body / :root 这类全局选择器。';

/** 组装标准 AG-UI / TanStack AI 事件序列 */
function buildChunks(threadId: string, runId: string) {
  const now = () => Date.now();
  return [
    { type: 'RUN_STARTED', threadId, runId, timestamp: now() },
    { type: 'STEP_STARTED', stepName: 'reasoning-1', timestamp: now() },
    {
      type: 'REASONING_MESSAGE_CONTENT',
      messageId: 'reasoning-1',
      delta: CANNED_THINKING,
      timestamp: now(),
    },
    {
      type: 'TEXT_MESSAGE_START',
      messageId: 'msg-1',
      role: 'assistant',
      timestamp: now(),
    },
    {
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: 'msg-1',
      delta: CANNED_REPLY,
      timestamp: now(),
    },
    { type: 'TEXT_MESSAGE_END', messageId: 'msg-1', timestamp: now() },
    { type: 'RUN_FINISHED', threadId, runId, timestamp: now() },
  ];
}

/** 把事件序列拆成逐字下发的 SSE 响应（模拟真实流式返回） */
function createSseResponse(): Response {
  const encoder = new TextEncoder();
  const chunks = buildChunks('demo-thread', 'demo-run');

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (payload: string) =>
        controller.enqueue(encoder.encode(`data: ${payload}\n`));

      for (const chunk of chunks) {
        // 文本类 chunk 按小段下发，让流式渲染与「实时同步到编辑器」可被观察到
        if (
          chunk.type === 'TEXT_MESSAGE_CONTENT' ||
          chunk.type === 'REASONING_MESSAGE_CONTENT'
        ) {
          const text = String(chunk.delta);
          for (let i = 0; i < text.length; i += 12) {
            push(JSON.stringify({ ...chunk, delta: text.slice(i, i + 12) }));
            await new Promise((resolve) => setTimeout(resolve, 24));
          }
          continue;
        }
        push(JSON.stringify(chunk));
        await new Promise((resolve) => setTimeout(resolve, 40));
      }

      // 终止哨兵：解析器据此合成结束事件
      controller.enqueue(encoder.encode('data: [DONE]\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

/** 仅拦截演示端点，其余请求原样透传；返回还原函数 */
function installFetchMock(): () => void {
  const original = window.fetch;

  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes(MOCK_ENDPOINT) && init?.method === 'POST') {
      return Promise.resolve(createSseResponse());
    }
    return original(input, init);
  };

  return () => {
    window.fetch = original;
  };
}

export default function AiRichEditorDemo() {
  const isDark = useDemoDark();
  const [html, setHtml] = useState(DEFAULT_HTML);

  useEffect(installFetchMock, []);

  const themeConfig = useMemo(
    () => ({
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    }),
    [isDark],
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <div className="demo-editor-container">
        <div className="demo-control-bar">
          <span className="demo-control-bar-hint">
            对话由浏览器侧回放预录 SSE 流，链路走真实实现
          </span>
        </div>
        <div style={{ padding: 16 }}>
          <AiRichEditor
            value={html}
            onChange={setHtml}
            endpointUrl={MOCK_ENDPOINT}
            height={620}
          />
        </div>
      </div>
    </ConfigProvider>
  );
}
