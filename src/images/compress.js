// Compression des PNG et export JPEG (seul format photo accepté par TikTok avec le WebP).
import sharp from 'sharp';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

/** Recompresse un PNG en place (palette quantifiée, quasi sans perte visible). Renvoie le gain en %. */
export async function compressPng(file) {
  const before = statSync(file).size;
  const buf = await sharp(readFileSync(file)).png({ palette: true, quality: 92, effort: 8, compressionLevel: 9 }).toBuffer();
  if (buf.length < before) writeFileSync(file, buf);
  return Math.round((1 - Math.min(buf.length, before) / before) * 100);
}

/** Convertit un PNG en JPEG 1080×1920 pour l'envoi TikTok (max 20 Mo, 1080p). */
export async function toJpeg(pngFile, jpegFile) {
  await sharp(pngFile).flatten({ background: '#ffffff' }).jpeg({ quality: 90, mozjpeg: true }).toFile(jpegFile);
}
