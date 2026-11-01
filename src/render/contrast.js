// Contraste WCAG 2.1 : garantit que chaque palette de marque reste lisible.
import { RULES } from '../config.js';

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste entre deux couleurs hexadécimales (#RRGGBB). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Vérifie toutes les combinaisons texte/fond d'un thème.
 * @returns {string[]} liste d'erreurs (vide si tout est lisible)
 */
export function checkTheme(theme) {
  const errors = [];
  for (const [name, p] of Object.entries(theme.palettes ?? {})) {
    for (const [fg, bg, what] of [[p.ink, p.bg, 'texte'], [p.boxInk, p.boxBg, 'blocs']]) {
      const r = contrast(fg, bg);
      if (r < RULES.minContrast) errors.push(`palette « ${name} » (${what}) : ${fg} sur ${bg} = ${r.toFixed(1)}:1, minimum ${RULES.minContrast}:1`);
    }
  }
  for (const key of theme.sequence ?? []) if (!theme.palettes?.[key]) errors.push(`séquence : palette « ${key} » inconnue`);
  return errors;
}
