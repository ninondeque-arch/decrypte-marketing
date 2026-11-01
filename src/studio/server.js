// Studio local : interface web pour la veille, la rédaction, la retouche et l'envoi des posts.
// Écoute uniquement sur 127.0.0.1 (jamais exposé au réseau).
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, normalize, sep } from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { toJpeg } from '../images/compress.js';
import { draft, generate, markPublished, verify } from '../actions.js';
import { ASSETS_DIR, ROOT, TOKENS_FILE } from '../config.js';
import { listPosts, loadConfig, postDate, saveConfig } from '../editorial/post.js';
import { createPost } from '../editorial/create.js';
import { suggestCaptions } from '../agent/caption.js';
import { authorization, connectedUser, exchangeCode, logout } from '../tiktok/oauth.js';
import { readSettings, writeSettings } from './settings.js';
import { install, isInstalled, uninstall } from './service.js';
import { checkMetricool, scheduleOnTikTok } from '../publish/metricool.js';
import { git } from '../tiktok/pages.js';
import { PAGES_DIR } from '../config.js';
import { varietyAlerts, writeCalendar } from '../planning/calendar.js';
import { listVeilles, loadVeille, runRediger, runVeille, today } from '../planning/veille.js';
import { getJob, isRunning, recentJobs, startJob } from './jobs.js';

const PORT = Number(process.env.STUDIO_PORT) || 4321;
const veilleHour = () => Number(process.env.VEILLE_HEURE || 8); // veille automatique chaque jour à partir de cette heure
const UI_DIR = join(ROOT, 'src/studio/ui');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const httpError = (status, msg) => Object.assign(new Error(msg), { status });

/** Post par nom de dossier exact (aucune résolution floue côté serveur). */
function postDir(slug) {
  const dir = listPosts().find(p => basename(p) === slug);
  if (!dir) throw httpError(404, `Post inconnu : ${slug}`);
  return dir;
}

/** Fichier à l'intérieur de `base`, sans possibilité d'en sortir. */
function safeJoin(base, rel) {
  const full = normalize(join(base, rel));
  if (!full.startsWith(base + sep)) throw httpError(403, 'Chemin refusé');
  return full;
}

function summary(dir) {
  const cfg = loadConfig(dir);
  const cover = existsSync(join(dir, 'slide-1.png')) ? statSync(join(dir, 'slide-1.png')).mtimeMs : 0;
  return { slug: basename(dir), date: postDate(dir), sujet: cfg.sujet, rubrique: cfg.rubrique, secteur: cfg.secteur, startup: !!cfg.startup, statut: cfg.statut, slides: cfg.slides.length, cover };
}

function detail(dir) {
  const read = f => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : '');
  const imgDir = join(dir, 'images');
  const images = existsSync(imgDir) ? readdirSync(imgDir).filter(f => IMAGE_EXT.has(extname(f).toLowerCase())).sort().map(f => `images/${f}`) : [];
  const rendered = existsSync(join(dir, 'slide-1.png')) ? statSync(join(dir, 'slide-1.png')).mtimeMs : 0;
  return { ...summary(dir), config: loadConfig(dir), legende: read('legende.txt'), sources: read('sources.md'), images, rendered, validation: verify(dir) };
}

// ---------- tâches Claude Code ----------
function launchVeille(date = today()) {
  return startJob({ kind: 'veille', label: `Veille du ${date}`, agent: true, meta: { date } }, log => runVeille({ date, onLog: log }));
}

function launchRediger({ sujet, angle, sources, veille }) {
  if (!sujet?.trim()) throw httpError(400, 'Sujet manquant');
  return startJob({ kind: 'rediger', label: `Rédaction : ${sujet}`, agent: true, meta: { veille, sujet } },
    log => runRediger({ sujet: sujet.trim(), angle, sources, veille, onLog: log }));
}

/** Veille automatique : une fois par jour, à partir de VEILLE_HOUR (rattrapée au réveil de l'ordinateur). */
let lastAutoVeille = null;
function scheduleVeille() {
  const d = today();
  if (new Date().getHours() < veilleHour() || lastAutoVeille === d || loadVeille(d)) return;
  if (isRunning(j => j.kind === 'veille')) return;
  lastAutoVeille = d;
  console.log(`[veille] lancement automatique pour le ${d}`);
  launchVeille(d);
}

/** Prochain jour sans post, à partir de demain. */
function nextFreeDate() {
  const taken = new Set(listPosts().map(postDate));
  const d = new Date();
  do d.setDate(d.getDate() + 1); while (taken.has(d.toLocaleDateString('sv-SE')));
  return d.toLocaleDateString('sv-SE');
}

// Dernière vérification du compte Metricool (compte TikTok relié)
const METRICOOL_FILE = join(ROOT, '.studio', 'metricool.json');
mkdirSync(join(ROOT, '.studio'), { recursive: true });
let metricoolState = existsSync(METRICOOL_FILE) ? JSON.parse(readFileSync(METRICOOL_FILE, 'utf8')) : null;

// Connexion TikTok en cours (une seule à la fois)
let pendingAuth = null;

async function rawBody(req, max = 25 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > max) throw httpError(413, 'Image trop lourde (25 Mo maximum)'); chunks.push(c); }
  return Buffer.concat(chunks);
}

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

const routes = [
  ['GET', /^\/api\/posts$/, () => {
    const dirs = listPosts();
    return { posts: dirs.map(summary).reverse(), alerts: varietyAlerts(dirs.map(loadConfig)), nextDate: nextFreeDate() };
  }],
  ['POST', /^\/api\/posts$/, async (m, req) => {
    const slug = createPost(await body(req));
    writeCalendar();
    return detail(postDir(slug));
  }],
  ['POST', /^\/api\/posts\/([^/]+)\/images$/, async (m, req) => {
    const dir = postDir(m[1]);
    const original = decodeURIComponent(req.headers['x-filename'] ?? 'image.jpg');
    const ext = extname(original).toLowerCase();
    if (!IMAGE_EXT.has(ext)) throw httpError(400, 'Formats acceptés : JPG, PNG, WebP');
    const data = await rawBody(req);
    const base = basename(original, extname(original)).normalize('NFD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'image';
    mkdirSync(join(dir, 'images'), { recursive: true });
    let name = `${base}${ext}`;
    for (let n = 2; existsSync(join(dir, 'images', name)); n++) name = `${base}-${n}${ext}`;
    writeFileSync(join(dir, 'images', name), data);
    return { src: `images/${name}`, images: detail(dir).images };
  }],
  ['POST', /^\/api\/posts\/([^/]+)\/legendes$/, async m => ({ legendes: await suggestCaptions(postDir(m[1])) })],
  ['GET', /^\/api\/etat$/, () => ({
    tiktokConfigure: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI', 'PAGES_BASE_URL'].every(k => process.env[k]),
    tiktokConnecte: existsSync(TOKENS_FILE),
    veilleHeure: veilleHour(),
  })],
  ['GET', /^\/api\/posts\/([^/]+)$/, m => detail(postDir(m[1]))],
  ['PUT', /^\/api\/posts\/([^/]+)$/, async (m, req) => {
    const dir = postDir(m[1]);
    const { config, legende, sources } = await body(req);
    if (config) saveConfig(dir, config);
    if (typeof legende === 'string') writeFileSync(join(dir, 'legende.txt'), legende.trimEnd() + '\n');
    if (typeof sources === 'string') writeFileSync(join(dir, 'sources.md'), sources.trimEnd() + '\n');
    writeCalendar();
    return detail(dir);
  }],
  ['POST', /^\/api\/posts\/([^/]+)\/generer$/, async (m, req) => {
    const dir = postDir(m[1]);
    const { force } = await body(req);
    const res = await generate(dir, { force });
    return { ...detail(dir), generation: { rendered: res.rendered, gain: res.gain, errors: res.errors, warnings: res.warnings } };
  }],
  ['POST', /^\/api\/posts\/([^/]+)\/brouillon$/, m => {
    const dir = postDir(m[1]);
    return startJob({ kind: 'brouillon', label: `Envoi TikTok : ${basename(dir)}`, meta: { slug: basename(dir) } }, log => draft(dir, { log }));
  }],
  ['POST', /^\/api\/posts\/([^/]+)\/programmer$/, async (m, req) => {
    const dir = postDir(m[1]);
    const { date, auto } = await body(req);
    return startJob({ kind: 'programmer', label: `Programmation TikTok : ${loadConfig(dir).sujet}`, agent: true, meta: { slug: basename(dir) } },
      log => scheduleOnTikTok(dir, { date, auto: !!auto, onLog: log }));
  }],
  ['GET', /^\/api\/metricool$/, () => metricoolState],
  ['POST', /^\/api\/metricool\/verifier$/, () => startJob({ kind: 'metricool', label: 'Vérification de Metricool', agent: true },
    async log => { const r = await checkMetricool({ onLog: log }); metricoolState = { ...r, verifie: new Date().toISOString() }; writeFileSync(METRICOOL_FILE, JSON.stringify(metricoolState)); return r; })],
  ['POST', /^\/api\/posts\/([^/]+)\/publie$/, m => { const dir = postDir(m[1]); markPublished(dir); return detail(dir); }],

  ['GET', /^\/api\/veille$/, (m, req, url) => {
    const dates = listVeilles();
    const date = url.searchParams.get('date') ?? dates[0] ?? null;
    return { dates, date, today: today(), veille: date ? loadVeille(date) : null };
  }],
  ['POST', /^\/api\/veille$/, async (m, req) => {
    if (isRunning(j => j.kind === 'veille')) throw httpError(409, 'Une veille est déjà en cours');
    const { date } = await body(req);
    return launchVeille(date || today());
  }],
  ['POST', /^\/api\/rediger$/, async (m, req) => launchRediger(await body(req))],

  ['GET', /^\/api\/reglages$/, () => readSettings()],
  ['PUT', /^\/api\/reglages$/, async (m, req) => { writeSettings(await body(req)); return readSettings(); }],
  ['GET', /^\/api\/tiktok$/, async () => {
    const env = k => !!process.env[k];
    const out = { cles: env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET'), redirection: env('TIKTOK_REDIRECT_URI'), pages: false, connecte: false, compte: null, erreur: null };
    if (process.env.PAGES_BASE_URL) {
      const res = await fetch(new URL('callback.html', process.env.PAGES_BASE_URL.replace(/\/?$/, '/')), { method: 'HEAD' }).catch(() => null);
      out.pages = res?.status === 200;
    }
    try { out.compte = await connectedUser(); out.connecte = !!out.compte; } catch (e) { out.erreur = e.message; }
    return out;
  }],
  ['POST', /^\/api\/tiktok\/connexion$/, () => { pendingAuth = authorization(); return { url: pendingAuth.url }; }],
  ['POST', /^\/api\/tiktok\/verification$/, async (m, req) => {
    // Fichier de vérification du préfixe d'URL fourni par TikTok : copié à la racine du site puis publié
    const name = basename(decodeURIComponent(req.headers['x-filename'] ?? ''));
    if (!/^[\w.-]+\.txt$/.test(name)) throw httpError(400, 'Choisis le fichier .txt fourni par TikTok');
    writeFileSync(join(PAGES_DIR, name), await rawBody(req, 64 * 1024));
    try {
      git('add', join('docs', name));
      git('commit', '-m', `Vérification TikTok : ${name}`);
      git('push');
      return { message: `Fichier publié. Attends 1 à 2 minutes puis clique sur « Verify » dans TikTok.` };
    } catch {
      return { message: `Fichier copié dans docs/${name}, mais pas encore publié sur GitHub (dépôt pas encore configuré ?).` };
    }
  }],
  ['POST', /^\/api\/tiktok\/deconnexion$/, () => { logout(); return { ok: true }; }],

  ['GET', /^\/api\/service$/, () => ({ installe: isInstalled() })],
  ['POST', /^\/api\/service$/, () => { install(); return { installe: true }; }],
  ['DELETE', /^\/api\/service$/, () => { uninstall(); return { installe: false }; }],
  ['GET', /^\/api\/guide$/, () => ({ markdown: readFileSync(join(ROOT, 'guides/tiktok.md'), 'utf8') })],

  ['GET', /^\/api\/jobs$/, () => recentJobs()],
  ['GET', /^\/api\/jobs\/([\w-]+)$/, m => getJob(m[1]) ?? (() => { throw httpError(404, 'Tâche inconnue'); })()],
];

function sendFile(res, file) {
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end('Introuvable'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(file));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = decodeURIComponent(url.pathname);
  try {
    for (const [method, re, handler] of routes) {
      const m = path.match(re);
      if (m && req.method === method) {
        const out = await handler(m, req, url);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(out));
        return;
      }
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (path === '/tiktok/callback') {
      let result = 'ok';
      try {
        if (url.searchParams.get('error')) throw new Error(url.searchParams.get('error_description') ?? url.searchParams.get('error'));
        if (!pendingAuth || url.searchParams.get('state') !== pendingAuth.state) throw new Error('Demande de connexion expirée : recommence depuis Réglages');
        await exchangeCode(url.searchParams.get('code'), pendingAuth);
      } catch (e) { result = e.message; }
      pendingAuth = null;
      res.writeHead(302, { Location: `/#/reglages?tiktok=${encodeURIComponent(result)}` }).end();
      return;
    }
    let m;
    if ((m = path.match(/^\/media\/([^/]+)\/(.+)$/))) return sendFile(res, safeJoin(postDir(m[1]), m[2]));
    if ((m = path.match(/^\/telecharger\/([^/]+)$/))) {
      // ZIP des slides en JPEG (numérotées) + légende, prêt à publier à la main
      const dir = postDir(m[1]), slug = basename(dir);
      const slides = loadConfig(dir).slides.map((_, i) => join(dir, `slide-${i + 1}.png`));
      if (!slides.every(existsSync)) throw httpError(409, 'Génère d’abord les slides');
      const out = join(ROOT, '.studio', 'export', slug);
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      const files = [];
      for (const [i, png] of slides.entries()) {
        const jpg = join(out, `${slug}-${String(i + 1).padStart(2, '0')}.jpg`);
        await toJpeg(png, jpg);
        files.push(jpg);
      }
      if (existsSync(join(dir, 'legende.txt'))) { writeFileSync(join(out, 'legende.txt'), readFileSync(join(dir, 'legende.txt'))); files.push(join(out, 'legende.txt')); }
      const zip = join(out, `${slug}.zip`);
      execFileSync('zip', ['-j', '-q', zip, ...files]);
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${slug}.zip"` });
      res.end(readFileSync(zip));
      return;
    }
    if ((m = path.match(/^\/fonts\/([\w.-]+)$/))) return sendFile(res, safeJoin(join(ASSETS_DIR, 'fonts'), m[1]));
    return sendFile(res, safeJoin(UI_DIR, path === '/' ? 'index.html' : path.slice(1)));
  } catch (err) {
    res.writeHead(err.status ?? 500, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: err.message }));
  }
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') console.log(`Le studio tourne déjà : http://localhost:${PORT}`);
  else console.error(err);
  process.exit(err.code === 'EADDRINUSE' ? 0 : 1);
});

server.listen(PORT, '127.0.0.1', () => {
  const address = `http://localhost:${PORT}`;
  console.log(`🎛  Studio ouvert sur ${address}  (veille automatique chaque jour à partir de ${veilleHour()} h)`);
  if (!process.env.STUDIO_NO_OPEN) execFile('open', [address], () => {});
  scheduleVeille();
  setInterval(scheduleVeille, 10 * 60_000);
});
