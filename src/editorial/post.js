// Lecture / écriture d'un post (dossier posts/AAAA-MM-JJ_sujet/).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { POSTS_DIR } from '../config.js';

/** Liste les dossiers de posts, du plus ancien au plus récent. */
export function listPosts() {
  if (!existsSync(POSTS_DIR)) return [];
  return readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(POSTS_DIR, d.name, 'slides-config.json')))
    .map(d => join(POSTS_DIR, d.name))
    .sort();
}

/**
 * Retrouve un post à partir d'un chemin, d'un nom de dossier ou d'un morceau de nom
 * (« norway » suffit s'il n'y a pas d'ambiguïté).
 */
export function resolvePost(query) {
  if (!query) throw new Error('Précise le post, par exemple : npm run images -- visit-norway');
  const direct = resolve(query);
  if (existsSync(join(direct, 'slides-config.json'))) return direct;
  const matches = listPosts().filter(p => basename(p).toLowerCase().includes(query.toLowerCase()));
  if (matches.length === 1) return matches[0];
  if (!matches.length) throw new Error(`Aucun post ne correspond à « ${query} » dans posts/`);
  throw new Error(`Plusieurs posts correspondent à « ${query} » : ${matches.map(m => basename(m)).join(', ')}`);
}

export const loadConfig = dir => JSON.parse(readFileSync(join(dir, 'slides-config.json'), 'utf8'));
export const saveConfig = (dir, cfg) => writeFileSync(join(dir, 'slides-config.json'), JSON.stringify(cfg, null, 2) + '\n');

/** Date de publication prévue, tirée du nom du dossier. */
export const postDate = dir => basename(dir).slice(0, 10);
