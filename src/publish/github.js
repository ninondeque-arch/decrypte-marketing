// Mise en ligne dans la démo : les fichiers sont envoyés sur GitHub, Vercel reconstruit alors la démo toute seule.
import { basename, join, relative } from 'node:path';
import { ROOT } from '../config.js';
import { loadConfig } from '../editorial/post.js';
import { git as runGit } from '../tiktok/pages.js';

/**
 * Commit et push de ces chemins, et de rien d'autre (les autres modifications en cours ne sont pas touchées).
 * @param {{log?: (msg: string) => void, git?: typeof runGit}} opts `git` remplaçable dans les tests
 * @returns {boolean} false s'il n'y avait rien de nouveau à envoyer
 */
export function pushPaths(paths, message, { log = () => {}, git = runGit } = {}) {
  git('add', '--', ...paths); // les fichiers ignorés (visuels bruts, .env…) le restent
  if (!git('diff', '--cached', '--name-only', '--', ...paths)) { log('Rien de nouveau à envoyer sur GitHub'); return false; }
  git('commit', '-m', message, '--', ...paths);
  log('Envoi sur GitHub…');
  git('push');
  log('Envoyé : la démo se met à jour sur Vercel d’ici une à deux minutes');
  return true;
}

/** Post marqué publié : son dossier et calendrier.md. */
export const pushPublishedPost = (dir, opts) =>
  pushPaths([relative(ROOT, dir) || basename(dir), 'calendrier.md'], `Post publié : ${loadConfig(dir).sujet}`, opts);

/** Nouvelle veille : le fichier veille/<date>.json. */
export const pushVeille = (date, opts) => pushPaths([join('veille', `${date}.json`)], `Veille du ${date}`, opts);
