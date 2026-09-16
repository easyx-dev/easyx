/**
 * 引擎操作实现（在 Worker 内执行）
 *
 * 实测约束（P0 spike）：
 * - write 回调拿到的 Uint8Array 是 wasm 堆上的视图，**必须在回调内部复制**：
 *   magick-wasm 在回调返回后立即释放 blob，写成 `Uint8Array.from(image.write(...))`
 *   会在释放之后复制，静默产出损坏文件（use-after-free）
 * - MagickGeometry 的 greater / fillArea / ignoreAspectRatio 标志均生效，可直接表达四种 fit
 * - rotate 为顺时针；autoOrient 在无 EXIF 时为空操作
 */
import {
  CompressionMethod,
  DitherMethod,
  Gravity,
  type IMagickImage,
  ImageMagick,
  MagickColor,
  MagickFormat,
  MagickGeometry,
  QuantizeSettings,
} from '@imagemagick/magick-wasm';
import { formatToMimeType, isOutputFormat } from '../../limits';
import { getLosslessStrategy } from '../../lossless';
import { intersectCrop } from '../../operation';
import { sniffImage } from '../../sniff';
import type {
  ImageFormat,
  ImageMeta,
  ImageOperation,
  ImageOutputFormat,
  ImageProcessResult,
  ImageResize,
} from '../../types';
import type { LosslessOptions } from './protocol';

/** 可编码输出格式 → MagickFormat */
const OUTPUT_MAGICK_FORMATS: Record<ImageOutputFormat, MagickFormat> = {
  jpeg: MagickFormat.Jpeg,
  png: MagickFormat.Png,
  webp: MagickFormat.WebP,
};

/** MagickFormat → 本包格式标识；不识别时返回 null */
function toImageFormat(magickFormat: string): ImageFormat | null {
  switch (magickFormat.toUpperCase()) {
    case 'JPEG':
    case 'PJPEG':
    case 'JPG':
      return 'jpeg';
    case 'PNG':
    case 'APNG':
      return 'png';
    case 'WEBP':
      return 'webp';
    case 'GIF':
      return 'gif';
    case 'TIFF':
      return 'tiff';
    case 'AVIF':
      return 'avif';
    case 'BMP':
      return 'bmp';
    case 'HEIC':
      return 'heic';
    case 'SVG':
      return 'svg';
    default:
      return null;
  }
}

function readMeta(image: IMagickImage): ImageMeta | null {
  const format = toImageFormat(image.format);
  if (!format) return null;
  return {
    width: image.width,
    height: image.height,
    format,
    hasAlpha: image.hasAlpha,
  };
}

/** 读取图片元数据；非图片或解码失败时返回 null */
export function probeImage(bytes: Uint8Array): ImageMeta | null {
  try {
    return ImageMagick.read(bytes, readMeta);
  } catch {
    return null;
  }
}

/** 解析补底色，非法颜色退回白色 */
function resolveBackground(background?: string): MagickColor {
  if (background) {
    try {
      return new MagickColor(background);
    } catch {
      // 非法颜色按白色处理
    }
  }
  return new MagickColor('#ffffff');
}

function applyResize(image: IMagickImage, resize: ImageResize): void {
  const width = resize.width ?? 0;
  const height = resize.height ?? 0;
  const fit = resize.fit ?? 'inside';

  if (fit === 'fill') {
    const geometry = new MagickGeometry(width, height);
    geometry.ignoreAspectRatio = true;
    image.resize(geometry);
    return;
  }

  if (fit === 'cover') {
    const geometry = new MagickGeometry(width, height);
    geometry.fillArea = true;
    image.resize(geometry);
    if (width > 0 && height > 0) image.extent(width, height, Gravity.Center);
    return;
  }

  // inside / contain 均只缩不放
  const geometry = new MagickGeometry(width, height);
  geometry.greater = true;
  image.resize(geometry);

  // contain 额外补底色到精确尺寸
  if (fit === 'contain' && width > 0 && height > 0) {
    image.extent(
      new MagickGeometry(width, height),
      Gravity.Center,
      resolveBackground(resize.background),
    );
  }
}

/**
 * 应用几何操作
 * 顺序固定：autoOrient 必须最先，保证裁切坐标基于视觉方向
 */
function applyOperation(image: IMagickImage, operation: ImageOperation): void {
  image.autoOrient();

  if (operation.crop) {
    // 裁切框来自前端交互，越界时与原图求交而非直接报错
    const { left, top, width, height } = intersectCrop(operation.crop, {
      width: image.width,
      height: image.height,
    });
    image.crop(new MagickGeometry(left, top, width, height));
  }

  if (operation.resize) applyResize(image, operation.resize);
  if (operation.rotate) image.rotate(operation.rotate);
  if (operation.flip) image.flip();
  if (operation.flop) image.flop();
  if (operation.strip) image.strip();
}

/**
 * 编码为字节
 *
 * 复制必须在 write 回调**内部**完成：magick-wasm 在回调返回后立即释放 blob，
 * 写成 `Uint8Array.from(image.write(...))` 会在释放之后复制，读到已释放内存（静默产出损坏文件）。
 * 末尾再嗅探一次产出，避免损坏数据流入存储。
 */
function encode(image: IMagickImage, format: ImageOutputFormat): Uint8Array {
  const data = image.write(OUTPUT_MAGICK_FORMATS[format], (out) =>
    Uint8Array.from(out),
  );
  const sniffed = sniffImage(data);
  if (sniffed?.format !== format) {
    throw new Error(
      `图片编码结果异常：期望 ${format}，实际 ${sniffed?.format ?? '无法识别'}`,
    );
  }
  return data;
}

/** 调色板量化（TinyPNG 式降色）：Riemersma 抖动以缓解渐变色带 */
function applyQuantize(image: IMagickImage, colors: number): void {
  const settings = new QuantizeSettings();
  settings.colors = colors;
  settings.ditherMethod = DitherMethod.Riemersma;
  image.quantize(settings);
}

/** 应用处理操作并编码输出；解码失败或目标格式不支持时抛出 */
export function transformImage(
  bytes: Uint8Array,
  operation: ImageOperation,
): ImageProcessResult {
  const sizeBefore = bytes.byteLength;

  return ImageMagick.read(bytes, (image) => {
    const sourceFormat = toImageFormat(image.format);
    applyOperation(image, operation);

    const outputFormat = operation.format ?? sourceFormat;
    if (!isOutputFormat(outputFormat)) {
      throw new TypeError(`不支持输出为该格式：${String(outputFormat)}`);
    }

    if (operation.quality !== undefined) image.quality = operation.quality;
    if (outputFormat === 'png') {
      // PNG 编码始终无损，一律用最高压缩级别（只影响耗时，不影响画质）
      image.settings.setDefine('png:compression-level', '9');
      if (operation.colors !== undefined)
        applyQuantize(image, operation.colors);
    }

    const data = encode(image, outputFormat);
    const meta = readMeta(image);
    if (!meta) throw new TypeError('无法读取处理后的图片元数据');

    return {
      data,
      mimeType: formatToMimeType(outputFormat),
      meta: { ...meta, format: outputFormat },
      sizeBefore,
      sizeAfter: data.byteLength,
    };
  });
}

/** 各格式的无损编码参数（均经 P0 spike 实测） */
function applyLosslessEncoding(image: IMagickImage, format: ImageFormat): void {
  switch (format) {
    case 'png':
      image.settings.setDefine('png:compression-level', '9');
      break;
    case 'webp':
      image.settings.setDefine('webp:lossless', 'true');
      image.settings.setDefine('webp:method', '6');
      break;
    case 'tiff':
      image.settings.compression = CompressionMethod.LZW;
      break;
    case 'jpeg':
      // JPEG 无系数透传能力，只能质量 100 重编码（视觉无损）
      image.quality = 100;
      image.settings.setDefine('jpeg:optimize-coding', 'true');
      break;
    default:
      break;
  }
}

/** 无损优化参数契约见 ./protocol */
export type { LosslessOptions };

/**
 * 无损优化：可选裁切 + 无损重编码，可转 WebP
 *
 * 返回 null 表示格式不支持无损优化，调用方应保留原图。
 * 不做「只留更小结果」的判断 —— 增减交由调用方在预览中如实展示，用户自行决定是否保存。
 */
export function optimizeLosslessly(
  bytes: Uint8Array,
  options: LosslessOptions,
): ImageProcessResult | null {
  const sizeBefore = bytes.byteLength;

  return ImageMagick.read(bytes, (image) => {
    const sourceFormat = toImageFormat(image.format);
    if (!sourceFormat) return null;

    const explicitTarget = options.format !== undefined;
    const outputFormat = options.format ?? sourceFormat;
    if (!isOutputFormat(outputFormat)) return null;

    const fidelity = getLosslessStrategy(outputFormat).fidelity;
    if (fidelity === 'unsupported') return null;
    // 同一格式下允许「近无损」（如 JPEG 质量 100 重编码）；转格式则必须逐像素无损
    if (explicitTarget && fidelity !== 'exact') return null;

    if (options.crop) {
      const { left, top, width, height } = intersectCrop(options.crop, {
        width: image.width,
        height: image.height,
      });
      image.crop(new MagickGeometry(left, top, width, height));
    }

    applyLosslessEncoding(image, outputFormat);
    if (options.strip) image.strip();

    const data = encode(image, outputFormat);
    const meta = readMeta(image);
    return {
      data,
      mimeType: formatToMimeType(outputFormat),
      meta: {
        width: meta?.width ?? image.width,
        height: meta?.height ?? image.height,
        hasAlpha: image.hasAlpha,
        format: outputFormat,
      },
      sizeBefore,
      sizeAfter: data.byteLength,
    };
  });
}
