/**
 * 演示源图：全部由 canvas 现场生成，覆盖不同特性以演示各条处理路径
 *
 * 站点是纯静态的（无服务端），故造出「照片 / 透明底 / 扁平插画 / 有损小图」四类源，
 * 便于对比无损优化、调色板降色与有损编码的差异。
 */

export interface DemoSource {
  key: string;
  label: string;
  /** 一句话说明这张图适合演示什么 */
  note: string;
  width: number;
  height: number;
  mimeType: 'image/png' | 'image/jpeg';
  /** 仅 JPEG 使用 */
  quality?: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

/** canvas 原生 roundRect 在旧浏览器缺失，这里用 arcTo 兜底 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export const DEMO_SOURCES: DemoSource[] = [
  {
    key: 'photo',
    label: '照片感渐变',
    note: '连续渐变与光斑，适合演示有损压缩与缩放',
    width: 1600,
    height: 1000,
    mimeType: 'image/png',
    draw: (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#7c3aed');
      gradient.addColorStop(0.5, '#2563eb');
      gradient.addColorStop(1, '#06b6d4');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 28; i += 1) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + (i % 5) * 0.035})`;
        ctx.arc(
          (i * 137) % width,
          (i * 233) % height,
          40 + ((i * 31) % 120),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.font = 'bold 96px sans-serif';
      ctx.fillText('EasyX', 120, height * 0.56);
      ctx.font = '36px sans-serif';
      ctx.fillText('photo-like gradient', 124, height * 0.64);
    },
  },
  {
    key: 'alpha',
    label: '透明底 PNG',
    note: '带透明通道，适合演示透明保留与调色板降色',
    width: 1200,
    height: 1200,
    mimeType: 'image/png',
    draw: (ctx, width, height) => {
      roundedRect(
        ctx,
        width * 0.14,
        height * 0.14,
        width * 0.72,
        height * 0.72,
        90,
      );
      ctx.fillStyle = '#7c3aed';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.4, width * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 84px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PNG', width * 0.5, height * 0.68);
      ctx.textAlign = 'start';
    },
  },
  {
    key: 'flat',
    label: '扁平插画',
    note: '纯色块与几何形状，降色到 256 色几乎无感',
    width: 1600,
    height: 900,
    mimeType: 'image/png',
    draw: (ctx, width, height) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      roundedRect(ctx, 120, 120, 520, 300, 32);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      roundedRect(ctx, 420, 300, 640, 420, 32);
      ctx.fillStyle = '#f472b6';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(1280, 300, 150, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(1100, 780);
      ctx.lineTo(1300, 460);
      ctx.lineTo(1500, 780);
      ctx.closePath();
      ctx.fillStyle = '#34d399';
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText('flat illustration', 160, 760);
    },
  },
  {
    key: 'jpeg',
    label: '有损小图',
    note: '小尺寸 JPEG 源，适合演示无损优化（近无损）',
    width: 512,
    height: 512,
    mimeType: 'image/jpeg',
    quality: 0.82,
    draw: (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#f59e0b');
      gradient.addColorStop(1, '#ea580c');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.38, width * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width * 0.14, height * 0.86);
      ctx.lineTo(width * 0.42, height * 0.52);
      ctx.lineTo(width * 0.64, height * 0.74);
      ctx.lineTo(width * 0.78, height * 0.6);
      ctx.lineTo(width * 0.9, height * 0.86);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
    },
  },
];

/** 按定义现场绘制并导出 Blob */
export async function renderSource(source: DemoSource): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 canvas');

  ctx.clearRect(0, 0, source.width, source.height);
  source.draw(ctx, source.width, source.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, source.mimeType, source.quality);
  });
  if (!blob) throw new Error('生成源图失败');
  return blob;
}
