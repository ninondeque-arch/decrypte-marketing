// Retour des performances : stats TikTok de chaque post publié (connecteur Metricool de Claude),
// enregistrées dans posts/<dossier>/stats.json, puis synthèse dans performances.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { runClaude } from '../agent/claude.js';
import { ROOT } from '../config.js';
import { listPosts, loadConfig, postDate } from '../editorial/post.js';

export const STATS_FILE = 'stats.json';
export const PERFORMANCES_FILE = join(ROOT, 'performances.md');

const TOOLS = ['mcp__claude_ai_Metricool_Social_Media_Management__getBrandSettings', 'mcp__claude_ai_Metricool_Social_Media_Management__getAnalyticsDataByMetrics'];
/** Champs Metricool des vidéos TikTok : date et heure, lien, description, vues, j'aime, commentaires, partages. */
export const METRICS = ['TKPO02', 'TKPO03', 'TKPO05', 'TKPO07', 'TKPO08', 'TKPO09', 'TKPO10'];

/** Texte comparable : minuscules, sans accents, emojis, ponctuation ni hashtags. */
export const normalize = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/#[\p{L}\p{N}_]+/gu, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const num = v => { const n = Number(String(v ?? 0).replace(/[\s ]/g, '')); return Number.isFinite(n) ? n : 0; };

/** Taux de j'aime par vue, en % arrondi à 0,1. */
export const likeRate = s => (s.vues ? Math.round((s.jaime / s.vues) * 1000) / 10 : 0);

/** Type d'accroche, pour comparer ce qui marche. */
export function hookType(title = '') {
  const t = title.trim();
  if (/\d/.test(t)) return 'chiffre';
  if (/^[«"“]/.test(t)) return 'citation';
  if (/\?\s*$/.test(t)) return 'question';
  return 'affirmation / paradoxe';
}

/** « 20261115165414 », « 2026-11-15 18:02 » ou ISO → « 2026-11-15 ». */
export function dayOf(date) {
  const d = String(date ?? '').replace(/\D/g, '');
  return d.length >= 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '';
}

/** Mots porteurs de sens (4 lettres ou plus), pour comparer deux légendes. */
const words = text => new Set(normalize(text).split(' ').filter(w => w.length >= 4));

/**
 * Ressemblance entre la légende d'un post et la description d'une vidéo, de 0 à 1 : part des mots
 * en commun. Tolère une légende retouchée ou tronquée au moment de publier.
 */
export function similarity(legende, description) {
  const a = words(legende), b = words(description);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common < 4 ? 0 : common / Math.min(a.size, b.size);
}

const MIN_SIMILARITY = 0.3;

/**
 * Attribue à chaque post sa vidéo TikTok : les paires les plus ressemblantes d'abord, une vidéo par post ;
 * à défaut de texte, la seule vidéo restante publiée l'un des jours possibles.
 * @param {{slug: string, legende: string, jours: string[]}[]} posts jours = dates possibles de publication (AAAA-MM-JJ)
 * @param {object[]} videos vidéos Metricool
 * @returns {Map<string, object>} slug → vidéo
 */
export function matchVideos(posts, videos) {
  const pairs = posts.flatMap(p => videos.map(v => ({ p, v, score: similarity(p.legende, v.description) })))
    .filter(x => x.score >= MIN_SIMILARITY).sort((a, b) => b.score - a.score);
  const out = new Map(), used = new Set();
  for (const { p, v } of pairs) if (!out.has(p.slug) && !used.has(v)) { out.set(p.slug, v); used.add(v); }
  for (const p of posts.filter(x => !out.has(x.slug))) {
    for (const jour of p.jours) {
      const sameDay = videos.filter(v => !used.has(v) && dayOf(v.date) === jour);
      if (sameDay.length === 1) { out.set(p.slug, sameDay[0]); used.add(sameDay[0]); break; }
    }
  }
  return out;
}

/** Extrait le premier objet JSON d'une réponse de Claude. */
function parseJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Réponse inattendue : ${text.slice(-300)}`);
  return JSON.parse(text.slice(start, end + 1));
}

/** Demande à Metricool les vidéos TikTok publiées entre deux dates (AAAA-MM-JJ). */
export async function fetchTikTokVideos({ from, to, onLog = () => {}, run = runClaude }) {
  const res = await run(`Récupère les statistiques des vidéos TikTok dans Metricool. N'utilise que les outils getBrandSettings et getAnalyticsDataByMetrics, en lecture seule.
1. Appelle getBrandSettings et prends l'id de la marque qui a un compte TikTok.
2. Appelle getAnalyticsDataByMetrics avec ce brandId, from = "${from}T00:00:00+00:00", to = "${to}T23:59:59+00:00" et metrics = ${JSON.stringify(METRICS)}.
3. Réponds uniquement avec ce JSON, une entrée par vidéo, en recopiant les valeurs sans les modifier ni en inventer :
{"tiktok": "<nom du compte>", "videos": [{"date": "<date et heure de publication>", "url": "<lien>", "description": "<description complète>", "vues": 0, "jaime": 0, "commentaires": 0, "partages": 0}]}
En cas d'erreur de Metricool, réponds uniquement : {"error": "<message exact>"}`, { onLog, tools: TOOLS });
  const out = parseJson(res.text);
  if (res.isError || out.error) throw new Error(`Metricool : ${out.error ?? res.text}`);
  if (!Array.isArray(out.videos)) throw new Error('Metricool : liste de vidéos absente');
  return out.videos.map(v => ({ date: String(v.date ?? ''), url: v.url ? String(v.url).split('?')[0] : null, description: String(v.description ?? ''),
    vues: num(v.vues), jaime: num(v.jaime), commentaires: num(v.commentaires), partages: num(v.partages) }));
}

export const readStats = dir => (existsSync(join(dir, STATS_FILE)) ? JSON.parse(readFileSync(join(dir, STATS_FILE), 'utf8')) : null);

/** Fiche d'un post pour la synthèse : ce qui le décrit et ses stats. */
export function postEntry(dir) {
  const cfg = loadConfig(dir);
  return { slug: basename(dir), sujet: cfg.sujet, rubrique: cfg.rubrique, secteur: cfg.secteur, startup: !!cfg.startup,
    accroche: cfg.slides?.[0]?.title ?? '', typeAccroche: hookType(cfg.slides?.[0]?.title), stats: readStats(dir) };
}

const fr = n => n.toLocaleString('fr-FR');
const quote = t => (/^[«"“]/.test(t) ? t : `« ${t} »`);
const pct = n => `${String(n).replace('.', ',')} %`;

/** Valeurs les plus fréquentes d'un champ, ex. « Beauté (2/2) ». */
function common(entries, key) {
  const counts = new Map();
  for (const e of entries) if (e[key] != null) counts.set(e[key], (counts.get(e[key]) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  return [...counts].filter(([, n]) => n === max).map(([v]) => `${v} (${max}/${entries.length})`).join(', ') || '—';
}

/**
 * Synthèse lue par la veille et le juge : classement, taux de j'aime, points communs des meilleurs posts.
 * @param {object[]} entries fiches de postEntry()
 */
export function buildPerformances(entries, now = new Date()) {
  const ranked = entries.filter(e => e.stats).sort((a, b) => b.stats.vues - a.stats.vues);
  const lines = ['# Performances des posts', '', `Relevé du ${now.toLocaleDateString('fr-FR', { dateStyle: 'long' })} (stats TikTok via Metricool, \`npm run stats\`). Fichier régénéré à chaque relevé : ne pas modifier à la main.`, ''];
  if (!ranked.length) return [...lines, 'Aucune stat pour l\'instant : publie des posts puis relance `npm run stats`.', ''].join('\n');

  const median = ranked[Math.floor((ranked.length - 1) / 2)].stats.vues;
  const total = ranked.reduce((a, e) => a + e.stats.vues, 0);
  lines.push(`${ranked.length} posts · ${fr(total)} vues au total · médiane ${fr(median)} vues · taux de j'aime moyen ${pct(likeRate(ranked.reduce((a, e) => ({ vues: a.vues + e.stats.vues, jaime: a.jaime + e.stats.jaime }), { vues: 0, jaime: 0 })))}`, '');

  lines.push('## Classement', '', '| # | Post | Vues | J\'aime | Taux j\'aime/vue | Commentaires | Partages | Rubrique | Secteur | Accroche |', '|---|---|---|---|---|---|---|---|---|---|');
  ranked.forEach((e, i) => {
    const s = e.stats;
    lines.push(`| ${i + 1} | ${e.sujet} | ${fr(s.vues)} | ${fr(s.jaime)} | ${pct(likeRate(s))} | ${fr(s.commentaires)} | ${fr(s.partages)} | ${e.rubrique} | ${e.secteur} | ${quote(e.accroche)} (${e.typeAccroche}) |`);
  });

  // Les meilleurs : le premier tiers, au moins 1 post, et toujours au-dessus de la médiane
  const top = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 3))).filter((e, i) => i === 0 || e.stats.vues > median);
  const rest = ranked.slice(top.length);
  const avg = list => (list.length ? Math.round(list.reduce((a, e) => a + e.stats.vues, 0) / list.length) : 0);
  lines.push('', '## Ce qu\'ont en commun les meilleurs posts', '',
    `${top.length > 1 ? `Les ${top.length} meilleurs posts (${top.map(e => e.sujet).join(' ; ')}) font en moyenne` : `Le meilleur post (${top[0].sujet}) fait`} ${fr(avg(top))} vues, contre ${fr(avg(rest))} en moyenne pour les autres.`, '',
    `- **Rubrique** : ${common(top, 'rubrique')}`,
    `- **Secteur** : ${common(top, 'secteur')}`,
    `- **Type d'accroche** : ${common(top, 'typeAccroche')}`,
    `- **Accroches** : ${top.map(e => quote(e.accroche)).join(' ; ')}`,
    `- **Taux de j'aime par vue** : ${top.map(e => pct(likeRate(e.stats))).join(', ')}`);
  const missing = entries.filter(e => !e.stats).map(e => e.slug);
  if (missing.length) lines.push('', `Posts publiés sans stats retrouvées : ${missing.join(', ')}.`);
  lines.push('', `À lire avec prudence : ${ranked.length} post${ranked.length > 1 ? 's' : ''} seulement, une tendance n'est pas une règle.`, '');
  return lines.join('\n');
}

/** Régénère performances.md à partir des stats.json existants. */
export function writePerformances(now = new Date()) {
  const entries = listPosts().filter(d => loadConfig(d).statut === 'publié').map(postEntry);
  writeFileSync(PERFORMANCES_FILE, buildPerformances(entries, now));
  return entries;
}

/**
 * Relève les stats de tous les posts publiés, écrit les stats.json et performances.md.
 * @returns {Promise<{trouves: string[], manquants: string[]}>}
 */
export async function runStats({ onLog = () => {}, run = runClaude, now = new Date() } = {}) {
  const dirs = listPosts().filter(d => loadConfig(d).statut === 'publié');
  if (!dirs.length) throw new Error('Aucun post marqué « publié » : rien à relever');
  const jours = dir => { const c = loadConfig(dir); return [c.publie, postDate(dir)].filter(Boolean); };
  const first = dirs.flatMap(jours).sort()[0];
  const from = new Date(`${first}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 3); // marge : publication manuelle avant la date prévue
  onLog(`📈 Stats TikTok de ${dirs.length} posts publiés (Metricool)…`);
  const videos = await fetchTikTokVideos({ from: from.toISOString().slice(0, 10), to: now.toLocaleDateString('sv-SE'), onLog, run });
  onLog(`${videos.length} vidéos TikTok trouvées dans Metricool`);

  const posts = dirs.map(dir => ({ slug: basename(dir), dir, jours: jours(dir),
    legende: existsSync(join(dir, 'legende.txt')) ? readFileSync(join(dir, 'legende.txt'), 'utf8') : '' }));
  const matches = matchVideos(posts, videos);
  const trouves = [], manquants = [];
  for (const { slug, dir } of posts) {
    const v = matches.get(slug);
    if (!v) { manquants.push(slug); continue; }
    const stats = { releve: now.toISOString(), publie_le: dayOf(v.date) || v.date, url: v.url, vues: v.vues, jaime: v.jaime, commentaires: v.commentaires, partages: v.partages };
    writeFileSync(join(dir, STATS_FILE), JSON.stringify({ ...stats, taux_jaime: likeRate(stats) }, null, 2) + '\n');
    trouves.push(slug);
  }
  writePerformances(now);
  return { trouves, manquants };
}
