// Gabarits de slides (direction « Poster ») : un par `type` du slides-config.json.
import { SLIDE } from '../config.js';
import { arrow, bleedPhoto, label } from './elements.js';
import { richText } from './rich-text.js';

const { LEFT: L, RIGHT: R, BOTTOM, MAXW, TOP, H } = SLIDE;
const LABEL = 76;   // taille des titres de section
const MIN_PHOTO = 600; // hauteur minimale réservée à la photo

/** Options de texte communes à une palette. */
const style = (P, font, lh, extra = {}) => ({ font, lh, ink: P.ink, box: P.boxBg, boxInk: P.boxInk, ...extra });

export const templates = {
  /** Slide 1 : accroche XXL + ligne de fait (facultative) + visuel + incitation à swiper. */
  async hook({ ctx, slide, P, postDir }) {
    // L'accroche rétrécit pour laisser une grande place au visuel
    let size = 124;
    const titleStyle = sz => style(P, `${sz}px Anton`, sz * 1.16, { hl: slide.highlight, upper: true });
    const factStyle = style(P, '800 40px Inter', 52, { hl: slide.highlight });
    const factH = slide.fact ? richText(ctx, slide.fact, L, 0, MAXW, { ...factStyle, measureOnly: true }) + 28 : 0;
    const room = (slide.photo ? H - 680 : BOTTOM - 200) - factH;
    while (size > 84 && TOP + 10 + richText(ctx, slide.title, L, 0, MAXW + 40, { ...titleStyle(size), measureOnly: true }) > room) size -= 4;
    let y = TOP + 10;
    y += richText(ctx, slide.title, L, y, MAXW + 40, titleStyle(size));
    if (slide.fact) y += 28 + richText(ctx, slide.fact, L, y + 28, MAXW, factStyle);
    await bleedPhoto(ctx, slide.photo, y + 40, P, postDir);
    const ctaY = BOTTOM - 130;
    ctx.fillStyle = P.boxBg;
    ctx.fillRect(L, ctaY, 520, 100);
    ctx.save();
    ctx.font = '50px Anton';
    ctx.fillStyle = P.boxInk;
    ctx.textBaseline = 'middle';
    ctx.fillText((slide.cta ?? 'On décrypte').replace('→', '').trim().toUpperCase(), L + 30, ctaY + 50);
    ctx.restore();
    arrow(ctx, L + 370, ctaY + 50, 100, P.boxInk);
  },

  /** Citation marquante + une phrase d'explication. */
  async quote({ ctx, slide, P, postDir }) {
    let y = TOP + label(ctx, slide.label, L, TOP, P, LABEL) + 30;
    ctx.save();
    ctx.font = '160px Anton';
    ctx.fillStyle = P.boxBg;
    ctx.textBaseline = 'top';
    ctx.fillText('“', L - 6, y - 30);
    ctx.restore();
    y += 80;
    y += richText(ctx, slide.quote, L, y, MAXW, style(P, '72px Anton', 82, { upper: true })) + 20;
    if (slide.attribution) y += richText(ctx, '— ' + slide.attribution, L, y, MAXW, style(P, '600 28px Inter', 36)) + 28;
    if (slide.body) y += richText(ctx, slide.body, L, y, MAXW, style(P, '800 40px Inter', 52, { hl: slide.highlight })) + 36;
    await bleedPhoto(ctx, slide.photo, y, P, postDir);
  },

  /** Titre de section + 2-3 lignes + source (facultative) + visuel. Sans visuel, le texte grossit. */
  async text({ ctx, slide, P, postDir }) {
    let y = TOP + label(ctx, slide.label, L, TOP, P, LABEL) + 44;
    const big = !slide.photo;
    y += richText(ctx, slide.body, L, y, MAXW, style(P, big ? '800 62px Inter' : '800 42px Inter', big ? 84 : 56, { hl: slide.highlight })) + 40;
    if (slide.source) y += richText(ctx, slide.source, L, y - 12, MAXW, style(P, '700 26px Inter', 34, { upper: true })) + 28;
    if (slide.photo) await bleedPhoto(ctx, slide.photo, Math.min(y, H - MIN_PHOTO), P, postDir);
    else arrow(ctx, L, y + 40, 260, P.boxBg);
  },

  /**
   * Une leçon : petit repère (« Leçon 1 »), la leçon en une phrase complète, 2 à 4 phrases courtes,
   * une citation réelle si les sources en ont une, puis le visuel s'il reste de la place.
   */
  async lesson({ ctx, slide, P, postDir }) {
    const big = !slide.photo; // sans visuel, le texte grossit
    const titleStyle = sz => style(P, `${sz}px Anton`, sz * 1.14, { hl: slide.highlight, upper: true });
    const bodyStyle = big ? style(P, '700 50px Inter', 66, { hl: slide.highlight }) : style(P, '700 38px Inter', 50, { hl: slide.highlight });
    const quoteStyle = big ? style(P, '800 42px Inter', 56) : style(P, '800 36px Inter', 47);
    const quote = slide.quote && `« ${slide.quote} »`;
    const labelH = slide.label ? label(ctx, slide.label, L, 0, P, 56, { measureOnly: true }) + 40 : 0;
    const rest = (slide.body ? richText(ctx, slide.body, L, 0, MAXW, { ...bodyStyle, measureOnly: true }) + 36 : 0)
      + (quote ? richText(ctx, quote, L + 36, 0, MAXW - 36, { ...quoteStyle, measureOnly: true }) + 70 : 0);
    let size = big ? 104 : 76;
    while (size > 52 && TOP + labelH + richText(ctx, slide.title, L, 0, MAXW, { ...titleStyle(size), measureOnly: true }) + 36 + rest > BOTTOM) size -= 4;

    let y = TOP;
    if (slide.label) y += label(ctx, slide.label, L, TOP, P, 56) + 40;
    y += richText(ctx, slide.title, L, y, MAXW, titleStyle(size)) + 36;
    if (slide.body) y += richText(ctx, slide.body, L, y, MAXW, bodyStyle) + 36;
    if (quote) {
      const qh = richText(ctx, quote, L + 36, y, MAXW - 36, quoteStyle);
      ctx.fillStyle = P.boxBg;
      ctx.fillRect(L, y, 10, qh);
      y += qh + 10;
      if (slide.attribution) y += richText(ctx, '— ' + slide.attribution, L + 36, y, MAXW - 36, style(P, big ? '600 30px Inter' : '600 26px Inter', big ? 40 : 34));
      y += 34;
    }
    if (slide.photo) await bleedPhoto(ctx, slide.photo, Math.max(y, H - MIN_PHOTO), P, postDir);
  },

  /** Liste numérotée (3 points, ou 1 à 2 cas comparables) + visuel. Sans visuel, le texte grossit. */
  async list({ ctx, slide, P, postDir }) {
    const big = !slide.photo;
    const itemStyle = big ? style(P, '800 50px Inter', 64, { hl: slide.highlight }) : style(P, '800 38px Inter', 48, { hl: slide.highlight });
    let y = TOP + label(ctx, slide.label, L, TOP, P, LABEL) + (big ? 60 : 40);
    for (const [i, item] of slide.items.entries()) {
      ctx.save();
      ctx.font = big ? '80px Anton' : '64px Anton';
      ctx.fillStyle = P.boxBg;
      ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1).padStart(2, '0'), L, y - 14);
      ctx.restore();
      y += Math.max(big ? 90 : 72, richText(ctx, item, L + 130, y, MAXW - 130, itemStyle)) + (big ? 44 : 20);
    }
    await bleedPhoto(ctx, slide.photo, Math.min(y + 20, H - MIN_PHOTO), P, postDir);
  },

  /** Chiffres clés en grands blocs + source. */
  async stats({ ctx, slide, P }) {
    let y = TOP + label(ctx, slide.label, L, TOP, P, LABEL) + 44;
    const gap = 28, n = slide.items.length;
    const blockH = Math.min(330, (BOTTOM - y - 80 - gap * n) / n);
    const valueSize = Math.round(Math.min(140, blockH * 0.46));
    for (const item of slide.items) {
      ctx.fillStyle = P.boxBg;
      ctx.fillRect(L, y, MAXW, blockH);
      richText(ctx, item.value, L + 36, y + 14, MAXW - 72, { font: `${valueSize}px Anton`, lh: valueSize * 1.12, ink: P.boxInk, box: P.boxBg, boxInk: P.boxInk });
      richText(ctx, item.text, L + 36, y + 22 + valueSize * 1.12, MAXW - 72, { font: '800 34px Inter', lh: 42, ink: P.boxInk, box: P.bg, boxInk: P.ink, upper: true });
      y += blockH + gap;
    }
    if (slide.source) richText(ctx, slide.source, L, y + 4, MAXW, style(P, '700 26px Inter', 34, { upper: true }));
  },

  /** Titre + leçon générale + phrase facultative + signature ou appel à l'action. La leçon rétrécit si besoin. */
  async outro({ ctx, slide, P }) {
    const ctaStyle = style(P, '50px Anton', 60, { ink: P.boxInk, upper: true });
    const ctaH = richText(ctx, slide.cta, 0, 0, MAXW - 200, { ...ctaStyle, measureOnly: true }) + 70;
    const y0 = TOP + label(ctx, slide.title ?? 'Résultat ?', L, TOP, P, 100) + 56;
    const lessonStyle = sz => style(P, `${sz}px Anton`, sz * 1.2, { hl: slide.highlight, upper: true });
    const conclStyle = style(P, '700 44px Inter', 58);
    const height = sz => richText(ctx, slide.lesson, L, 0, MAXW, { ...lessonStyle(sz), measureOnly: true })
      + (slide.conclusion ? 40 + richText(ctx, slide.conclusion, L, 0, MAXW, { ...conclStyle, measureOnly: true }) : 0) + 50 + ctaH;
    let size = 110;
    while (size > 70 && y0 + height(size) > BOTTOM) size -= 4;

    let y = y0;
    y += richText(ctx, slide.lesson, L, y, MAXW, lessonStyle(size));
    y += (slide.conclusion ? 40 + richText(ctx, slide.conclusion, L, y + 40, MAXW, conclStyle) : 0) + 50;
    ctx.fillStyle = P.boxBg;
    ctx.fillRect(L, y, MAXW, ctaH);
    richText(ctx, slide.cta, L + 40, y + 35, MAXW - 200, ctaStyle);
    arrow(ctx, R - 150, y + ctaH / 2, 100, P.boxInk);
  },
};
