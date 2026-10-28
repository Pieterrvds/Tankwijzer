/**
 * Prepares a file for upload: photos are shrunk in the browser (long side max. 2000 px, JPEG),
 * because phone photos are often 5–10 MB and the server (Netlify) accepts about 4 MB per upload.
 * PDFs are sent as they are; a clear message explains when one is too large.
 */
let uploadLimitBytes = 15 * 1024 * 1024;

export function setUploadLimit(bytes: number | undefined): void {
  if (bytes) uploadLimitBytes = bytes;
}

const MAX_SIDE = 2000;

async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // Formats the browser cannot decode (e.g. some HEIC photos) are sent unchanged.
    return file;
  }
}

/** Builds the multipart form for an upload, or throws a Dutch message when the file is too large. */
export async function uploadForm(file: File, fields: Record<string, string> = {}): Promise<FormData> {
  const prepared = file.type.startsWith("image/") ? await shrinkImage(file) : file;
  if (prepared.size > uploadLimitBytes) {
    const mb = Math.floor(uploadLimitBytes / 1024 / 1024);
    throw new Error(
      prepared.type === "application/pdf"
        ? `Dit PDF-bestand is te groot (max. ${mb} MB). Verklein het of scan het opnieuw met een lagere resolutie.`
        : `Dit bestand is te groot (max. ${mb} MB).`,
    );
  }
  const form = new FormData();
  form.set("file", prepared);
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}
