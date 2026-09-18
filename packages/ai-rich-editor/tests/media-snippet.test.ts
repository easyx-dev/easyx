/**
 * 媒体片段生成测试：四种类型的外观、属性转义与地址白名单
 */
import { describe, expect, it } from '@rstest/core';
import { buildMediaSnippet } from '../src/media/snippet';

describe('buildMediaSnippet', () => {
  it('图片：语义标签 + 内联自适应样式', () => {
    expect(
      buildMediaSnippet({
        kind: 'image',
        url: 'https://cdn.test/a.png',
        name: '封面图',
      }),
    ).toBe(
      '<img src="https://cdn.test/a.png" alt="封面图" style="max-width:100%;height:auto;">',
    );
  });

  it('视频：控制器与内联播放，带文件名时补 title', () => {
    expect(
      buildMediaSnippet({
        kind: 'video',
        url: 'https://cdn.test/a.mp4',
        name: 'demo.mp4',
      }),
    ).toBe(
      '<video src="https://cdn.test/a.mp4" title="demo.mp4" controls playsinline style="max-width:100%;"></video>',
    );
  });

  it('音频：控制器开关', () => {
    expect(
      buildMediaSnippet({ kind: 'audio', url: 'https://cdn.test/a.mp3' }),
    ).toBe('<audio src="https://cdn.test/a.mp3" controls></audio>');
  });

  it('附件：下载链接 + 可读尺寸', () => {
    const snippet = buildMediaSnippet({
      kind: 'attachment',
      url: 'https://cdn.test/a.pdf',
      name: '说明.pdf',
      size: 2048,
    });
    expect(snippet).toBe(
      '<a href="https://cdn.test/a.pdf" download="说明.pdf">说明.pdf（2.0 KB）</a>',
    );
  });

  it('无文件名的附件用占位文案与空 download', () => {
    const snippet = buildMediaSnippet({
      kind: 'attachment',
      url: 'https://cdn.test/a.bin',
    });
    expect(snippet).toBe('<a href="https://cdn.test/a.bin" download>附件</a>');
  });

  it('转义文件名里的引号与尖括号，避免截断标签', () => {
    const snippet = buildMediaSnippet({
      kind: 'image',
      url: 'https://cdn.test/a.png',
      name: 'a"b<c>.png',
    });
    expect(snippet).toBe(
      '<img src="https://cdn.test/a.png" alt="a&quot;b&lt;c&gt;.png" style="max-width:100%;height:auto;">',
    );
  });

  it('地址未通过协议白名单时返回 undefined', () => {
    expect(
      buildMediaSnippet({ kind: 'image', url: 'javascript:alert(1)' }),
    ).toBeUndefined();
    expect(
      buildMediaSnippet({ kind: 'image', url: 'data:text/html,<script>' }),
    ).toBeUndefined();
  });

  it('放行同源 Blob 地址（纯客户端上传与本地演示依赖它）', () => {
    expect(
      buildMediaSnippet({ kind: 'image', url: 'blob:https://a.test/1f2e-3d' }),
    ).toBe(
      '<img src="blob:https://a.test/1f2e-3d" alt="" style="max-width:100%;height:auto;">',
    );
  });

  it('相对地址与锚点放行', () => {
    expect(buildMediaSnippet({ kind: 'image', url: '/uploads/a.png' })).toBe(
      '<img src="/uploads/a.png" alt="" style="max-width:100%;height:auto;">',
    );
  });
});
