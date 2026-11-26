/**
 * Getting a family photo from a parent's phone to the wall.
 *
 * The phone does all the work. It decodes the photo, turns it the right way up, and draws a few smaller copies
 * of it, each encoded afresh as a JPEG. Encoding afresh is what keeps the camera's details at home: a canvas
 * holds only pixels, so the copies carry no place, no time and no phone model — nothing of the original file but
 * the picture. The server then only has bytes to keep, and needs no image library of its own.
 */

/** The widest copy made, and the server's own limit. */
const MAX_WIDTH = 3840;
/** The narrowest copy the server keeps. */
const MIN_WIDTH = 160;
/** Larger than any phone photo; anything bigger is not one. */
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const QUALITY = 0.86;

/** The widths to make for an original this wide: the largest first, never wider than the original. */
export function ladderFor(width: number): number[] {
  const top = Math.min(Math.round(width), MAX_WIDTH);
  const widths = [top, 1920, 960].filter((one) => one <= top);
  return [...new Set(widths)].sort((a, b) => b - a);
}

export interface PreparedPhoto {
  /** The original's size, for its shape on the wall. */
  width: number;
  height: number;
  copies: { width: number; blob: Blob }[];
}

function canvasOf(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function encode(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('This phone could not shrink that photo.'))),
      'image/jpeg',
      QUALITY,
    );
  });
}

/** Make the copies of one photo, ready to send. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not a photo.');
  if (file.size > MAX_FILE_BYTES) throw new Error('That photo is too large. Choose one under 40 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This phone could not open that photo. Try another one.');
  }
  try {
    const { width, height } = bitmap;
    if (width < MIN_WIDTH) throw new Error('That photo is too small to show on the wall.');
    const copies: PreparedPhoto['copies'] = [];
    for (const copyWidth of ladderFor(width)) {
      const copyHeight = Math.max(1, Math.round((height * copyWidth) / width));
      const canvas = canvasOf(copyWidth, copyHeight);
      const context = canvas.getContext('2d') as
        OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
      if (!context) throw new Error('This phone could not shrink that photo.');
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, copyWidth, copyHeight);
      copies.push({ width: copyWidth, blob: await encode(canvas) });
    }
    return { width, height, copies };
  } finally {
    bitmap.close();
  }
}

/** The server's sentence, when it sends one; otherwise a plain one of our own. */
async function failure(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) return new Error(body.error.message);
  } catch {
    // Not JSON: something in between answered.
  }
  return new Error('The photo could not be sent. Please try again.');
}

async function send(path: string, init: RequestInit): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { credentials: 'same-origin', cache: 'no-store', ...init });
  } catch {
    throw new Error('HOMEBASE cannot reach the server just now. The photo was not sent.');
  }
  if (!response.ok) throw await failure(response);
}

/**
 * Send a prepared photo: first "a photo is coming", then each copy, the smallest first so the wall has something
 * to show as soon as possible. Safe to call again with the same id after a failure.
 */
export async function uploadPhoto(
  prepared: PreparedPhoto,
  mediaId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const copies = [...prepared.copies].sort((a, b) => a.width - b.width);
  const total = copies.length + 1;
  await send('/media', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mediaId, width: prepared.width, height: prepared.height }),
  });
  onProgress?.(1, total);
  for (const [index, copy] of copies.entries()) {
    await send(`/media/${mediaId}/${copy.width}`, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: copy.blob,
    });
    onProgress?.(index + 2, total);
  }
}
