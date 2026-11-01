// Détourage automatique avec rembg (optionnel : `npm run setup:rembg` l'installe dans .venv).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, parse } from 'node:path';
import { ROOT } from '../config.js';

const REMBG = join(ROOT, '.venv/bin/rembg');

/**
 * Pour chaque photo marquée `"detourer": true`, crée `images/<nom>-detoure.png`
 * (une seule fois) et renseigne `photo.cutout`. Sans rembg, la photo reste cadrée.
 * @returns {string[]} avertissements
 */
export function prepareCutouts(postDir, config) {
  const warnings = [];
  for (const slide of config.slides) {
    const ph = slide.photo;
    if (!ph?.detourer) continue;
    const { dir, name } = parse(ph.src);
    const out = join(dir, `${name}-detoure.png`);
    if (!existsSync(join(postDir, out))) {
      if (!existsSync(REMBG)) {
        warnings.push(`rembg absent : « ${ph.src} » reste en photo cadrée (installer avec npm run setup:rembg)`);
        continue;
      }
      execFileSync(REMBG, ['i', join(postDir, ph.src), join(postDir, out)], { stdio: 'inherit' });
    }
    ph.cutout = out;
  }
  return warnings;
}
