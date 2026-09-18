/**
 * 内置回放：浏览器侧拦截演示端点，逐字下发一段预录的 OpenAI 标准 SSE 流
 *
 * 站点是纯静态、没有服务端，默认模式靠这里让「对话 → 流式渲染 → 同步到编辑器」
 * 整条链路真实可跑；切换到真实模型后由调用方卸载拦截。
 */

/** 演示端点：只在本次演示内被拦截，不影响页面其他请求 */
export const MOCK_ENDPOINT = '/__easyx_demo__/ai-chat';

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

/** 思考过程文本（演示 reasoning_content 方言字段） */
const CANNED_THINKING =
  '用户要一个活动落地页片段。产出应为 fragment：外层用语义化类名，样式集中在一段 <style> 中且只作用于片段内部，避免 body / :root 这类全局选择器。';

/** 单个 SSE 行的封装（`data: …\n`） */
function line(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n`;
}

/** 正文增量行 */
function contentLine(delta: string): string {
  return line({
    choices: [{ delta: { content: delta }, finish_reason: null }],
  });
}

/** 思考增量行 */
function reasoningLine(delta: string): string {
  return line({
    choices: [{ delta: { reasoning_content: delta }, finish_reason: null }],
  });
}

/** 把预录内容拆成逐小段下发的 SSE 响应 */
export function createMockSseResponse(): Response {
  const encoder = new TextEncoder();
  const segments: Array<{ kind: 'content' | 'reasoning'; text: string }> = [
    { kind: 'reasoning', text: CANNED_THINKING },
    { kind: 'content', text: CANNED_REPLY },
  ];
  // 流被取消后必须停止下发，否则后续 enqueue 会抛错
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (chunk: string) => {
        if (cancelled) return;
        controller.enqueue(encoder.encode(chunk));
      };
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      push(line({ choices: [{ delta: { role: 'assistant' } }] }));
      await sleep(40);

      for (const segment of segments) {
        // 按小段下发，让流式渲染与「实时同步到编辑器」可被观察到
        for (let i = 0; i < segment.text.length; i += 12) {
          if (cancelled) return;
          const delta = segment.text.slice(i, i + 12);
          push(
            segment.kind === 'content'
              ? contentLine(delta)
              : reasoningLine(delta),
          );
          await sleep(24);
        }
      }

      if (cancelled) return;
      push(line({ choices: [{ delta: {}, finish_reason: 'stop' }] }));
      push('data: [DONE]\n');
      controller.close();
    },
    // 用户中止（chat.stop）或提前收到 [DONE] 时终止回放，
    // 否则循环会继续 enqueue 到已取消的流并抛出 TypeError
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
    status: 200,
  });
}

/** 仅拦截演示端点，其余请求原样透传；返回还原函数 */
export function installFetchMock(): () => void {
  const original = window.fetch;

  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes(MOCK_ENDPOINT) && init?.method === 'POST') {
      return Promise.resolve(createMockSseResponse());
    }
    return original(input, init);
  };

  return () => {
    window.fetch = original;
  };
}
