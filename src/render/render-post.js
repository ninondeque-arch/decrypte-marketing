// Rendu d'un post complet : slides PNG + planches d'aperçu.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSETS_DIR, SLIDE } from '../config.js';
import { templates } from './templates.js';

GlobalFonts.registerFromPath(join(ASSETS_DIR, 'fonts/Anton.ttf'), 'Anton');
GlobalFonts.registerFromPath(join(ASSETS_DIR, 'fonts/Inter.ttf'), 'Inter');

const { W, H, RIGHT, BOTTOM, TOP, ICONS_Y } = SLIDE;

/** Palette d'une slide : choix explicite, sinon séquence du thème. */
export const paletteFor = (theme, slide, i) => theme.palettes[slide.palette ?? theme.sequence[i % theme.sequence.length]];

/**
 * Rend toutes les slides d'un post.
 * @returns {Promise<string[]>} chemins des PNG écrits
 */
export async function renderPost(postDir, config) {
  const n = config.slides.length;
  const canvases = [];
  const files = [];
  for (const [i, slide] of config.slides.entries()) {
    const P = paletteFor(config.theme, slide, i);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);
    const draw = templates[slide.type];
    if (!draw) throw new Error(`Slide ${i + 1} : type « ${slide.type} » inconnu (${Object.keys(templates).join(', ')})`);
    await draw({ ctx, slide, P, postDir });
    const file = join(postDir, `slide-${i + 1}.png`);
    writeFileSync(file, canvas.toBuffer('image/png'));
    files.push(file);
    canvases.push(canvas);
  }
  writeContactSheets(postDir, canvases);
  return files;
}

/** apercu.png (toutes les slides) et apercu-zones.png (zones recouvertes par l'interface TikTok, en vert). */
function writeContactSheets(postDir, canvases) {
  const th = 640, tw = th * W / H, gap = 28, k = tw / W;
  for (const zones of [false, true]) {
    const sheet = createCanvas(gap + canvases.length * (tw + gap), th + gap * 2);
    const sc = sheet.getContext('2d');
    sc.fillStyle = '#1a1a1a';
    sc.fillRect(0, 0, sheet.width, sheet.height);
    canvases.forEach((c, i) => {
      const x = gap + i * (tw + gap);
      sc.drawImage(c, x, gap, tw, th);
      if (zones) {
        sc.fillStyle = 'rgba(0,255,120,0.35)';
        sc.fillRect(x, gap, tw, (TOP - 20) * k);
        sc.fillRect(x, gap + BOTTOM * k, tw, (H - BOTTOM) * k);
        sc.fillRect(x + RIGHT * k, gap + ICONS_Y * k, (W - RIGHT) * k, (BOTTOM - ICONS_Y) * k);
      }
    });
    writeFileSync(join(postDir, zones ? 'apercu-zones.png' : 'apercu.png'), sheet.toBuffer('image/png'));
  }
}
