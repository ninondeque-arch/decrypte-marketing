// Réglages modifiables depuis le studio, stockés dans .env (jamais versionné).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../config.js';

const ENV_FILE = join(ROOT, '.env');
export const SETTINGS = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI', 'PAGES_BASE_URL', 'VEILLE_HEURE'];
const SECRETS = new Set(['TIKTOK_CLIENT_SECRET']);

/** Valeurs actuelles ; les secrets ne sont jamais renvoyés, seulement leur présence. */
export function readSettings() {
  return Object.fromEntries(SETTINGS.map(k => [k, SECRETS.has(k) ? (process.env[k] ? '••••••••' : '') : process.env[k] ?? '']));
}

/** Met à jour .env sans toucher aux autres lignes, et applique les valeurs tout de suite. */
export function writeSettings(values) {
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').split('\n') : [];
  for (const key of SETTINGS) {
    if (!(key in values)) continue;
    const v = String(values[key] ?? '').trim();
    if (SECRETS.has(key) && (v === '' || v.startsWith('••'))) continue; // secret inchangé
    if (/[\r\n]/.test(v)) throw new Error(`Valeur invalide pour ${key}`);
    const i = lines.findIndex(l => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${v}`; else lines.push(`${key}=${v}`);
    process.env[key] = v;
  }
  writeFileSync(ENV_FILE, lines.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n', { mode: 0o600 });
}
