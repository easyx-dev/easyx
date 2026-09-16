/**
 * 无损优化策略表：描述各格式能否真正无损地重编码
 *
 * 引擎层消费本表决定编码参数，UI 层消费本表决定是否展示「无损优化」入口
 */
import { isOutputFormat } from './limits';
import type { ImageFormat } from './types';

/** 无损保真等级：exact 逐像素一致 / near 视觉无损但非逐像素 / unsupported 不支持 */
export type LosslessFidelity = 'exact' | 'near' | 'unsupported';

export interface LosslessStrategy {
  fidelity: LosslessFidelity;
  /** 面向 UI 与文档的策略说明 */
  label: string;
}

export const LOSSLESS_STRATEGIES: Record<ImageFormat, LosslessStrategy> = {
  png: {
    fidelity: 'exact',
    label: 'PNG 无损重压缩（最高压缩级别 + 剥离元数据）',
  },
  webp: { fidelity: 'exact', label: 'WebP 无损编码（method 6）' },
  tiff: { fidelity: 'exact', label: 'TIFF 无损重压缩（LZW）' },
  // 实测：JPEG 在质量 100 下重编码仍有约 24% 的像素字节差异，视觉不可分辨但非逐像素无损
  // （ImageMagick 未暴露 jpegtran 式系数透传能力）
  jpeg: {
    fidelity: 'near',
    label: 'JPEG 重编码（质量 100，视觉无损但不逐像素一致）',
  },
  gif: { fidelity: 'unsupported', label: 'GIF 不支持无损优化（动图会被压平）' },
  bmp: { fidelity: 'unsupported', label: 'BMP 不支持无损优化' },
  // 实测：本 wasm 构建下 AVIF 编码产物非法、解码亦不可用
  avif: { fidelity: 'unsupported', label: 'AVIF 在本引擎下不可用' },
  heic: { fidelity: 'unsupported', label: 'HEIC 在本引擎下不可用' },
  svg: { fidelity: 'unsupported', label: 'SVG 不参与图片处理' },
};

/** 取格式对应的无损优化策略 */
export function getLosslessStrategy(format: ImageFormat): LosslessStrategy {
  return LOSSLESS_STRATEGIES[format];
}

/**
 * 是否可做无损优化
 *
 * 必须同时满足：保真等级可用（near 亦视为可用）且该格式可被编码输出 ——
 * 例如 TIFF 虽然能无损重压缩，但本引擎不把它作为输出格式（`OUTPUT_FORMATS` 不含 tiff），
 * 只判断 fidelity 会让界面标出「可无损优化」而引擎实际返回 null。
 */
export function isOptimizableLosslessly(format: ImageFormat): boolean {
  return (
    LOSSLESS_STRATEGIES[format].fidelity !== 'unsupported' &&
    isOutputFormat(format)
  );
}
