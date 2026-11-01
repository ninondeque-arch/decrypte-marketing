// Actions du pipeline, partagées par la ligne de commande et le studio local.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig } from './editorial/post.js';
import { validatePost } from './editorial/validate.js';
import { compressPng } from './images/compress.js';
import { prepareCutouts } from './images/cutout.js';
import { writeCalendar } from './planning/calendar.js';
import { renderPost } from './render/render-post.js';
import { sendDraft, waitForInbox } from './tiktok/draft.js';
import { accessToken } from './tiktok/oauth.js';
import { pagesBaseUrl, publishMedia, waitUntilOnline } from './tiktok/pages.js';

const today = () => new Date().toISOString().slice(0, 10);

export const verify = dir => validatePost(dir, loadConfig(dir));

/**
 * Contrôles, détourage, rendu des PNG, compression, calendrier.
 * @returns {{errors: string[], warnings: string[], rendered: boolean, files?: string[], gain?: number}}
 */
export async function generate(dir, { force = false } = {}) {
  const cfg = loadConfig(dir);
  const report = validatePost(dir, cfg);
  if (report.errors.length && !force) return { ...report, rendered: false };
  report.warnings.push(...prepareCutouts(dir, cfg));
  const files = await renderPost(dir, cfg);
  const gains = await Promise.all(files.map(compressPng));
  // cfg a été enrichi en mémoire (détourages) : on relit le fichier avant d'écrire le statut.
  if (!report.errors.length && cfg.statut === 'à rédiger') saveConfig(dir, { ...loadConfig(dir), statut: 'prêt' });
  writeCalendar();
  return { ...report, rendered: true, files, gain: Math.round(gains.reduce((a, b) => a + b, 0) / gains.length) };
}

/**
 * Envoie le carrousel et sa légende dans la boîte de réception TikTok.
 * @param {(msg: string) => void} log
 * @returns {Promise<string>} statut TikTok final
 */
export async function draft(dir, { push = true, log = console.log } = {}) {
  const cfg = loadConfig(dir);
  const { errors } = validatePost(dir, cfg);
  if (errors.length) throw new Error(`Contrôles éditoriaux en échec :\n- ${errors.join('\n- ')}`);
  const slides = cfg.slides.map((_, i) => join(dir, `slide-${i + 1}.png`));
  if (!slides.every(existsSync)) throw new Error('Slides absentes : génère-les d\'abord');
  // Vérifications avant tout envoi : configuration et connexion TikTok
  pagesBaseUrl();
  await accessToken();
  const urls = await publishMedia(dir, slides, { push });
  log('Attente de la mise en ligne sur GitHub Pages…');
  await waitUntilOnline(urls);
  log('Envoi à TikTok…');
  const publishId = await sendDraft({ title: cfg.slides[0].title, description: readFileSync(join(dir, 'legende.txt'), 'utf8').trim(), imageUrls: urls });
  const status = await waitForInbox(publishId);
  saveConfig(dir, { ...loadConfig(dir), statut: 'brouillon', brouillon: { date: today(), publish_id: publishId } });
  writeCalendar();
  return status;
}

export function markPublished(dir) {
  saveConfig(dir, { ...loadConfig(dir), statut: 'publié', publie: today() });
  writeCalendar();
}
