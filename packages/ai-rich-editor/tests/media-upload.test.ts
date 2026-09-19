/**
 * 媒体上传测试：未配置报错、进度透传、上传结果与异常归一
 */
import { describe, expect, it, rs } from '@rstest/core';
import { MediaNotConfiguredError, toError } from '../src/media/errors';
import type { MediaConfig, MediaItem } from '../src/media/types';
import {
  canUpload,
  hasMediaLibrary,
  uploadMediaFile,
} from '../src/media/upload';

/** 造一个最小 File（node 环境无 File 构造时用 Blob 语义的替身） */
function fakeFile(name: string, type: string, size = 8): File {
  return { name, type, size } as File;
}

const uploaded: MediaItem = {
  id: '1',
  url: 'https://cdn.test/a.png',
  name: 'a.png',
  size: 8,
};

describe('uploadMediaFile', () => {
  it('未配置对应类型时抛 MediaNotConfiguredError（提示带中文类型名）', async () => {
    await expect(
      uploadMediaFile(undefined, 'image', fakeFile('a.png', 'image/png')),
    ).rejects.toThrow('未配置图片上传接口');
  });

  it('未配置对应类型时错误类可被识别', async () => {
    const error = await uploadMediaFile(
      {},
      'video',
      fakeFile('a.mp4', 'video/mp4'),
    )
      .then(() => undefined)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MediaNotConfiguredError);
    expect((error as MediaNotConfiguredError).kind).toBe('video');
  });

  it('透传文件与进度回调，返回上传结果', async () => {
    const upload = rs.fn(
      async (file: File, onProgress?: (p: number) => void) => {
        onProgress?.(1);
        return { ...uploaded, name: file.name };
      },
    );
    const config: MediaConfig = { image: { upload } };
    const onProgress = rs.fn();
    const result = await uploadMediaFile(
      config,
      'image',
      fakeFile('a.png', 'image/png'),
      onProgress,
    );
    expect(result.name).toBe('a.png');
    expect(onProgress).toHaveBeenCalledWith(1);
  });
});

describe('能力判定', () => {
  it('canUpload 只看对应类型', () => {
    const config: MediaConfig = {
      image: { upload: async () => uploaded },
    };
    expect(canUpload(config, 'image')).toBe(true);
    expect(canUpload(config, 'video')).toBe(false);
  });

  it('hasMediaLibrary 只认媒体库能力', () => {
    const libraryOnly: MediaConfig = {
      image: {
        upload: async () => uploaded,
        getList: async () => ({ items: [], total: 0 }),
      },
    };
    expect(hasMediaLibrary(undefined)).toBe(false);
    expect(hasMediaLibrary({})).toBe(false);
    expect(hasMediaLibrary(libraryOnly)).toBe(true);
    expect(hasMediaLibrary({ image: { upload: async () => uploaded } })).toBe(
      false,
    );
  });
});

describe('toError', () => {
  it('Error 原样返回', () => {
    const error = new MediaNotConfiguredError('audio');
    expect(toError(error)).toBe(error);
  });

  it('非 Error 抛出物包成 Error', () => {
    expect(toError('网络错误').message).toBe('网络错误');
    expect(toError('').message).toBe('操作失败，请重试');
    expect(toError(undefined).message).toBe('操作失败，请重试');
  });
});
