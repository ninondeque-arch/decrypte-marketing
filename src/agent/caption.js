// Génération de légendes TikTok à partir du contenu d'un post.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../editorial/post.js';
import { slideTexts } from '../editorial/validate.js';
import { runClaude } from './claude.js';

/** Propose 3 légendes (accroche, question pour les commentaires, 4 à 5 hashtags). */
export async function suggestCaptions(dir) {
  const cfg = loadConfig(dir);
  const content = cfg.slides.map((s, i) => `Slide ${i + 1} : ${slideTexts(s).join(' / ')}`).join('\n');
  let current = '';
  try { current = readFileSync(join(dir, 'legende.txt'), 'utf8').trim(); } catch { /* pas encore de légende */ }
  const prompt = `Tu écris des légendes TikTok pour un compte français qui décrypte le marketing (ton direct et complice, tutoiement).
Sujet : ${cfg.sujet}. Rubrique : ${cfg.rubrique}. Secteur : ${cfg.secteur}.
Contenu du carrousel :
${content}
${current ? `Légende actuelle (à améliorer) :\n${current}\n` : ''}
Propose 3 légendes différentes (une plus intrigante, une plus pédagogique, une plus complice). Chacune :
- 2 à 3 lignes courtes, avec 1 ou 2 emojis maximum, et une question qui donne envie de commenter ;
- puis une ligne vide et 4 à 5 hashtags pertinents (dont au moins un en français, pas de #fyp) ;
- aucun chiffre ni fait qui ne soit pas dans le carrousel.
N'utilise aucun outil. Réponds uniquement avec ce JSON, sans texte autour : {"legendes": ["…", "…", "…"]}`;
  const res = await runClaude(prompt);
  const json = res.text.match(/\{[\s\S]*\}/)?.[0];
  const legendes = json ? JSON.parse(json).legendes : null;
  if (!Array.isArray(legendes) || !legendes.length) throw new Error('Légendes illisibles, réessaie.');
  return legendes.map(l => String(l).trim());
}
