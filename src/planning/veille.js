// Veille quotidienne et rédaction déléguées à Claude Code.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { runClaude } from '../agent/claude.js';
import { ROOT } from '../config.js';
import { listPosts } from '../editorial/post.js';

export const VEILLE_DIR = join(ROOT, 'veille');
export const today = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-JJ, heure locale

export function listVeilles() {
  if (!existsSync(VEILLE_DIR)) return [];
  return readdirSync(VEILLE_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => f.slice(0, 10)).sort().reverse();
}

export function loadVeille(date) {
  const file = join(VEILLE_DIR, `${date}.json`);
  if (!existsSync(file)) return null;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  // Relie les sujets aux posts déjà créés, et ignore les liens vers des posts supprimés
  const posts = new Set(listPosts().map(p => basename(p)));
  for (const s of data.sujets ?? []) if (s.post && !posts.has(s.post)) delete s.post;
  return data;
}

function saveVeille(date, data) {
  mkdirSync(VEILLE_DIR, { recursive: true });
  writeFileSync(join(VEILLE_DIR, `${date}.json`), JSON.stringify(data, null, 2) + '\n');
}

/** Lance la veille du jour (quelques minutes). */
export async function runVeille({ date = today(), onLog } = {}) {
  const res = await runClaude(`/veille ${date}`, { onLog });
  const data = loadVeille(date);
  if (res.isError || !data?.sujets?.length) throw new Error(`La veille n'a pas produit de sujets. ${res.text.slice(-300)}`);
  return `${data.sujets.length} sujets proposés`;
}

/**
 * Rédige et génère un post complet à partir d'un sujet (5 à 15 minutes).
 * @returns {Promise<string>} nom du dossier du post créé
 */
export async function runRediger({ sujet, angle, sources = [], veille, onLog }) {
  const started = Date.now();
  const context = [
    sujet,
    angle && `Angle proposé : ${angle}`,
    sources.length && `Sources de départ : ${sources.map(s => s.url).join(' ')}`,
  ].filter(Boolean).join('. ');
  const res = await runClaude(`/rediger ${context}`, { onLog, chrome: true });
  let slug = res.text.match(/POST:\s*([\w.-]+)/)?.[1];
  if (!slug || !existsSync(join(ROOT, 'posts', slug))) {
    // Repli : le dossier de post créé pendant la tâche
    slug = listPosts().filter(p => statSync(join(p, 'slides-config.json')).birthtimeMs >= started).map(p => basename(p)).pop();
  }
  if (!slug) throw new Error(`Aucun post créé. ${res.text.slice(-400)}`);
  if (veille) {
    const data = loadVeille(veille.date);
    const s = data?.sujets.find(x => x.id === veille.id);
    if (s) { s.post = slug; saveVeille(veille.date, data); }
  }
  return slug;
}
