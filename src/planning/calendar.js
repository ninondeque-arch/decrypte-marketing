// calendrier.md : état des posts et contrôle de la variété du fil.
import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ROOT } from '../config.js';
import { listPosts, loadConfig, postDate } from '../editorial/post.js';

export const STATUSES = ['à rédiger', 'prêt', 'programmé', 'brouillon', 'publié'];

/** Cibles de rotation des rubriques sur le fil. */
export const RUBRIC_TARGETS = {
  'Le marketing derrière la culture pop': 0.6,
  "Pourquoi tu l'as acheté": 0.25,
  'Le flop': 0.15,
};

/**
 * Règles de variété : jamais deux posts d'affilée dans le même secteur ;
 * sur 10 posts, au moins 6 secteurs et 2 sujets de startups.
 * @param {{secteur: string, startup?: boolean, rubrique: string}[]} posts dans l'ordre chronologique
 * @returns {string[]} alertes
 */
export function varietyAlerts(posts) {
  const alerts = [];
  for (let i = 1; i < posts.length; i++) {
    if (posts[i].secteur === posts[i - 1].secteur) alerts.push(`Deux posts d'affilée dans le secteur « ${posts[i].secteur} » (${posts[i - 1].sujet} → ${posts[i].sujet})`);
  }
  const last = posts.slice(-10);
  if (last.length === 10) {
    const sectors = new Set(last.map(p => p.secteur)).size;
    const startups = last.filter(p => p.startup).length;
    if (sectors < 6) alerts.push(`Sur les 10 derniers posts : ${sectors} secteurs (minimum 6)`);
    if (startups < 2) alerts.push(`Sur les 10 derniers posts : ${startups} sujet(s) startup (minimum 2)`);
    for (const [rubric, target] of Object.entries(RUBRIC_TARGETS)) {
      const share = last.filter(p => p.rubrique === rubric).length / 10;
      if (Math.abs(share - target) > 0.15) alerts.push(`« ${rubric} » : ${Math.round(share * 100)} % des 10 derniers posts (cible ${target * 100} %)`);
    }
  }
  return alerts;
}

/** Régénère calendrier.md à partir des slides-config.json. */
export function writeCalendar() {
  const posts = listPosts().map(dir => ({ dir, date: postDate(dir), ...loadConfig(dir) }));
  const rows = posts.map(p => `| ${p.date} | ${p.sujet} | ${p.rubrique} | ${p.secteur}${p.startup ? ' ⭐' : ''} | ${p.statut} | \`${basename(p.dir)}\` |`);
  const count = s => posts.filter(p => p.statut === s).length;
  const alerts = varietyAlerts(posts);
  const md = `# Calendrier éditorial

> Fichier généré par \`npm run calendrier\` : ne pas modifier à la main, changer plutôt le champ \`statut\` du slides-config.json.

**${posts.length} post${posts.length > 1 ? 's' : ''}** · ${STATUSES.map(s => `${s} : ${count(s)}`).join(' · ')}

| Date | Sujet | Rubrique | Secteur | Statut | Dossier |
|---|---|---|---|---|---|
${rows.join('\n')}

⭐ = sujet startup

## Variété du fil

${alerts.length ? alerts.map(a => `- ⚠️ ${a}`).join('\n') : '- ✅ Règles de variété respectées.'}
`;
  writeFileSync(join(ROOT, 'calendrier.md'), md);
  return { posts, alerts };
}
