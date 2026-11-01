// Contrôles éditoriaux avant rendu : structure, longueur, chiffres sourcés, fichiers.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../config.js';
import { checkTheme } from '../render/contrast.js';
import { countWords } from '../render/typo.js';

/** Textes affichés d'une slide (hors appel à l'action, qui n'est pas une affirmation). */
export function slideTexts(s) {
  return [s.title, s.quote, s.attribution, s.body, ...(s.items ?? []).flatMap(it => (typeof it === 'string' ? [it] : [it.value, it.text])), s.lesson, s.conclusion, s.source]
    .filter(Boolean);
}

/** Texte compté pour la règle des 25 mots (les listes et chiffres clés en sont exclus). */
function proseOf(s) {
  if (s.type === 'quote') return [s.quote, s.body].filter(Boolean).join(' ');
  if (s.type === 'text') return s.body ?? '';
  if (s.type === 'outro') return [s.lesson, s.conclusion].filter(Boolean).join(' ');
  return '';
}

const digitsOnly = s => s.replace(/(\d)[\s .](?=\d{3}\b)/g, '$1').replace(/(\d),(?=\d)/g, '$1.');

/** Nombres cités dans un texte, normalisés (« 80 000+ » → « 80000 »). */
export function numbersIn(text) {
  return [...digitsOnly(text).matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0]);
}

/**
 * Valide un post.
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validatePost(postDir, cfg) {
  const errors = [], warnings = [];
  const slides = cfg.slides ?? [];
  const at = i => `slide ${i + 1}`;

  // Structure
  if (slides.length < RULES.minSlides || slides.length > RULES.maxSlides) errors.push(`${slides.length} slides : il en faut entre ${RULES.minSlides} et ${RULES.maxSlides}`);
  if (slides[0]?.type !== 'hook') errors.push('la slide 1 doit être une accroche (type « hook »)');
  if (slides.at(-1)?.type !== 'outro') errors.push('la dernière slide doit être « Résultat ? » (type « outro »)');
  if (slides.at(-2)?.type !== 'stats') errors.push('l\'avant-dernière slide doit présenter les chiffres (type « stats »)');
  for (const k of ['sujet', 'rubrique', 'secteur', 'statut']) if (!cfg[k]) errors.push(`champ « ${k} » manquant`);

  // Longueurs
  const hookWords = countWords(slides[0]?.title);
  if (hookWords > RULES.maxHookWords) errors.push(`accroche trop longue : ${hookWords} mots (max ${RULES.maxHookWords})`);
  slides.forEach((s, i) => {
    const n = countWords(proseOf(s));
    if (n > RULES.maxWordsPerSlide) errors.push(`${at(i)} : ${n} mots (max ${RULES.maxWordsPerSlide} hors listes)`);
    for (const h of s.highlight ?? []) if (!slideTexts(s).some(t => t.includes(h))) warnings.push(`${at(i)} : l'expression surlignée « ${h} » n'apparaît pas dans le texte`);
    const ph = s.photo;
    if (ph && !existsSync(join(postDir, ph.src))) errors.push(`${at(i)} : image introuvable « ${ph.src} »`);
    if (ph && !ph.credit) warnings.push(`${at(i)} : photo sans crédit`);
  });

  // Aucun chiffre sans source : chaque nombre affiché doit figurer dans sources.md
  const sourcesFile = join(postDir, 'sources.md');
  if (!existsSync(sourcesFile)) errors.push('sources.md manquant');
  else {
    const sources = digitsOnly(readFileSync(sourcesFile, 'utf8'));
    slides.forEach((s, i) => {
      for (const n of new Set(slideTexts(s).flatMap(numbersIn))) {
        if (!sources.includes(n)) errors.push(`${at(i)} : le nombre « ${n} » n'apparaît pas dans sources.md`);
      }
    });
  }

  // Légende
  const legendFile = join(postDir, 'legende.txt');
  if (!existsSync(legendFile)) errors.push('legende.txt manquant');
  else {
    const tags = readFileSync(legendFile, 'utf8').match(/#[\p{L}\p{N}_]+/gu) ?? [];
    if (tags.length < 4 || tags.length > 5) warnings.push(`légende : ${tags.length} hashtags (4 à 5 attendus)`);
  }

  // Lisibilité du thème
  if (!cfg.theme) errors.push('thème manquant');
  else errors.push(...checkTheme(cfg.theme).map(e => `thème : ${e}`));

  return { errors, warnings };
}
