import "server-only";
import { put, del } from "@vercel/blob";
import { mkdir, writeFile, unlink, realpath } from "node:fs/promises";
import path from "node:path";

function localPath(key: string): string {
  const root = path.resolve(process.cwd(), "public/uploads");
  const target = path.resolve(root, key);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || key.includes("\\") || key.includes(":")) {
    throw new Error("Ruta de imagen no válida.");
  }
  return target;
}

export async function savePublicImage(key: string, data: Buffer, contentType: "image/webp"): Promise<string> {
  const target = localPath(key);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, data, { access: "public", addRandomSuffix: true, contentType });
    return blob.url;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_UPLOADS !== "1") {
    throw new Error("Configura BLOB_READ_WRITE_TOKEN para subir fotos en producción (o ALLOW_LOCAL_UPLOADS=1 para pruebas locales).");
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data, { flag: "wx" });
  return `/uploads/${key}`;
}

export async function deletePublicImage(url: string): Promise<void> {
  try {
    if (url.startsWith("/uploads/")) {
      const target = localPath(url.slice("/uploads/".length));
      // Comprueba también enlaces simbólicos antes de borrar en disco.
      const root = await realpath(path.resolve(process.cwd(), "public/uploads"));
      const relative = path.relative(root, await realpath(target));
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return;
      await unlink(target);
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      await del(url);
    }
  } catch (error) {
    console.error("No se pudo borrar la imagen anterior.", error);
  }
}
