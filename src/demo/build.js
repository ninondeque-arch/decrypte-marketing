// Construit demo/ : le vrai studio en version statique, avec les données réelles figées
// et les actions payantes désactivées (déployé sur Vercel).
// Usage : npm run demo:build
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ASSETS_DIR, ROOT } from '../config.js';
import { listPosts, loadConfig, postDate } from '../editorial/post.js';
import { validatePost } from '../editorial/validate.js';
import { toJpeg } from '../images/compress.js';
import { varietyAlerts } from '../planning/calendar.js';
import { listVeilles, loadVeille } from '../planning/veille.js';

const OUT = join(ROOT, 'demo');
const UI = join(ROOT, 'src/studio/ui');
const REPO = 'https://github.com/ninondeque-arch/decrypte-marketing';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'fonts'), { recursive: true });
mkdirSync(join(OUT, 'telecharger'), { recursive: true });

// Interface du studio, identique à la version locale
copyFileSync(join(UI, 'app.js'), join(OUT, 'app.js'));
copyFileSync(join(UI, 'styles.css'), join(OUT, 'styles.css'));
copyFileSync(join(ROOT, 'src/demo/demo-api.js'), join(OUT, 'demo-api.js'));
for (const f of ['Anton.ttf', 'Inter.ttf']) copyFileSync(join(ASSETS_DIR, 'fonts', f), join(OUT, 'fonts', f));

const banner = `<div class="demo-banner" role="note"><strong>Mode démo</strong> · interface et données réelles · les actions qui appellent Claude, Metricool ou le moteur de rendu sont désactivées · <a href="${REPO}" target="_blank" rel="noopener">voir le code sur GitHub</a></div>
<style>.demo-banner{background:#FFE14D;color:#111;font:600 13px/1.4 Inter,system-ui,sans-serif;padding:9px max(16px,env(safe-area-inset-left,0px));text-align:center}.demo-banner a{color:#111}</style>`;
const html = readFileSync(join(UI, 'index.html'), 'utf8')
  .replace('<body>', `<body>\n${banner}`)
  .replace('<script src="/app.js" type="module"></script>', '<script src="/demo-data.js"></script>\n<script src="/demo-api.js"></script>\n<script src="/app.js" type="module"></script>')
  .replace('<title>Décrypte Studio</title>', '<title>Décrypte Studio · démo</title>\n<meta name="description" content="Démo du studio Décrypte : veille marketing, carrousels TikTok sourcés aux couleurs des marques.">');
writeFileSync(join(OUT, 'index.html'), html);

// Données réelles figées
const posts = {};
for (const dir of listPosts()) {
  const slug = basename(dir), cfg = loadConfig(dir);
  const slides = cfg.slides.map((_, i) => join(dir, `slide-${i + 1}.png`));
  if (!slides.every(existsSync)) continue;
  mkdirSync(join(OUT, 'media', slug), { recursive: true });
  slides.forEach((s, i) => copyFileSync(s, join(OUT, 'media', slug, `slide-${i + 1}.png`)));
  // ZIP du bouton « Télécharger »
  const tmp = join(OUT, 'telecharger', slug);
  mkdirSync(tmp, { recursive: true });
  const files = [];
  for (const [i, s] of slides.entries()) { const j = join(tmp, `${slug}-${String(i + 1).padStart(2, '0')}.jpg`); await toJpeg(s, j); files.push(j); }
  if (existsSync(join(dir, 'legende.txt'))) { copyFileSync(join(dir, 'legende.txt'), join(tmp, 'legende.txt')); files.push(join(tmp, 'legende.txt')); }
  execFileSync('zip', ['-j', '-q', join(OUT, 'telecharger', `${slug}.zip`), ...files]);
  rmSync(tmp, { recursive: true });
  // Le lien Metricool est privé : retiré de la démo
  const config = structuredClone(cfg);
  if (config.programmation) delete config.programmation.plannerUrl;
  posts[slug] = {
    slug, date: postDate(dir), config, images: [],
    legende: existsSync(join(dir, 'legende.txt')) ? readFileSync(join(dir, 'legende.txt'), 'utf8') : '',
    sources: existsSync(join(dir, 'sources.md')) ? readFileSync(join(dir, 'sources.md'), 'utf8') : '',
    rendered: Math.round(statSync(slides[0]).mtimeMs), validation: validatePost(dir, cfg),
  };
}
const veilleDates = listVeilles();
const data = {
  posts,
  alerts: varietyAlerts(listPosts().map(loadConfig)),
  nextDate: null,
  today: veilleDates[0] ?? null,
  veilleDates,
  veilles: Object.fromEntries(veilleDates.map(d => [d, loadVeille(d)])),
  guide: readFileSync(join(ROOT, 'guides/tiktok.md'), 'utf8'),
};
writeFileSync(join(OUT, 'demo-data.js'), `window.DEMO_DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};\n`);
console.log(`Démo construite dans demo/ : ${Object.keys(posts).length} posts, ${veilleDates.length} veille(s).`);
