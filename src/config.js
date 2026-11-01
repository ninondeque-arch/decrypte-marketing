// Constantes partagées : chemins, format TikTok, zones sûres.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const POSTS_DIR = join(ROOT, 'posts');
export const ASSETS_DIR = join(ROOT, 'assets');
export const PAGES_DIR = join(ROOT, 'docs'); // dossier publié par GitHub Pages
export const TOKENS_FILE = join(ROOT, '.tiktok-tokens.json');

// Charge .env si présent (Node ≥ 20.12), sans dépendance externe.
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

/**
 * Format des carrousels photo TikTok : 3:4 (1080 × 1440). TikTok rogne les images 9:16
 * en haut et en bas, d'où ce format. Zones recouvertes par l'interface (relevées sur une
 * capture de l'appli) : barre de recherche en haut, boutons à droite à partir de ~60 % de
 * la hauteur, avatar et points de pagination en bas.
 */
export const SLIDE = {
  W: 1080,
  H: 1440,
  LEFT: 84,
  TOP: 130,
  RIGHT: 1080 - 150,
  BOTTOM: 1440 - 120,
  // Colonne de boutons TikTok (à droite, partie basse)
  ICONS_Y: 860,
};
SLIDE.MAXW = SLIDE.RIGHT - SLIDE.LEFT;

/** Règles éditoriales du compte. */
export const RULES = {
  minSlides: 6,
  maxSlides: 8,
  maxHookWords: 9, // « moins de 10 mots »
  maxWordsPerSlide: 24, // « moins de 25 mots », hors listes et appel à l'action
  minContrast: 4.5, // WCAG AA
};
