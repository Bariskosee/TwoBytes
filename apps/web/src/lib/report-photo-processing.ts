import "server-only";
import sharp from "sharp";

export const MAX_REPORT_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_INPUT_PIXELS = 24_000_000;
const MAX_OUTPUT_DIMENSION = 2048;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function imageFormat(bytes: Buffer) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

export async function encodeReportPhoto(file: File): Promise<Buffer | null> {
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const format = imageFormat(bytes);
    if (!format) return null;

    const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) !== 1) return null;

    // Orient the pixels before encoding. Sharp strips metadata from the JPEG.
    const output = await image.autoOrient()
      .resize(MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer();

    return output.length <= MAX_REPORT_PHOTO_BYTES ? output : null;
  } catch {
    return null;
  }
}
