/**
 * 媒体类型路由测试：MIME 分流、accept 生成、媒体库条目类型推断与尺寸格式化
 */
import { describe, expect, it } from '@rstest/core';
import {
  formatBytes,
  mediaAccept,
  mediaKindLabel,
  resolveItemKind,
  resolveMediaKind,
} from '../src/media/routing';
import type { MediaConfig, MediaItem } from '../src/media/types';

describe('resolveMediaKind', () => {
  it('图片/视频/音频按 MIME 前缀分流', () => {
    expect(resolveMediaKind('image/png')).toBe('image');
    expect(resolveMediaKind('video/mp4')).toBe('video');
    expect(resolveMediaKind('audio/mpeg')).toBe('audio');
  });

  it('其余类型兜底为附件', () => {
    expect(resolveMediaKind('application/pdf')).toBe('attachment');
    expect(resolveMediaKind('')).toBe('attachment');
  });

  it('大小写不敏感', () => {
    expect(resolveMediaKind('IMAGE/PNG')).toBe('image');
  });
});

describe('mediaAccept', () => {
  const config: MediaConfig = {
    image: { upload: async () => ({ id: '1', url: '/a.png', name: 'a.png' }) },
  };

  it('只列出已配置上传的类型', () => {
    expect(mediaAccept(config)).toBe('image/*');
  });

  it('未配置任何上传时为空串', () => {
    expect(mediaAccept(undefined)).toBe('');
    expect(mediaAccept({})).toBe('');
  });
});

describe('resolveItemKind', () => {
  function item(partial: Partial<MediaItem>): MediaItem {
    return { id: '1', url: '/x', name: 'x', ...partial };
  }

  it('优先使用 fileType', () => {
    expect(resolveItemKind(item({ fileType: 'video/mp4' }))).toBe('video');
  });

  it('无 fileType 时按扩展名推断', () => {
    expect(resolveItemKind(item({ name: 'photo.JPG' }))).toBe('image');
    expect(resolveItemKind(item({ name: 'clip.webm' }))).toBe('video');
    expect(resolveItemKind(item({ name: 'song.mp3' }))).toBe('audio');
  });

  it('名称无扩展名时按地址推断', () => {
    expect(resolveItemKind(item({ name: '资源', url: '/m/a.png' }))).toBe(
      'image',
    );
  });

  it('带查询串或锚点的地址仍能识别（CDN 常见形态）', () => {
    expect(
      resolveItemKind(item({ name: '', url: 'https://c.test/a.png?w=300' })),
    ).toBe('image');
    expect(resolveItemKind(item({ name: '', url: '/m/a.mp4#t=10' }))).toBe(
      'video',
    );
  });

  it('无法识别时兜底为附件', () => {
    expect(resolveItemKind(item({ name: 'report' }))).toBe('attachment');
  });
});

describe('formatBytes / mediaKindLabel', () => {
  it('按量级给出可读尺寸', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('媒体类型有中文名', () => {
    expect(mediaKindLabel('image')).toBe('图片');
    expect(mediaKindLabel('attachment')).toBe('附件');
  });
});
