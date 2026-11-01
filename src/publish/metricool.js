// Programmation des carrousels sur TikTok via Metricool (connecteur Metricool de Claude).
// Metricool dispose déjà de l'autorisation TikTok : aucune appli développeur à faire valider.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runClaude } from '../agent/claude.js';
import { ROOT } from '../config.js';
import { loadConfig, saveConfig } from '../editorial/post.js';
import { validatePost } from '../editorial/validate.js';
import { toJpeg } from '../images/compress.js';
import { writeCalendar } from '../planning/calendar.js';
import { uploadTemp } from './temphost.js';

const TOOLS = ['mcp__claude_ai_Metricool_Social_Media_Management__getBrandSettings', 'mcp__claude_ai_Metricool_Social_Media_Management__createScheduledPost'];
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

/** « 2026-11-05T18:00 » (heure locale) → « 2026-11-05T18:00:00+01:00 ». */
export function withOffset(local) {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error('Date de publication invalide');
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'), mm = String(Math.abs(off) % 60).padStart(2, '0');
  return `${local.slice(0, 16)}:00${sign}${hh}:${mm}`;
}

/** Extrait le premier objet JSON d'une réponse de Claude. */
function parseJson(text) {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error(`Réponse inattendue : ${text.slice(-300)}`);
  return JSON.parse(json);
}

/** Vérifie la connexion Metricool et renvoie le compte TikTok relié. */
export async function checkMetricool({ onLog } = {}) {
  const res = await runClaude(`Appelle l'outil getBrandSettings de Metricool. N'utilise aucun autre outil.
Réponds uniquement avec ce JSON : {"blogId": "<id de la marque qui a un compte TikTok>", "tiktok": "<nom du compte TikTok ou null>", "timezone": "<fuseau>"}`, { onLog, tools: [TOOLS[0]] });
  if (res.isError) throw new Error(res.text);
  return parseJson(res.text);
}

/**
 * Programme le carrousel d'un post sur TikTok.
 * @param {string} dir dossier du post
 * @param {{date: string, auto?: boolean, onLog?: (msg: string) => void}} opts date locale « AAAA-MM-JJTHH:mm » ;
 *   auto=false (par défaut) : Metricool envoie une notification sur son appli et tu publies toi-même (son tendance).
 * @returns {Promise<{plannerUrl: string, id: string}>}
 */
export async function scheduleOnTikTok(dir, { date, auto = false, onLog = () => {} }) {
  const cfg = loadConfig(dir);
  const { errors } = validatePost(dir, cfg);
  if (errors.length) throw new Error(`Contrôles éditoriaux en échec :\n- ${errors.join('\n- ')}`);
  const when = withOffset(date);
  if (new Date(when) <= new Date()) throw new Error('La date de publication est déjà passée');
  const slides = cfg.slides.map((_, i) => join(dir, `slide-${i + 1}.png`));
  if (!slides.every(existsSync)) throw new Error('Slides absentes : génère-les d\'abord');

  onLog('Préparation des images (JPEG)…');
  const tmp = join(ROOT, '.studio', 'envoi');
  mkdirSync(tmp, { recursive: true });
  const urls = [];
  for (const [i, png] of slides.entries()) {
    const jpg = join(tmp, `slide-${i + 1}.jpg`);
    await toJpeg(png, jpg);
    urls.push(await uploadTemp(jpg));
    onLog(`Image ${i + 1}/${slides.length} en ligne`);
  }

  const info = {
    autoPublish: auto, draft: false, descendants: [], firstCommentText: '', hasNotReadNotes: false,
    media: urls, mediaAltText: [], providers: [{ network: 'tiktok' }],
    publicationDate: { dateTime: `${date.slice(0, 16)}:00`, timezone: TIMEZONE },
    shortener: false, smartLinkData: { ids: [] },
    text: readFileSync(join(dir, 'legende.txt'), 'utf8').trim(),
    tiktokData: {
      disableComment: false, disableDuet: false, disableStitch: false, privacyOption: 'PUBLIC_TO_EVERYONE',
      commercialContentThirdParty: false, commercialContentOwnBrand: false,
      title: cfg.slides[0].title.slice(0, 90), autoAddMusic: false, photoCoverIndex: 0, isAigc: false,
    },
  };
  onLog('Programmation dans Metricool…');
  const res = await runClaude(`Programme un carrousel TikTok dans Metricool. N'utilise que les outils getBrandSettings et createScheduledPost, et ne modifie aucune valeur ci-dessous.
1. Appelle getBrandSettings et prends l'id (blogId) de la marque qui a un compte TikTok.
2. Appelle createScheduledPost avec ce blogId, date = "${when}" et info = exactement ce JSON :
${JSON.stringify(info)}
3. Réponds uniquement avec ce JSON : {"plannerUrl": "<plannerUrl renvoyé>", "id": "<id renvoyé>", "tiktok": "<nom du compte TikTok>"}
En cas d'erreur de Metricool, réponds uniquement : {"error": "<message exact>"}`, { onLog, tools: TOOLS });
  const out = parseJson(res.text);
  if (res.isError || out.error) throw new Error(`Metricool : ${out.error ?? res.text}`);

  saveConfig(dir, { ...loadConfig(dir), statut: 'programmé', programmation: { date: when, auto, plannerUrl: out.plannerUrl, id: String(out.id), compte: out.tiktok } });
  writeCalendar();
  return out;
}
