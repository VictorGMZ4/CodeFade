import "server-only";
import sharp from "sharp";

export class ImageError extends Error {}

const dimensions = {
  logo: [512, 512],
  avatar: [512, 512],
  cover: [1600, 600],
  gallery: [1200, 1200],
} as const;

export async function processImage(file: File, kind: keyof typeof dimensions): Promise<Buffer> {
  if (!file.size) throw new ImageError("Selecciona una foto.");
  if (file.size > 8 * 1024 * 1024) throw new ImageError("La foto pesa más de 8 MB.");
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 });
    const { format } = await input.metadata();
    if (!format || !["jpeg", "png", "webp"].includes(format)) {
      throw new ImageError("Sube una foto JPG, PNG o WebP.");
    }
    const [width, height] = dimensions[kind];
    // rotate aplica EXIF; sharp elimina los metadatos de salida por defecto.
    return await input.rotate().resize(width, height, { fit: "cover", position: "centre" })
      .webp({ quality: 80 }).toBuffer();
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw new ImageError("No se pudo procesar la foto.");
  }
}
