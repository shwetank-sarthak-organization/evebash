import sharp, { type ResizeOptions } from "sharp";

/**
 * Turning a photo for the rotate tool (issue #124). Most phone and many camera photos are stored sideways with an
 * EXIF mark saying how to turn them upright; sharp's rotate(angle) ignores that mark, so on such a photo "rotate
 * right" changed nothing and "rotate left" turned it upside down. With ROTATE_UPRIGHT_FIRST=true the photo is turned
 * upright first (as guests see it), then by the angle. Off until then: the old behaviour.
 */
export function isRotateUprightFirstEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.ROTATE_UPRIGHT_FIRST?.trim().toLowerCase() === "true";
}

export function rotateImage(bytes: Buffer, angle: number, uprightFirst: boolean) {
  const image = uprightFirst ? sharp(bytes).autoOrient().rotate(angle) : sharp(bytes).rotate(angle);
  return image.toBuffer({ resolveWithObject: true });
}

/**
 * The preview and thumbnail the rotate tool remakes (issue #138). The photo worker (PhotoProcessorV2 in
 * modal_engine/main.py) makes a 1600 px preview (WebP q70) and a 480 px thumbnail (WebP q68), both on the long side.
 * The rotate tool used to make them 900 px and 400 px WIDE (WebP q75), so a rotated portrait photo got a 900x1350
 * preview and looked softer than its neighbours. With ROTATE_WORKER_SIZES=true it makes the same sizes as the
 * worker. Off until then: the old sizes.
 */
export function isRotateWorkerSizesEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.ROTATE_WORKER_SIZES?.trim().toLowerCase() === "true";
}

export async function makeRotatedCopies(rotated: Buffer, workerSizes: boolean) {
  const copy = (resize: ResizeOptions, quality: number) =>
    sharp(rotated).resize({ ...resize, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
  if (!workerSizes) {
    const [thumbnail, preview] = await Promise.all([copy({ width: 400 }, 75), copy({ width: 900 }, 75)]);
    return { thumbnail, preview };
  }
  const [thumbnail, preview] = await Promise.all([
    copy({ width: 480, height: 480 }, 68),
    copy({ width: 1600, height: 1600 }, 70),
  ]);
  return { thumbnail, preview };
}
