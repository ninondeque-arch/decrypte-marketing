// Typographie française et découpage du texte surligné.

/**
 * Insère les espaces insécables de la typographie française pour éviter
 * qu'un « ? », un « % » ou un « 000 » se retrouve seul en début de ligne.
 */
export function nbsp(text) {
  return text
    .replace(/ ([:;!?»%$€])/g, ' $1')
    .replace(/« /g, '« ')
    .replace(/(\d) (?=\d{3}\b)/g, '$1 ')
    .replace(/([<>≈×+]) (?=\d)/g, '$1 ');
}

/**
 * Découpe un texte en mots (espaces conservés en fin de mot) et marque ceux
 * qui appartiennent à une expression surlignée.
 * @param {string} text
 * @param {string[]} highlights expressions à surligner, telles qu'écrites dans le texte
 * @returns {{t: string, hl?: boolean}[]}
 */
export function tokenize(text, highlights = []) {
  const out = [];
  let rest = text;
  const split = (s, hl) => s.split(/(?<= )/).filter(Boolean).forEach(t => out.push(hl ? { t, hl } : { t }));
  while (rest.length) {
    let best = null;
    for (const p of highlights) {
      const i = rest.indexOf(p);
      if (p && i >= 0 && (!best || i < best.i)) best = { i, p };
    }
    if (!best) { split(rest, false); break; }
    split(rest.slice(0, best.i), false);
    split(best.p, true);
    rest = rest.slice(best.i + best.p.length);
  }
  return out;
}

/** Compte les mots d'un texte (la ponctuation isolée ne compte pas). */
export function countWords(text = '') {
  return text.split(/[\s ]+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}
