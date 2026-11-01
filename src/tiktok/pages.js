// Hébergement des JPEG sur GitHub Pages : TikTok ne prend les photos que par URL vérifiée (PULL_FROM_URL).
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PAGES_DIR, ROOT } from '../config.js';
import { toJpeg } from '../images/compress.js';

export const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

export function pagesBaseUrl() {
  const base = process.env.PAGES_BASE_URL;
  if (!base) throw new Error('PAGES_BASE_URL absent du .env (ex. https://ton-compte.github.io/decrypte-marketing/)');
  return base.endsWith('/') ? base : base + '/';
}

/**
 * Exporte les slides en JPEG dans docs/m/<post>/, les pousse sur GitHub
 * et renvoie leurs URL publiques.
 */
export async function publishMedia(postDir, slideFiles, { push = true } = {}) {
  const slug = basename(postDir);
  const outDir = join(PAGES_DIR, 'm', slug);
  mkdirSync(outDir, { recursive: true });
  const names = [];
  for (const [i, png] of slideFiles.entries()) {
    const name = `slide-${i + 1}.jpg`;
    await toJpeg(png, join(outDir, name));
    names.push(name);
  }
  if (push) {
    git('add', join('docs', 'm', slug));
    const staged = git('diff', '--cached', '--name-only');
    if (staged) git('commit', '-m', `Médias TikTok : ${slug}`);
    console.log('Envoi des images sur GitHub…');
    git('push');
  }
  return names.map(n => `${pagesBaseUrl()}m/${encodeURIComponent(slug)}/${n}`);
}

/** Attend que GitHub Pages serve toutes les images (le déploiement prend en général 1 à 2 minutes). */
export async function waitUntilOnline(urls, timeoutMs = 5 * 60_000) {
  const start = Date.now();
  for (const url of urls) {
    for (;;) {
      const res = await fetch(url, { method: 'HEAD', redirect: 'manual' }).catch(() => null);
      if (res?.status === 200) break;
      if (Date.now() - start > timeoutMs) throw new Error(`Image toujours inaccessible après 5 min : ${url}`);
      await new Promise(r => setTimeout(r, 10_000));
    }
  }
}
