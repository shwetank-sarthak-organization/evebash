import sharp from "sharp";

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
