// Texte multi-ligne avec expressions surlignées « en bloc » (style poster).
import { nbsp, tokenize } from './typo.js';

/**
 * Dessine (ou mesure) un paragraphe. Les expressions de `hl` sont posées sur un
 * aplat de couleur `box`, en `boxInk`.
 * @returns {number} hauteur occupée en pixels
 */
export function richText(ctx, text, x, y, maxW, opts) {
  const { font, lh, ink, box, boxInk, hl = [], upper = false, measureOnly = false } = opts;
  const up = s => nbsp(upper ? s.toUpperCase() : s);
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';

  // 1. Découpage en lignes
  const lines = [[]];
  let lineW = 0;
  let prev = null;
  for (const tk of tokenize(up(text), hl.map(up))) {
    const w = ctx.measureText(tk.t).width;
    const visible = ctx.measureText(tk.t.trimEnd()).width;
    // On ne coupe qu'après une vraie espace (jamais devant « » ? : collés par une espace insécable)
    const canBreak = prev && / $/.test(prev.t);
    if (lineW + visible > maxW && lineW > 0 && canBreak) { lines.push([]); lineW = 0; }
    prev = tk;
    lines.at(-1).push({ ...tk, w });
    lineW += w;
  }

  if (!measureOnly) {
    const asc = ctx.measureText('H').actualBoundingBoxAscent;
    const desc = upper ? asc * 0.08 : ctx.measureText('gp').actualBoundingBoxDescent;
    const pad = Math.max(4, Math.min(lh * 0.1, (lh - asc - desc) / 2 - 2));
    const baseline = i => y + i * lh + (lh - asc - desc) / 2 + asc;

    // 2. Tous les aplats d'abord, pour qu'aucun ne recouvre le texte d'une autre ligne
    lines.forEach((line, i) => {
      let cx = x;
      for (let k = 0; k < line.length; k++) {
        if (!line[k].hl) { cx += line[k].w; continue; }
        let j = k, w = 0;
        while (j < line.length && line[j].hl) w += line[j++].w;
        const trailing = line[j - 1].w - ctx.measureText(line[j - 1].t.trimEnd()).width;
        ctx.fillStyle = box;
        ctx.fillRect(cx - pad * 1.4, baseline(i) - asc - pad, w - trailing + pad * 2.8, asc + desc + pad * 2);
        cx += w;
        k = j - 1;
      }
    });

    // 3. Puis le texte
    lines.forEach((line, i) => {
      let cx = x;
      for (const tk of line) {
        ctx.fillStyle = tk.hl ? boxInk : ink;
        ctx.fillText(tk.t, cx, baseline(i));
        cx += tk.w;
      }
    });
  }
  ctx.restore();
  return lines.length * lh;
}
