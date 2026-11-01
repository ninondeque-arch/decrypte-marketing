// Éléments graphiques réutilisables : étiquette, compteur, photo, flèche.
import { loadImage } from '@napi-rs/canvas';
import { join } from 'node:path';
import { SLIDE } from '../config.js';
import { nbsp } from './typo.js';

const { W } = SLIDE;

/** Recadre une image pour remplir exactement le rectangle (comme CSS object-fit: cover). */
function cover(ctx, img, x, y, w, h, focusY = 0.5) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * focusY, sw, sh, x, y, w, h);
}

/** Ajuste une image entière dans le rectangle (object-fit: contain), centrée en bas. */
function contain(ctx, img, x, y, w, h) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + h - dh, dw, dh);
}

/** Pastille « 3/7 » en haut à droite (zone non masquée par TikTok). */
export function counter(ctx, i, n, P) {
  ctx.save();
  ctx.font = '44px Anton';
  ctx.fillStyle = P.ink;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${i}/${n}`, W - 84, 104);
  ctx.restore();
}

/** Titre de section posé sur un aplat (« LE CONTEXTE »). Renvoie sa hauteur. */
export function label(ctx, text, x, y, P, size = 92) {
  ctx.save();
  ctx.font = `${size}px Anton`;
  const t = nbsp(text.toUpperCase());
  const w = ctx.measureText(t).width, h = size * 1.32;
  ctx.fillStyle = P.boxBg;
  ctx.fillRect(x, y, w + 56, h);
  ctx.fillStyle = P.boxInk;
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x + 28, y + h / 2 + size * 0.04);
  ctx.restore();
  return h;
}

/** Flèche épaisse vers la droite. */
export function arrow(ctx, x, y, len, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x + len - 34, y - 34); ctx.lineTo(x + len, y); ctx.lineTo(x + len - 34, y + 34);
  ctx.stroke();
  ctx.restore();
}

/**
 * Photo cadrée net, avec crédit et légende optionnelle.
 * Si `photo.cutout` est renseigné (produit détouré), l'image est posée entière, sans cadre.
 * Ne dessine rien si la place disponible est trop petite.
 */
export async function photo(ctx, ph, x, y, w, h, P, postDir, { frame = false } = {}) {
  if (!ph || h < 220) return;
  if (ph.cutout) {
    const img = await loadImage(join(postDir, ph.cutout));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
    contain(ctx, img, x, y, w, h);
    ctx.restore();
  } else {
    const img = await loadImage(join(postDir, ph.src));
    if (frame) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 14, y - 14, w + 28, h + 28); }
    cover(ctx, img, x, y, w, h, ph.focusY ?? 0.5);
    if (ph.caption) {
      ctx.fillStyle = P.boxBg;
      ctx.fillRect(x, y + h - 64, w, 64);
      ctx.save();
      ctx.font = '800 28px Inter';
      ctx.fillStyle = P.boxInk;
      ctx.textBaseline = 'middle';
      ctx.fillText(nbsp(ph.caption.toUpperCase()), x + 24, y + h - 32);
      ctx.restore();
    }
  }
  if (ph.credit) {
    ctx.save();
    ctx.font = '500 22px Inter';
    const text = '© ' + ph.credit, cw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + w - cw - 24, y, cw + 24, 36);
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w - cw - 12, y + 18);
    ctx.restore();
  }
}

/**
 * Photo pleine largeur, du point `y` jusqu'en bas de la slide (elle peut passer sous l'interface
 * TikTok : ce n'est pas du texte). Si le cadrage plein cadre couperait trop l'image (par exemple
 * un visuel avec du texte incrusté), elle est montrée en entier sur un fond flouté.
 * Légende et crédit sont posés en haut de la photo, hors des zones recouvertes.
 */
export async function bleedPhoto(ctx, ph, y, P, postDir) {
  const { W, H } = SLIDE;
  const h = H - y;
  if (!ph || h < 260) return;
  const img = await loadImage(join(postDir, ph.cutout ?? ph.src));
  const boxRatio = W / h, imgRatio = img.width / img.height;
  const loss = 1 - Math.min(boxRatio, imgRatio) / Math.max(boxRatio, imgRatio); // part de l'image coupée en cadrage plein
  if (ph.cutout || (ph.fit !== 'cover' && (ph.fit === 'contain' || loss > 0.22))) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y, W, h); ctx.clip(); // le flou ne déborde pas sur le texte
    ctx.filter = 'blur(28px)';
    cover(ctx, img, -40, y - 40, W + 80, h + 80, ph.focusY ?? 0.5);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y, W, h);
    ctx.restore();
    const s = Math.min(W / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 30;
    ctx.drawImage(img, (W - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    cover(ctx, img, 0, y, W, h, ph.focusY ?? 0.5);
  }
  let capH = 0, capRight = 0;
  if (ph.caption) {
    ctx.save();
    ctx.font = '800 26px Inter';
    const t = nbsp(ph.caption.toUpperCase()), tw = ctx.measureText(t).width;
    capH = 52;
    capRight = SLIDE.LEFT + tw + 40;
    ctx.fillStyle = P.boxBg;
    ctx.fillRect(SLIDE.LEFT, y, tw + 40, capH);
    ctx.fillStyle = P.boxInk;
    ctx.textBaseline = 'middle';
    ctx.fillText(t, SLIDE.LEFT + 20, y + capH / 2);
    ctx.restore();
  }
  if (ph.credit) {
    ctx.save();
    ctx.font = '500 20px Inter';
    const text = '© ' + ph.credit, cw = ctx.measureText(text).width;
    // À droite de la légende si la place le permet, sinon juste en dessous
    const below = capRight + 24 > SLIDE.RIGHT - cw - 20;
    const cx = below ? SLIDE.LEFT : SLIDE.RIGHT - cw - 20, cy = below ? y + capH + 8 : y + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx, cy, cw + 20, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx + 10, cy + 16);
    ctx.restore();
  }
}
