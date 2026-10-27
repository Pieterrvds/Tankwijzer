/**
 * Client-side photo processing: downscale to max ~2000 px and re-encode as JPEG (~0.8).
 * A 12 MP phone photo goes from ~4 MB to ~400 kB, which keeps IndexedDB and the export small.
 *
 * Re-encoding through a canvas drops the EXIF block, so we read the original capture time
 * (DateTimeOriginal) first and store it next to the photo.
 */
export const MAX_PHOTO_SIZE_PX = 2000;
export const JPEG_QUALITY = 0.8;

export interface ProcessedPhoto {
  blob: Blob;
  width: number;
  height: number;
  takenAt: string | null;
}

/** Fit (width, height) inside a square of `max` px, keeping the aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIZE_PX) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function readTakenAt(file: File): Promise<string | null> {
  try {
    // Loaded on demand: only needed when a photo is taken.
    const { default: exifr } = await import('exifr');
    const exif = (await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])) as
      { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
    const date = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toISOString();
  } catch {
    // No or unreadable EXIF (e.g. screenshots): fall back to the file time below.
  }
  return file.lastModified ? new Date(file.lastModified).toISOString() : null;
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const takenAt = await readTakenAt(file);
  // 'from-image' applies the EXIF orientation, so portrait photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas niet beschikbaar');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Foto kon niet verwerkt worden'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );
  return { blob, width, height, takenAt };
}
