export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 2400;
export const JPEG_QUALITY = 0.88;
/** Segunda pasada si la foto, ya reducida, aún pesa demasiado (mucho detalle). */
export const FALLBACK_JPEG_QUALITY = 0.7;

const MAX_FALLBACK_BYTES = 4 * 1024 * 1024;
const TOO_LARGE = "La foto pesa más de 25 MB.";
const PREPARATION_FAILED = "No se pudo preparar la foto. Prueba con otra en JPG o PNG.";

/** Error con un mensaje apto para mostrar a la persona. */
export class ShrinkImageError extends Error {}

export function isShrinkImageError(error: unknown): error is ShrinkImageError {
  return error instanceof ShrinkImageError;
}

function encodeJpeg(canvas: OffscreenCanvas | HTMLCanvasElement, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new ShrinkImageError(PREPARATION_FAILED)), "image/jpeg", quality);
  });
}

export async function shrinkImage(file: File): Promise<File> {
  if (file.size > MAX_ORIGINAL_BYTES) throw new ShrinkImageError(TOO_LARGE);

  let bitmap: ImageBitmap | undefined;
  try {
    // Vercel limita el cuerpo a 4,5 MB: reducimos antes de enviar la foto.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new ShrinkImageError(PREPARATION_FAILED);
    // JPEG no admite transparencia: conservamos un fondo blanco.
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    let blob = await encodeJpeg(canvas, JPEG_QUALITY);
    if (blob.size > MAX_FALLBACK_BYTES) blob = await encodeJpeg(canvas, FALLBACK_JPEG_QUALITY);
    if (blob.size > MAX_FALLBACK_BYTES) throw new ShrinkImageError(PREPARATION_FAILED);
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    // Dejamos margen para FormData bajo el límite de Vercel.
    if (file.size <= MAX_FALLBACK_BYTES) return file;
    throw new ShrinkImageError(PREPARATION_FAILED);
  } finally {
    bitmap?.close();
  }
}
