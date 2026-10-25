// Ảnh do ba mẹ chọn: thu nhỏ, vẽ lại bằng canvas (thao tác này loại EXIF/GPS),
// giữ nền trong suốt nếu ảnh có alpha (03 §7.2, F-03 tiêu chí 1 và 2).

export const MAX_IMAGE_EDGE = 1200
export const JPEG_QUALITY = 0.85

export interface ProcessedImage {
  blob: Blob
  mime: 'image/png' | 'image/jpeg'
  width: number
  height: number
  hasAlpha: boolean
}

export function fitSize(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** True khi có ít nhất một điểm ảnh không đục hoàn toàn. */
export function hasAlphaPixels(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) return true
  }
  return false
}

export async function processImageFile(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Không dựng được canvas 2d')
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    const hasAlpha = hasAlphaPixels(ctx.getImageData(0, 0, width, height).data)
    const mime: 'image/png' | 'image/jpeg' = hasAlpha ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Không mã hóa được ảnh'))),
        mime,
        JPEG_QUALITY,
      )
    })
    return { blob, mime, width, height, hasAlpha }
  } finally {
    bitmap.close()
  }
}
