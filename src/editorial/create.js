// Création d'un post vide, à remplir à la main dans le studio.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSETS_DIR, POSTS_DIR } from '../config.js';
import { saveConfig } from './post.js';

export function slugify(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'post';
}

/** Modèle de départ : la structure attendue, avec des textes à remplacer. */
export const blankSlides = () => [
  { type: 'hook', title: 'Ton accroche en moins de 10 mots ?', highlight: [], cta: 'On décrypte →' },
  { type: 'text', label: 'Le contexte', body: 'Deux ou trois lignes pour poser le décor.', highlight: [] },
  { type: 'text', label: "L'idée", body: "L'idée de la campagne en une phrase claire.", highlight: [] },
  { type: 'list', label: 'La mécanique', items: ['Premier ressort', 'Deuxième ressort', 'Troisième ressort'], highlight: [] },
  { type: 'stats', label: 'Les chiffres', items: [{ value: '…', text: 'un chiffre sourcé' }], source: 'Source : …' },
  { type: 'outro', title: 'Résultat ?', lesson: 'La leçon marketing en une phrase forte.', conclusion: 'Une phrase de conclusion.', cta: 'Abonne-toi et dis-moi en commentaire quelle marque on décrypte ensuite !', highlight: [] },
];

/** Crée posts/<date>_<sujet>/ et renvoie le nom du dossier. */
export function createPost({ sujet, rubrique, secteur, startup = false, date }) {
  if (!sujet?.trim()) throw new Error('Sujet manquant');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('Date invalide (AAAA-MM-JJ)');
  let slug = `${date}_${slugify(sujet)}`;
  for (let n = 2; existsSync(join(POSTS_DIR, slug)); n++) slug = `${date}_${slugify(sujet)}-${n}`;
  const dir = join(POSTS_DIR, slug);
  mkdirSync(join(dir, 'images'), { recursive: true });
  const theme = JSON.parse(readFileSync(join(ASSETS_DIR, 'theme-defaut.json'), 'utf8'));
  saveConfig(dir, { sujet: sujet.trim(), rubrique, secteur: secteur?.trim() || 'À préciser', startup, statut: 'à rédiger', accroches: [], theme, slides: blankSlides() });
  writeFileSync(join(dir, 'legende.txt'), '');
  writeFileSync(join(dir, 'sources.md'), `# Sources : ${sujet.trim()}\n\n| Slide | Affirmation | Source |\n|---|---|---|\n| | | |\n`);
  return slug;
}
