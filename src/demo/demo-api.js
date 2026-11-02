// Mode démo du studio : remplace le serveur local par des données figées (window.DEMO_DATA).
// Lecture et retouches à l'écran fonctionnent ; tout ce qui appelle Claude, Metricool ou
// le moteur de rendu est désactivé, pour que la démo en ligne ne coûte rien.
(() => {
  const D = window.DEMO_DATA;
  const posts = structuredClone(D.posts); // modifiable en mémoire, jamais enregistré
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const off = what => json({ error: `Désactivé en mode démo : ${what}. Dans l’outil, cette action tourne en local.` }, 403);
  const summary = p => ({ slug: p.slug, date: p.date, sujet: p.config.sujet, rubrique: p.config.rubrique, secteur: p.config.secteur, startup: !!p.config.startup, statut: p.config.statut, slides: p.config.slides.length, cover: p.rendered });
  const body = async init => { try { return JSON.parse(init.body || '{}'); } catch { return {}; } };

  const routes = [
    ['GET', /^\/api\/posts$/, () => json({ posts: Object.values(posts).map(summary).reverse(), alerts: D.alerts, nextDate: D.nextDate })],
    ['GET', /^\/api\/etat$/, () => json({ tiktokConfigure: false, tiktokConnecte: false, veilleHeure: 8 })],
    ['GET', /^\/api\/posts\/([^/]+)$/, m => (posts[m[1]] ? json(posts[m[1]]) : json({ error: 'Post inconnu' }, 404))],
    ['PUT', /^\/api\/posts\/([^/]+)$/, async (m, init) => {
      const p = posts[m[1]];
      const { config, legende, sources } = await body(init);
      if (config) p.config = config;
      if (typeof legende === 'string') p.legende = legende;
      if (typeof sources === 'string') p.sources = sources;
      return json(p);
    }],
    ['POST', /^\/api\/posts\/([^/]+)\/generer$/, () => off('la génération des images')],
    ['POST', /^\/api\/posts\/([^/]+)\/legendes$/, () => off('l’écriture de légendes par Claude')],
    ['POST', /^\/api\/posts\/([^/]+)\/(programmer|brouillon)$/, () => off('la programmation sur TikTok')],
    ['POST', /^\/api\/posts\/([^/]+)\/publie$/, () => off('le changement de statut')],
    ['POST', /^\/api\/posts\/([^/]+)\/images$/, () => off('l’import d’images')],
    ['POST', /^\/api\/posts$/, () => off('la création de post')],
    ['GET', /^\/api\/veille$/, (m, init, url) => {
      const date = url.searchParams.get('date') ?? D.veilleDates[0];
      return json({ dates: D.veilleDates, date, today: D.today, veille: D.veilles[date] ?? null });
    }],
    ['POST', /^\/api\/veille$/, () => off('la veille (recherche par Claude)')],
    ['POST', /^\/api\/rediger$/, () => off('la rédaction automatique par Claude')],
    ['POST', /^\/api\/demo$/, () => off('la mise à jour de la démo')],
    ['GET', /^\/api\/jobs$/, () => json([])],
    ['GET', /^\/api\/jobs\/.+$/, () => json({ error: 'Tâche inconnue' }, 404)],
    ['GET', /^\/api\/reglages$/, () => json({ TIKTOK_CLIENT_KEY: '', TIKTOK_CLIENT_SECRET: '', TIKTOK_REDIRECT_URI: '', PAGES_BASE_URL: '', VEILLE_HEURE: '8' })],
    ['GET', /^\/api\/tiktok$/, () => json({ cles: false, redirection: false, pages: false, connecte: false, compte: null, erreur: null })],
    ['GET', /^\/api\/service$/, () => json({ installe: false })],
    ['GET', /^\/api\/metricool$/, () => json(null)],
    ['GET', /^\/api\/guide$/, () => json({ markdown: D.guide })],
  ];

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    for (const [verb, re, handler] of routes) {
      const m = url.pathname.match(re);
      if (m && verb === method) return handler(m, init, url);
    }
    return off('les réglages et connexions');
  };
})();
