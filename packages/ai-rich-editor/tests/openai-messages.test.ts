/**
 * 会话消息 → OpenAI 消息转换测试
 *
 * 关注协议差异点：system 前置、思考不回传、附件清单留文本、
 * 图片仅在「绝对 http(s) + 开启多模态 + 图片类型」三者同时成立时升级为 content parts。
 */
import { describe, expect, it } from '@rstest/core';
import type { UIMessage } from '@tanstack/ai-react';
import {
  buildOpenAiMessages,
  isRemoteHttpUrl,
} from '../src/chat/openai-messages';

const OPTIONS = { sendImagesAsMultimodal: true, systemPrompt: 'SYS' };

/** 造一条最小 UIMessage（parts 直接给出，绕开库的类型约束） */
function uiMessage(
  role: 'user' | 'assistant',
  parts: Array<Record<string, unknown>>,
  attachments?: unknown,
): UIMessage {
  return {
    id: `${role}-1`,
    role,
    parts,
    ...(attachments ? { metadata: { easyxAttachments: attachments } } : {}),
  } as unknown as UIMessage;
}

function imageAttachment(url: string, name = 'a.png') {
  return { kind: 'image', name, url };
}

describe('buildOpenAiMessages', () => {
  it('system 提示词置于首位，用户与助手文本按序转换', () => {
    const messages = buildOpenAiMessages(
      [
        uiMessage('user', [{ type: 'text', content: '生成一个卡片' }]),
        uiMessage('assistant', [{ type: 'text', content: '<div/>' }]),
      ],
      OPTIONS,
    );
    expect(messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: '生成一个卡片' },
      { role: 'assistant', content: '<div/>' },
    ]);
  });

  it('思考 part 不回传给模型', () => {
    const messages = buildOpenAiMessages(
      [
        uiMessage('assistant', [
          { type: 'thinking', content: '内部推理' },
          { type: 'text', content: '最终答复' },
        ]),
      ],
      OPTIONS,
    );
    expect(messages[1]).toEqual({ role: 'assistant', content: '最终答复' });
  });

  it('图片附件升级为多模态 content parts', () => {
    const messages = buildOpenAiMessages(
      [
        uiMessage(
          'user',
          [{ type: 'text', content: '用这张图' }],
          [imageAttachment('https://cdn.test/a.png')],
        ),
      ],
      OPTIONS,
    );
    expect(messages[1]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: '用这张图' },
        { type: 'image_url', image_url: { url: 'https://cdn.test/a.png' } },
      ],
    });
  });

  it('仅带图片（无文字）时也发送多模态内容', () => {
    const messages = buildOpenAiMessages(
      [uiMessage('user', [], [imageAttachment('https://cdn.test/a.png')])],
      OPTIONS,
    );
    expect(messages[1]).toEqual({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'https://cdn.test/a.png' } },
      ],
    });
  });

  it('blob: 与相对路径不进入多模态（服务端取不到）', () => {
    const messages = buildOpenAiMessages(
      [
        uiMessage(
          'user',
          [{ type: 'text', content: '看看' }],
          [
            imageAttachment('blob:http://localhost/a'),
            imageAttachment('/uploads/a.png'),
          ],
        ),
      ],
      OPTIONS,
    );
    expect(messages[1]).toEqual({ role: 'user', content: '看看' });
  });

  it('非图片类型附件不做多模态', () => {
    const messages = buildOpenAiMessages(
      [
        uiMessage(
          'user',
          [{ type: 'text', content: '看视频' }],
          [{ kind: 'video', name: 'a.mp4', url: 'https://cdn.test/a.mp4' }],
        ),
      ],
      OPTIONS,
    );
    expect(messages[1]).toEqual({ role: 'user', content: '看视频' });
  });

  it('助手消息不生成多模态内容块（协议不允许 assistant 带 image_url）', () => {
    const messages = buildOpenAiMessages(
      [
        uiMessage(
          'assistant',
          [{ type: 'text', content: '答复' }],
          [imageAttachment('https://cdn.test/a.png')],
        ),
      ],
      OPTIONS,
    );
    expect(messages[1]).toEqual({ role: 'assistant', content: '答复' });
  });

  it('关闭多模态后只保留文本（含清单）', () => {
    const messages = buildOpenAiMessages(
      [
        uiMessage(
          'user',
          [{ type: 'text', content: '用这张图\n[已上传附件]' }],
          [imageAttachment('https://cdn.test/a.png')],
        ),
      ],
      { ...OPTIONS, sendImagesAsMultimodal: false },
    );
    expect(messages[1]).toEqual({
      role: 'user',
      content: '用这张图\n[已上传附件]',
    });
  });

  it('空文本消息被跳过', () => {
    const messages = buildOpenAiMessages(
      [uiMessage('user', []), uiMessage('assistant', [])],
      OPTIONS,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: 'system', content: 'SYS' });
  });

  it('非法附件项被忽略（不因脏数据崩掉）', () => {
    const messages = buildOpenAiMessages(
      [uiMessage('user', [{ type: 'text', content: '你好' }], [{ kind: 'x' }])],
      OPTIONS,
    );
    expect(messages[1]).toEqual({ role: 'user', content: '你好' });
  });
});

describe('isRemoteHttpUrl', () => {
  it('只认绝对 http(s) 地址', () => {
    expect(isRemoteHttpUrl('https://cdn.test/a.png')).toBe(true);
    expect(isRemoteHttpUrl('http://cdn.test/a.png')).toBe(true);
    expect(isRemoteHttpUrl('blob:http://localhost/a')).toBe(false);
    expect(isRemoteHttpUrl('data:image/png;base64,xx')).toBe(false);
    expect(isRemoteHttpUrl('/uploads/a.png')).toBe(false);
    expect(isRemoteHttpUrl('not a url')).toBe(false);
  });
});
