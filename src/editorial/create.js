// Création d'un post vide, à remplir à la main dans le studio.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSETS_DIR, POSTS_DIR } from '../config.js';
import { saveConfig } from './post.js';

export function slugify(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'post';
}

/** Modèle de départ : la structure en 8 slides, avec des textes à remplacer. */
export const blankSlides = () => [
  { type: 'hook', title: 'La marque a fait quoi ?', fact: 'Une ligne de fait qui crée la tension.', highlight: [], cta: 'On décrypte →' },
  { type: 'text', label: 'Pourquoi maintenant', body: 'La tendance et un chiffre clé.', source: 'Source : …', highlight: [] },
  { type: 'text', label: 'Le cas', body: 'Ce que la marque a fait, le résultat, et ce qu\'on va en retenir.', highlight: [] },
  { type: 'lesson', label: 'Leçon 1', title: 'La première leçon en une phrase complète.', body: 'Deux à quatre phrases courtes.', highlight: [] },
  { type: 'lesson', label: 'Leçon 2', title: 'La deuxième leçon en une phrase complète.', body: 'Deux à quatre phrases courtes.', highlight: [] },
  { type: 'lesson', label: 'Leçon 3', title: 'La troisième leçon en une phrase complète.', body: 'Deux à quatre phrases courtes.', highlight: [] },
  { type: 'list', label: 'Cas comparables', items: ['Marque ou star : ce qu\'elle a fait → son résultat', 'Marque ou star : ce qu\'elle a fait → son résultat'], highlight: [] },
  { type: 'outro', title: 'À retenir', lesson: 'La leçon générale en une phrase.', cta: 'Derrière la Hype · abonne-toi pour le prochain décryptage', highlight: [] },
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
