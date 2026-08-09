/** 手机拍照常见超大图，上传前压缩到可接受体积，避免 Nginx 413 / 后端 10MB 限制 */

const DEFAULT_MAX_EDGE = 1920;
const DEFAULT_MAX_BYTES = 2.5 * 1024 * 1024;
const DEFAULT_QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * 压缩图片：超过阈值时缩小长边并转 JPEG。
 * 视频 / 非图片 / 已足够小 / HEIC 等浏览器无法解码时原样返回。
 */
export async function compressImageForUpload(
  file: File,
  opts?: { maxEdge?: number; maxBytes?: number; quality?: number },
): Promise<File> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name || '')) {
    return file;
  }
  // gif 动图不压；heic/heif 多数浏览器画布解不了，交给后端
  if (/gif|heic|heif/i.test(file.type) || /\.(gif|heic|heif)$/i.test(file.name || '')) {
    return file;
  }

  const maxEdge = opts?.maxEdge ?? DEFAULT_MAX_EDGE;
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const quality = opts?.quality ?? DEFAULT_QUALITY;

  if (file.size <= maxBytes) {
    return file;
  }

  try {
    const img = await loadImage(file);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return file;

    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, tw, th);

    let q = quality;
    let blob = await canvasToBlob(canvas, 'image/jpeg', q);
    // 仍偏大则再降质量
    while (blob && blob.size > maxBytes && q > 0.5) {
      q -= 0.1;
      blob = await canvasToBlob(canvas, 'image/jpeg', q);
    }
    if (!blob) return file;

    const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
