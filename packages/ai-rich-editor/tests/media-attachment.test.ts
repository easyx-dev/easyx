/**
 * 对话附件与清单文本测试：附件模型、清单拼装/剥离的往返一致性
 */
import { describe, expect, it } from '@rstest/core';
import { splitPromptBlocks } from '../src/chat/prompt-blocks';
import {
  createFileAttachment,
  createLibraryAttachment,
  parseSentAttachments,
  planFileAttachments,
  toSentAttachment,
} from '../src/media/attachment';
import { MediaNotConfiguredError } from '../src/media/errors';
import {
  ATTACHMENT_BLOCK_TITLE,
  buildAttachmentBlock,
} from '../src/media/prompt-text';
import type { AiRichMediaConfig } from '../src/media/types';

function fakeFile(name: string, type: string, size = 8): File {
  return { name, type, size } as File;
}

describe('附件模型', () => {
  it('本地文件按 MIME 定类型且未就绪', () => {
    const attachment = createFileAttachment(fakeFile('a.png', 'image/png', 16));
    expect(attachment.kind).toBe('image');
    expect(attachment.name).toBe('a.png');
    expect(attachment.size).toBe(16);
    expect(toSentAttachment(attachment)).toBeUndefined();
  });

  it('媒体库条目已具备地址，直接就绪', () => {
    const attachment = createLibraryAttachment(
      { id: '9', url: '/m/a.mp4', name: 'a.mp4', size: 100 },
      'video',
    );
    expect(toSentAttachment(attachment)).toEqual({
      kind: 'video',
      name: 'a.mp4',
      url: '/m/a.mp4',
      size: 100,
    });
  });

  it('附件 id 不重复', () => {
    const ids = new Set(
      Array.from(
        { length: 5 },
        () => createFileAttachment(fakeFile('a.png', 'image/png')).id,
      ),
    );
    expect(ids.size).toBe(5);
  });
});

describe('planFileAttachments', () => {
  const media: AiRichMediaConfig = {
    image: {
      upload: async (file) => ({ id: '1', url: '/a.png', name: file.name }),
    },
  };

  it('未配置对应类型时不接纳并给出可识别的错误实例', () => {
    const plan = planFileAttachments(
      [fakeFile('a.mp4', 'video/mp4')],
      media,
      [],
      6,
    );
    expect(plan.accepted).toEqual([]);
    expect(plan.errors).toHaveLength(1);
    expect(plan.errors[0]).toBeInstanceOf(MediaNotConfiguredError);
    expect((plan.errors[0] as MediaNotConfiguredError).kind).toBe('video');
    expect(plan.errors[0].message).toBe('未配置视频上传接口');
    expect(plan.warnings).toEqual([]);
  });

  it('部分可接纳时只过滤掉未配置的文件', () => {
    const plan = planFileAttachments(
      [fakeFile('a.png', 'image/png'), fakeFile('b.mov', 'video/quicktime')],
      media,
      [],
      6,
    );
    expect(plan.accepted.map((item) => item.name)).toEqual(['a.png']);
    expect(plan.errors).toHaveLength(1);
  });

  it('超出数量上限时截断并提醒', () => {
    const current = [
      createFileAttachment(fakeFile('x.png', 'image/png')),
      createFileAttachment(fakeFile('y.png', 'image/png')),
    ];
    const plan = planFileAttachments(
      [fakeFile('a.png', 'image/png'), fakeFile('b.png', 'image/png')],
      media,
      current,
      3,
    );
    expect(plan.accepted).toHaveLength(1);
    expect(plan.warnings).toEqual(['一次最多添加 3 个附件']);
  });

  it('容量已满时不接纳任何文件', () => {
    const current = [createFileAttachment(fakeFile('x.png', 'image/png'))];
    const plan = planFileAttachments(
      [fakeFile('a.png', 'image/png')],
      media,
      current,
      1,
    );
    expect(plan.accepted).toEqual([]);
    expect(plan.warnings).toHaveLength(1);
  });
});

describe('parseSentAttachments', () => {
  it('取出合法条目并丢弃未知类型', () => {
    const items = parseSentAttachments([
      { kind: 'image', name: 'a.png', url: '/a.png', size: 8 },
      { kind: '未知', name: 'b.png', url: '/b.png' },
      { kind: 'video', name: 'c.mp4', url: '' },
      { kind: 'audio', name: 'd.mp3', url: '/d.mp3', size: '8' },
      null,
      'x',
    ]);
    expect(items).toEqual([
      { kind: 'image', name: 'a.png', url: '/a.png', size: 8 },
      { kind: 'audio', name: 'd.mp3', url: '/d.mp3', size: undefined },
    ]);
  });

  it('非数组输入返回空数组', () => {
    expect(parseSentAttachments(undefined)).toEqual([]);
    expect(parseSentAttachments({ kind: 'image' })).toEqual([]);
  });
});

describe('buildAttachmentBlock', () => {
  it('无附件时为空串', () => {
    expect(buildAttachmentBlock([])).toBe('');
  });

  it('按序号列出类型、文件名与地址', () => {
    expect(
      buildAttachmentBlock([
        { kind: 'image', name: 'a.png', url: 'https://cdn.test/a.png' },
        { kind: 'attachment', name: 'b.pdf', url: '/b.pdf' },
      ]),
    ).toBe(
      [
        ATTACHMENT_BLOCK_TITLE,
        '1. 图片：a.png → https://cdn.test/a.png',
        '2. 附件：b.pdf → /b.pdf',
      ].join('\n'),
    );
  });
});

describe('splitPromptBlocks（附件块还原）', () => {
  it('还原用户原话并去掉尾部空行', () => {
    const text = `把这张图插到标题下方\n\n${buildAttachmentBlock([
      { kind: 'image', name: 'a.png', url: '/a.png' },
    ])}`;
    expect(splitPromptBlocks(text).text).toBe('把这张图插到标题下方');
  });

  it('仅附件（无原话）时原话为空串', () => {
    expect(
      splitPromptBlocks(
        buildAttachmentBlock([{ kind: 'image', name: 'a.png', url: '/a.png' }]),
      ).text,
    ).toBe('');
  });

  it('没有标记时原样返回', () => {
    expect(splitPromptBlocks('普通消息').text).toBe('普通消息');
  });
});
