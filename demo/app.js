// Décrypte Studio : interface locale (aucune dépendance).
// Pages : #/veille · #/posts · #/post/<dossier>/<onglet> · #/reglages · #/guide

const $ = sel => document.querySelector(sel);
const view = $('#view');
/** Remplace le contenu de la page (les valeurs vides sont ignorées). */
const show = (...nodes) => view.replaceChildren(...nodes.flat(Infinity).filter(n => n != null && n !== false));
const state = {
  posts: [], alerts: [], nextDate: null, etat: {}, jobs: [],
  post: null, config: null, legend: '', sources: '', slide: 0, dirty: false, busy: false,
  currentHash: location.hash,
};

// ---------- utilitaires ----------
/** Crée un élément. Les enfants texte sont insérés en textContent (jamais en HTML). */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'value') node.value = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
  return data;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

function modal(title, body, actions) {
  const dlg = $('#modal');
  $('#modal-title').textContent = title;
  $('#modal-body').replaceChildren(...[].concat(body).filter(Boolean));
  $('#modal-actions').replaceChildren(...actions.map(a => el('button', { class: `btn ${a.primary ? 'btn-primary' : ''}`, type: 'button', onclick: () => (a.run ? a.run() : dlg.close()) }, a.label)));
  if (!dlg.open) dlg.showModal();
  return dlg;
}
const closeModal = () => { if ($('#modal').open) $('#modal').close(); };

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copié'); } catch { toast('Copie impossible : sélectionne le texte à la main'); }
}

const countWords = (s = '') => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const RULES = { hook: 9, prose: 24 };
const RUBRIQUES = ['Le marketing derrière la culture pop', "Pourquoi tu l'as acheté", 'Le flop'];
const STATUTS = ['à rédiger', 'prêt', 'programmé', 'brouillon', 'publié'];
const RUBRIC_CLASS = { 'Le flop': 'tag-flop', "Pourquoi tu l'as acheté": 'tag-achat' };
const TYPE_NAMES = { hook: 'Accroche', text: 'Texte', quote: 'Citation', list: 'Liste', stats: 'Chiffres', outro: 'Résultat' };
const TYPE_TEMPLATES = {
  text: () => ({ type: 'text', label: 'Titre', body: 'Deux ou trois lignes.', highlight: [] }),
  quote: () => ({ type: 'quote', label: 'La citation', quote: 'Une phrase marquante.', attribution: 'Qui, où, quand', body: '', highlight: [] }),
  list: () => ({ type: 'list', label: 'La mécanique', items: ['Premier point', 'Deuxième point', 'Troisième point'], highlight: [] }),
  stats: () => ({ type: 'stats', label: 'Les chiffres', items: [{ value: '…', text: 'un chiffre sourcé' }], source: 'Source : …' }),
  hook: () => ({ type: 'hook', title: 'Ton accroche ?', highlight: [], cta: 'On décrypte →' }),
  outro: () => ({ type: 'outro', title: 'Résultat ?', lesson: 'La leçon.', conclusion: 'La conclusion.', cta: 'Abonne-toi !', highlight: [] }),
};
const media = (slug, file, v = '') => `/media/${encodeURIComponent(slug)}/${file}${v ? `?v=${v}` : ''}`;
const postHash = (slug, tab = 'slides') => `#/post/${encodeURIComponent(slug)}/${tab}`;

// ---------- navigation ----------
function parseRoute() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'veille', parts, params: new URLSearchParams(qs || '') };
}
const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };

function confirmLeave() {
  if (!state.dirty) return Promise.resolve(true);
  return new Promise(resolve => modal('Modifications non enregistrées', el('p', {}, 'Tu as modifié ce post sans l’enregistrer.'), [
    { label: 'Rester', run: () => { closeModal(); resolve(false); } },
    { label: 'Abandonner', run: () => { closeModal(); state.dirty = false; resolve(true); } },
    { label: 'Enregistrer', primary: true, run: async () => { closeModal(); await save(); resolve(true); } },
  ]));
}

async function route() {
  const r = parseRoute();
  const stayingOnPost = r.name === 'post' && r.parts[1] === state.post?.slug;
  if (state.dirty && !stayingOnPost && !(await confirmLeave())) { history.replaceState(null, '', state.currentHash); return; }
  if (!stayingOnPost) { state.post = null; state.dirty = false; }
  state.currentHash = location.hash;
  const section = r.name === 'post' ? 'posts' : r.name === 'guide' ? 'reglages' : r.name;
  document.querySelectorAll('.nav-link').forEach(a => a.setAttribute('aria-current', a.dataset.route === section ? 'page' : 'false'));
  try {
    if (r.name === 'posts') await renderPosts(r);
    else if (r.name === 'post') await renderPost(r);
    else if (r.name === 'reglages') await renderSettings(r);
    else if (r.name === 'guide') await renderGuide();
    else await renderVeille(r);
  } catch (e) {
    show(el('div', { class: 'empty' }, el('strong', {}, 'Oups'), e.message));
  }
}
window.addEventListener('hashchange', route);

async function refreshGlobal() {
  const [{ posts, alerts, nextDate }, etat] = await Promise.all([api('/api/posts'), api('/api/etat')]);
  Object.assign(state, { posts, alerts, nextDate, etat });
  $('#badge-posts').textContent = posts.length || '';
  $('#dot-reglages').hidden = !!(etat.tiktokConfigure && etat.tiktokConnecte);
}

// ================= VEILLE =================
async function renderVeille(r) {
  const date = r.params.get('date');
  const data = await api(`/api/veille${date ? `?date=${encodeURIComponent(date)}` : ''}`);
  const running = state.jobs.find(j => j.kind === 'veille' && !j.endedAt);
  const sujets = data.veille?.sujets ?? [];
  if (data.date === data.today) updateVeilleBadge(sujets);

  const dates = data.dates.length ? data.dates : [data.today];
  const select = el('select', { 'aria-label': 'Jour de la veille', class: 'btn', onchange: e => go(`#/veille?date=${e.target.value}`) },
    dates.map(d => el('option', { value: d }, d === data.today ? `Aujourd’hui (${d})` : d)));
  select.value = data.date ?? data.today;

  const jobFor = id => state.jobs.find(j => j.kind === 'rediger' && !j.endedAt && j.meta?.veille?.id === id && j.meta?.veille?.date === data.date);

  const cards = sujets.map(s => {
    const job = jobFor(s.id);
    const foot = s.post
      ? el('a', { class: 'btn', href: postHash(s.post) }, 'Voir le post')
      : job
        ? [el('button', { class: 'btn btn-primary', type: 'button', disabled: true }, el('span', { class: 'pulse' }), job.status === 'en attente' ? 'En file d’attente…' : 'Rédaction en cours…'), el('span', { class: 'card-progress' }, job.lastLog)]
        : el('button', { class: 'btn btn-primary', type: 'button', onclick: () => startRediger({ sujet: s.sujet, angle: s.angle, sources: s.sources, veille: { date: data.date, id: s.id } }) }, 'Générer le slideshow');
    const stars = Math.max(0, Math.min(5, s.potentiel ?? 0));
    return el('article', { class: 'card' },
      el('div', { class: 'card-tags' },
        el('span', { class: `tag tag-rubrique ${RUBRIC_CLASS[s.rubrique] ?? ''}` }, s.rubrique),
        s.type && el('span', { class: `tag ${s.type === 'culte' ? 'tag-culte' : 'tag-actu'}` }, s.type === 'culte' ? 'Cas culte' : 'Actu'),
        el('span', { class: 'tag' }, s.secteur),
        s.startup && el('span', { class: 'tag tag-startup' }, 'Startup'),
        el('span', { class: 'potential', title: `Potentiel ${stars}/5`, 'aria-label': `Potentiel ${stars} sur 5` }, '★'.repeat(stars) + '☆'.repeat(5 - stars))),
      el('h2', { class: 'card-title' }, s.sujet),
      s.accroche && el('p', { class: 'card-hook' }, el('span', { class: 'card-label' }, 'Accroche'), s.accroche),
      s.angle && el('p', { class: 'card-text' }, el('span', { class: 'card-label' }, 'Angle'), s.angle),
      s.pourquoi_maintenant && el('p', { class: 'card-text' }, el('span', { class: 'card-label' }, s.type === 'culte' ? 'Pourquoi ça marche encore' : 'Pourquoi maintenant'), s.actu ? `${s.actu}. ${s.pourquoi_maintenant}` : s.pourquoi_maintenant),
      s.chiffres_cles?.length && el('div', {}, el('span', { class: 'card-label' }, 'Chiffres trouvés'), el('ul', { class: 'card-figures' }, s.chiffres_cles.map(c => el('li', {}, c)))),
      s.sources?.length && el('div', { class: 'card-sources' }, s.sources.map(src => el('a', { href: src.url, target: '_blank', rel: 'noopener' }, src.titre || src.url))),
      el('div', { class: 'card-foot' }, foot));
  });

  show(
    el('div', { class: 'page-head' },
      el('div', {}, el('p', { class: 'eyebrow' }, `Actualité et cas cultes du marketing · nouvelle veille chaque jour à ${state.etat.veilleHeure ?? 8} h`), el('h1', { class: 'page-title' }, 'Veille')),
      el('div', { class: 'page-actions' }, select,
        el('button', { class: 'btn btn-primary', type: 'button', disabled: !!running, onclick: launchVeille }, running ? 'Veille en cours…' : 'Relancer la veille'))),
    sujets.length ? el('div', { class: 'cards' }, cards)
      : el('div', { class: 'empty' }, el('strong', {}, running ? 'Veille en cours' : 'Pas encore de veille'),
        running ? `Claude cherche l’actualité marketing et des cas cultes (environ 10 minutes). ${running.lastLog ?? ''}`
          : 'Elle se lance automatiquement chaque matin. Tu peux aussi la lancer maintenant.'));
}

function updateVeilleBadge(sujets) {
  $('#badge-veille').textContent = sujets.filter(s => !s.post).length || '';
}

async function launchVeille() {
  try { await api('/api/veille', { method: 'POST', body: {} }); toast('Veille lancée : environ 10 minutes'); await pollJobs(); route(); }
  catch (e) { toast(e.message); }
}

async function startRediger(payload) {
  try {
    await api('/api/rediger', { method: 'POST', body: payload });
    toast(`Rédaction lancée : « ${payload.sujet} » (5 à 15 min, suivie dans Activité)`);
    await pollJobs();
    if (parseRoute().name === 'veille') route();
  } catch (e) { toast(e.message); }
}

// ================= POSTS =================
async function renderPosts(r) {
  await refreshGlobal();
  const filter = r.params.get('statut') ?? 'tous';
  const count = s => state.posts.filter(p => p.statut === s).length;
  const shown = filter === 'tous' ? state.posts : state.posts.filter(p => p.statut === filter);
  const writing = state.jobs.filter(j => j.kind === 'rediger' && !j.endedAt);

  show(
    el('div', { class: 'page-head' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Tous tes carrousels'), el('h1', { class: 'page-title' }, 'Posts')),
      el('div', { class: 'page-actions' }, el('button', { class: 'btn btn-accent', type: 'button', onclick: newPostFlow }, '+ Nouveau post'))),
    state.alerts.length ? el('div', { class: 'banner' }, el('p', { class: 'eyebrow' }, 'Variété du fil'), state.alerts.map(a => el('div', { class: 'check warn' }, a))) : null,
    el('nav', { class: 'filters', 'aria-label': 'Filtrer par statut' },
      [['tous', 'Tous', state.posts.length], ...STATUTS.map(s => [s, s[0].toUpperCase() + s.slice(1), count(s)])].map(([key, label, n]) =>
        el('a', { class: 'chip', href: key === 'tous' ? '#/posts' : `#/posts?statut=${encodeURIComponent(key)}`, 'aria-current': filter === key ? 'true' : 'false' }, label, el('span', { class: 'n' }, n)))),
    el('div', { class: 'gallery-posts' },
      el('button', { class: 'post-card new', type: 'button', onclick: newPostFlow }, el('span', {}, '+'), 'Nouveau post'),
      writing.map(j => el('button', { class: 'post-card new', type: 'button', onclick: () => showJob(j.id) }, el('span', { class: 'pulse' }), 'En rédaction', el('small', { class: 'hint' }, j.meta.sujet))),
      shown.map(p => el('a', { class: 'post-card', href: postHash(p.slug) },
        el('div', { class: 'post-cover' },
          p.cover ? el('img', { src: media(p.slug, 'slide-1.png', p.cover), alt: '', loading: 'lazy' }) : el('div', { class: 'post-cover-empty' }, 'Slides pas encore générées'),
          el('span', { class: 'status', 'data-s': p.statut }, p.statut)),
        el('div', { class: 'post-body' },
          el('span', { class: 'post-name' }, p.sujet),
          el('span', { class: 'post-meta' }, `${p.date} · ${p.secteur}${p.startup ? ' · startup' : ''}`),
          el('span', { class: 'post-meta' }, p.rubrique))))),
    !shown.length && filter !== 'tous' ? el('p', { class: 'hint' }, 'Aucun post avec ce statut.') : null);
}

function newPostFlow() {
  let mode = 'claude';
  const body = el('div', { class: 'modal-body' });
  const form = () => {
    const keep = $('#np-sujet')?.value ?? '';
    const seg = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Méthode' },
      el('button', { type: 'button', 'aria-pressed': mode === 'claude' ? 'true' : 'false', onclick: () => { mode = 'claude'; form(); } }, 'Claude s’en occupe'),
      el('button', { type: 'button', 'aria-pressed': mode === 'main' ? 'true' : 'false', onclick: () => { mode = 'main'; form(); } }, 'Je le fais à la main'));
    const sujet = el('input', { type: 'text', id: 'np-sujet', placeholder: 'Ex. Labubu, la fin de la hype', autocomplete: 'off', value: keep });
    const parts = [seg, el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Sujet'), sujet)];
    if (mode === 'claude') {
      parts.push(el('p', { class: 'hint' }, 'Claude cherche les faits et les sources, récupère les visuels, reprend les couleurs de la marque, rédige les slides et la légende, puis génère les images. Compte 5 à 15 minutes. Tu pourras tout retoucher ensuite.'));
    } else {
      parts.push(
        el('div', { class: 'row' },
          el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Rubrique'), el('select', { id: 'np-rubrique' }, RUBRIQUES.map(x => el('option', { value: x }, x)))),
          el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Secteur'), el('input', { type: 'text', id: 'np-secteur', placeholder: 'Ex. Jouets' }))),
        el('div', { class: 'row' },
          el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Date de publication prévue'), el('input', { type: 'date', id: 'np-date', value: state.nextDate ?? '' })),
          el('label', { class: 'toggle' }, el('input', { type: 'checkbox', id: 'np-startup' }), 'Sujet startup')),
        el('p', { class: 'hint' }, 'Un post vide est créé avec la structure attendue (accroche, contexte, idée, mécanique, chiffres, résultat) : tu remplis les textes et tu importes tes images.'));
    }
    body.replaceChildren(...parts);
    setTimeout(() => sujet.focus());
  };
  form();
  modal('Nouveau post', body, [
    { label: 'Annuler' },
    { label: 'Créer', primary: true, run: async () => {
      const sujet = $('#np-sujet').value.trim();
      if (!sujet) { $('#np-sujet').focus(); toast('Écris d’abord un sujet'); return; }
      if (mode === 'claude') { closeModal(); await startRediger({ sujet }); return; }
      try {
        const d = await api('/api/posts', { method: 'POST', body: { sujet, rubrique: $('#np-rubrique').value, secteur: $('#np-secteur').value, date: $('#np-date').value, startup: $('#np-startup').checked } });
        closeModal();
        go(postHash(d.slug));
      } catch (e) { toast(e.message); }
    } },
  ]);
}

// ================= PAGE POST =================
function loadDetail(detail) {
  state.post = detail;
  state.config = structuredClone(detail.config);
  state.legend = detail.legende;
  state.sources = detail.sources;
  if (state.slide >= state.config.slides.length) state.slide = 0;
  state.dirty = false;
}

function setDirty() {
  state.dirty = true;
  for (const n of document.querySelectorAll('.dirty, #preview-note')) n.hidden = false;
}

async function renderPost(r) {
  const slug = r.parts[1];
  const tab = r.parts[2] || 'slides';
  if (state.post?.slug !== slug) { state.slide = 0; loadDetail(await api(`/api/posts/${encodeURIComponent(slug)}`)); }
  const p = state.post, c = state.config;
  const tabs = [['slides', 'Slides'], ['legende', 'Légende'], ['sources', 'Sources'], ['infos', 'Infos et couleurs']];
  const panel = { slides: slidesPanel, legende: legendPanel, sources: sourcesPanel, infos: infosPanel }[tab] ?? slidesPanel;

  show(
    el('a', { class: 'back', href: '#/posts' }, '← Tous les posts'),
    el('div', { class: 'page-head' },
      el('div', {},
        el('p', { class: 'eyebrow' }, `${p.date} · ${c.rubrique} · ${c.secteur}${c.startup ? ' · startup' : ''}`),
        el('h1', { class: 'page-title' }, c.sujet)),
      el('div', { class: 'page-actions' },
        el('span', { class: 'status', 'data-s': c.statut }, c.statut),
        el('span', { class: 'dirty', hidden: !state.dirty }, '● Non enregistré'),
        el('button', { class: 'btn btn-primary', id: 'btn-generate', type: 'button', disabled: state.busy, onclick: () => generateNow(false) }, 'Enregistrer et générer ', el('kbd', {}, '⌘S')),
        el('button', { class: 'btn', type: 'button', onclick: scheduleFlow }, c.statut === 'programmé' ? 'Reprogrammer' : 'Programmer sur TikTok'),
        el('button', { class: 'btn', type: 'button', onclick: downloadFlow }, 'Télécharger'),
        c.statut !== 'publié' && el('button', { class: 'btn btn-ghost', type: 'button', onclick: publishedFlow }, 'Marquer publié'))),
    c.programmation && el('div', { class: 'check ok' }, `Programmé sur TikTok le ${new Date(c.programmation.date).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}${c.programmation.auto ? ' (publication automatique)' : ' (notification : tu publies toi-même avec le son)'} · `,
      el('a', { href: c.programmation.plannerUrl, target: '_blank', rel: 'noopener' }, 'Voir dans Metricool')),
    el('div', { class: 'checks', id: 'checks' }),
    el('nav', { class: 'tabs', 'aria-label': 'Sections du post' },
      tabs.map(([key, label]) => el('a', { class: 'tab', href: postHash(slug, key), 'aria-current': key === tab ? 'page' : 'false' }, label))),
    panel());
  renderChecks();
}

function renderChecks() {
  const { validation, generation } = state.post;
  const items = [];
  if (generation?.rendered) items.push(el('div', { class: 'check ok' }, `Slides générées · PNG compressés de ${generation.gain} %`));
  if (generation && !generation.rendered) items.push(el('div', { class: 'check err' }, 'Slides non générées : corrige les erreurs ci-dessous, ou ',
    el('button', { class: 'link-btn', type: 'button', onclick: () => generateNow(true) }, 'génère un aperçu quand même')));
  for (const e of validation.errors) items.push(el('div', { class: 'check err' }, e));
  for (const w of validation.warnings) items.push(el('div', { class: 'check warn' }, w));
  if (!validation.errors.length && !generation) items.push(el('div', { class: 'check ok' }, 'Contrôles OK : chaque chiffre est sourcé, les longueurs et les contrastes sont bons.'));
  $('#checks')?.replaceChildren(...items);
}

// ----- Onglet Slides -----
function slidesPanel() {
  const wrap = el('div', {});
  const renderAll = () => {
    const slides = state.config.slides;
    const s = slides[state.slide];
    const n = state.slide + 1;
    const rendered = state.post.rendered;
    const renderedCount = state.post.config.slides.length;
    const strip = el('div', { class: 'strip' },
      slides.map((sl, i) => el('button', { class: 'thumb', type: 'button', 'aria-current': i === state.slide ? 'true' : 'false', 'aria-label': `Slide ${i + 1} : ${TYPE_NAMES[sl.type] ?? sl.type}`, onclick: () => { state.slide = i; renderAll(); } },
        rendered && i < renderedCount ? el('img', { src: media(state.post.slug, `slide-${i + 1}.png`, rendered), alt: '', loading: 'lazy' }) : el('span', { class: 'thumb-type' }, TYPE_NAMES[sl.type] ?? sl.type),
        el('span', { class: 'thumb-n' }, `${i + 1}/${slides.length}`))),
      el('button', { class: 'thumb-add', type: 'button', onclick: () => addSlideFlow(renderAll) }, '+ Ajouter'));

    const preview = el('div', { class: 'preview' },
      rendered && state.slide < renderedCount ? el('img', { src: media(state.post.slug, `slide-${n}.png`, rendered), alt: `Aperçu de la slide ${n}` }) : el('div', { class: 'preview-empty' }, 'Pas encore d’aperçu : clique sur « Enregistrer et générer ».'),
      el('div', { class: 'zone zone-top' }), el('div', { class: 'zone zone-bottom' }), el('div', { class: 'zone zone-right' }),
      el('div', { class: 'busy', id: 'busy', hidden: !state.busy }, el('span', {}, 'Génération…')));
    const zones = el('input', { type: 'checkbox', onchange: e => preview.classList.toggle('zones-on', e.target.checked) });

    const tools = el('div', { class: 'slide-tools' },
      el('button', { class: 'icon-btn', type: 'button', title: 'Déplacer à gauche', 'aria-label': 'Déplacer la slide à gauche', disabled: state.slide === 0, onclick: () => moveSlide(-1, renderAll) }, '←'),
      el('button', { class: 'icon-btn', type: 'button', title: 'Déplacer à droite', 'aria-label': 'Déplacer la slide à droite', disabled: state.slide === slides.length - 1, onclick: () => moveSlide(1, renderAll) }, '→'),
      el('button', { class: 'icon-btn', type: 'button', title: 'Dupliquer', 'aria-label': 'Dupliquer la slide', onclick: () => { slides.splice(state.slide + 1, 0, structuredClone(s)); state.slide++; setDirty(); renderAll(); } }, '⧉'),
      el('button', { class: 'icon-btn', type: 'button', title: 'Supprimer', 'aria-label': 'Supprimer la slide', disabled: slides.length <= 1, onclick: () => deleteSlide(renderAll) }, '🗑'));

    wrap.replaceChildren(strip, el('div', { class: 'workspace' },
      el('div', { class: 'preview-col' }, preview,
        el('p', { class: 'preview-note', id: 'preview-note', hidden: !state.dirty }, 'Aperçu pas à jour : ⌘S pour régénérer.'),
        el('label', { class: 'toggle' }, zones, 'Afficher les zones masquées par TikTok')),
      el('form', { class: 'editor', onsubmit: e => e.preventDefault() },
        el('div', { class: 'editor-head' }, el('h2', { class: 'editor-title' }, `Slide ${n} · ${TYPE_NAMES[s.type] ?? s.type}`), tools),
        slideFields(s, renderAll))));
  };
  renderAll();
  return wrap;
}

function moveSlide(delta, rerender) {
  const slides = state.config.slides, i = state.slide, j = i + delta;
  [slides[i], slides[j]] = [slides[j], slides[i]];
  state.slide = j;
  setDirty();
  rerender();
}

function deleteSlide(rerender) {
  modal('Supprimer cette slide ?', el('p', {}, `La slide ${state.slide + 1} sera retirée. Tant que tu n’as pas enregistré, tu peux encore annuler en quittant le post.`), [
    { label: 'Annuler' },
    { label: 'Supprimer', primary: true, run: () => { state.config.slides.splice(state.slide, 1); state.slide = Math.max(0, state.slide - 1); setDirty(); closeModal(); rerender(); } },
  ]);
}

function addSlideFlow(rerender) {
  modal('Ajouter une slide', [el('p', { class: 'hint' }, 'Elle sera insérée après la slide sélectionnée.'),
    el('div', { class: 'chips' }, ['text', 'list', 'quote', 'stats', 'hook', 'outro'].map(t => el('button', { class: 'chip', type: 'button', onclick: () => {
      state.config.slides.splice(state.slide + 1, 0, TYPE_TEMPLATES[t]());
      state.slide++;
      setDirty();
      closeModal();
      rerender();
    } }, TYPE_NAMES[t])))], [{ label: 'Annuler' }]);
}

function slideFields(s, rerender) {
  const upd = fn => { fn(s); setDirty(); };
  const textField = (labelText, key, { rows = 0, count } = {}) => {
    const counter = el('span', { class: 'counter' });
    const refresh = () => { if (!count) return; const { n, max } = count(); counter.textContent = `${n} / ${max} mots`; counter.classList.toggle('over', n > max); };
    const input = rows ? el('textarea', { rows }) : el('input', { type: 'text' });
    input.value = s[key] ?? '';
    input.addEventListener('input', e => { upd(sl => { sl[key] = e.target.value; }); refresh(); });
    refresh();
    return el('label', { class: 'field' }, el('span', { class: 'field-label' }, labelText, counter), input);
  };
  const prose = () => ({ n: countWords((s.type === 'quote' ? [s.quote, s.body] : s.type === 'outro' ? [s.lesson, s.conclusion] : [s.body]).filter(Boolean).join(' ')), max: RULES.prose });
  const highlight = () => {
    const ta = el('textarea', { rows: 2 });
    ta.value = (s.highlight ?? []).join('\n');
    ta.addEventListener('input', e => upd(sl => { sl.highlight = e.target.value.split('\n').map(x => x.trim()).filter(Boolean); }));
    return el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Mots mis en valeur (un par ligne, écrits comme dans le texte)'), ta);
  };
  const hookChoices = () => {
    const variants = state.config.accroches ?? [];
    if (!variants.length) return null;
    return el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Variantes d’accroche'),
      el('div', { class: 'chips' }, variants.map(v => el('button', { class: 'chip', type: 'button', 'aria-pressed': s.title === v ? 'true' : 'false', onclick: () => { upd(sl => { sl.title = v; }); rerender(); } }, v))));
  };
  const listField = () => el('div', { class: 'group' }, el('p', { class: 'group-title' }, 'Points de la liste'),
    s.items.map((it, i) => {
      const input = el('input', { type: 'text', 'aria-label': `Point ${i + 1}` });
      input.value = it;
      input.addEventListener('input', e => upd(sl => { sl.items[i] = e.target.value; }));
      return el('div', { class: 'item-row single' }, el('div', { class: 'field' }, input),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Supprimer le point ${i + 1}`, onclick: () => { upd(sl => sl.items.splice(i, 1)); rerender(); } }, '×'));
    }),
    s.items.length < 4 && el('button', { class: 'link-btn', type: 'button', onclick: () => { upd(sl => sl.items.push('')); rerender(); } }, '+ Ajouter un point'));
  const statsField = () => el('div', { class: 'group' }, el('p', { class: 'group-title' }, 'Chiffres clés', el('span', { class: 'hint' }, 'chacun doit figurer dans les sources')),
    s.items.map((it, i) => {
      const v = el('input', { type: 'text', 'aria-label': 'Chiffre' }), t = el('input', { type: 'text', 'aria-label': 'Explication' });
      v.value = it.value; t.value = it.text;
      v.addEventListener('input', e => upd(sl => { sl.items[i].value = e.target.value; }));
      t.addEventListener('input', e => upd(sl => { sl.items[i].text = e.target.value; }));
      return el('div', { class: 'item-row' }, el('div', { class: 'field' }, v), el('div', { class: 'field' }, t),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Supprimer le chiffre ${i + 1}`, onclick: () => { upd(sl => sl.items.splice(i, 1)); rerender(); } }, '×'));
    }),
    s.items.length < 3 && el('button', { class: 'link-btn', type: 'button', onclick: () => { upd(sl => sl.items.push({ value: '', text: '' })); rerender(); } }, '+ Ajouter un chiffre'));
  const photoField = () => {
    const ph = s.photo;
    const pick = src => { upd(sl => { if (src) sl.photo = { ...(sl.photo ?? {}), src }; else delete sl.photo; }); rerender(); };
    const upload = async file => {
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(state.post.slug)}/images`, { method: 'POST', headers: { 'X-Filename': encodeURIComponent(file.name) }, body: file });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        state.post.images = data.images;
        pick(data.src);
        toast('Image ajoutée');
      } catch (e) { toast(e.message); }
    };
    const fileInput = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, onchange: e => e.target.files[0] && upload(e.target.files[0]) });
    const drop = el('label', { class: 'upload', title: 'Importer une image' }, fileInput, '+ Importer', el('br'), 'ou glisser');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
    const children = [el('p', { class: 'group-title' }, 'Visuel'),
      el('div', { class: 'images' }, drop,
        el('button', { type: 'button', class: 'none', 'aria-pressed': !ph ? 'true' : 'false', onclick: () => pick(null) }, 'Aucun'),
        state.post.images.map(src => el('button', { type: 'button', title: src.replace('images/', ''), 'aria-pressed': ph?.src === src ? 'true' : 'false', onclick: () => pick(src) },
          el('img', { src: media(state.post.slug, src), alt: src.replace('images/', ''), loading: 'lazy' }))))];
    if (ph) {
      const sub = (labelText, key) => { const i = el('input', { type: 'text' }); i.value = ph[key] ?? ''; i.addEventListener('input', e => upd(sl => { sl.photo[key] = e.target.value; })); return el('label', { class: 'field' }, el('span', { class: 'field-label' }, labelText), i); };
      const out = el('output', {}, Math.round((ph.focusY ?? 0.5) * 100) + ' %');
      const range = el('input', { type: 'range', min: 0, max: 1, step: 0.05, 'aria-label': 'Cadrage vertical' });
      range.value = ph.focusY ?? 0.5;
      range.addEventListener('input', e => { upd(sl => { sl.photo.focusY = Number(e.target.value); }); out.textContent = Math.round(e.target.value * 100) + ' %'; });
      const cut = el('input', { type: 'checkbox' });
      cut.checked = !!ph.detourer;
      cut.addEventListener('change', e => upd(sl => { if (e.target.checked) sl.photo.detourer = true; else delete sl.photo.detourer; }));
      children.push(el('div', { class: 'row' }, sub('Légende sur la photo', 'caption'), sub('Crédit', 'credit')),
        el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Cadrage (haut → bas)'), el('div', { class: 'range' }, range, out)),
        el('label', { class: 'toggle' }, cut, 'Détourer le produit'));
    }
    return el('div', { class: 'group' }, children);
  };
  const paletteField = () => {
    const names = Object.keys(state.config.theme?.palettes ?? {});
    const seq = state.config.theme?.sequence ?? [];
    const auto = seq.length ? seq[state.slide % seq.length] : '—';
    const select = el('select', {}, el('option', { value: '' }, `Automatique (${auto})`), names.map(n => el('option', { value: n }, n)));
    select.value = s.palette ?? '';
    select.addEventListener('change', e => upd(sl => { if (e.target.value) sl.palette = e.target.value; else delete sl.palette; }));
    return el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Couleurs de la slide', el('a', { href: postHash(state.post.slug, 'infos'), class: 'hint' }, 'modifier les couleurs')), select);
  };

  const byType = {
    hook: () => [textField('Accroche', 'title', { rows: 2, count: () => ({ n: countWords(s.title), max: RULES.hook }) }), hookChoices(), highlight(), textField('Bouton', 'cta'), photoField()],
    text: () => [textField('Titre de section', 'label'), textField('Texte', 'body', { rows: 4, count: prose }), highlight(), photoField()],
    quote: () => [textField('Titre de section', 'label'), textField('Citation', 'quote', { rows: 2, count: prose }), textField('Auteur, contexte', 'attribution'), textField('Explication', 'body', { rows: 2, count: prose }), highlight(), photoField()],
    list: () => [textField('Titre de section', 'label'), listField(), highlight(), photoField()],
    stats: () => [textField('Titre de section', 'label'), statsField(), textField('Source affichée', 'source')],
    outro: () => [textField('Titre', 'title'), textField('Leçon marketing', 'lesson', { rows: 2, count: prose }), textField('Conclusion', 'conclusion', { rows: 2, count: prose }), highlight(), textField('Appel à l’action', 'cta', { rows: 2 })],
  }[s.type];
  return [...(byType ? byType() : [el('p', {}, `Type « ${s.type} » non modifiable ici.`)]), paletteField()];
}

// ----- Onglet Légende -----
function legendPanel() {
  const ta = el('textarea', { id: 'legend', rows: 10 });
  ta.value = state.legend;
  const counter = el('span', { class: 'counter' });
  const refresh = () => {
    const tags = (ta.value.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
    counter.textContent = `${ta.value.length} caractères · ${tags} hashtag${tags > 1 ? 's' : ''}`;
    counter.classList.toggle('over', tags < 4 || tags > 5);
  };
  ta.addEventListener('input', () => { state.legend = ta.value; setDirty(); refresh(); });
  refresh();

  const suggestions = el('div', { class: 'modal-body' }, el('p', { class: 'hint' }, 'Claude lit tes slides et propose 3 légendes : une intrigante, une pédagogique, une complice. Aucun chiffre en dehors de ceux du carrousel.'));
  const btn = el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
    btn.disabled = true; btn.textContent = 'Claude écrit… (30 s environ)';
    try {
      if (state.dirty) await save();
      const { legendes } = await api(`/api/posts/${encodeURIComponent(state.post.slug)}/legendes`, { method: 'POST' });
      suggestions.replaceChildren(...legendes.map(l => el('div', { class: 'suggestion' }, l,
        el('button', { class: 'btn btn-small', type: 'button', onclick: () => { ta.value = l; state.legend = l; setDirty(); refresh(); toast('Légende reprise : retouche-la si tu veux, puis enregistre'); } }, 'Utiliser cette légende'))));
    } catch (e) { toast(e.message); }
    btn.disabled = false; btn.textContent = '✨ Proposer 3 légendes';
  } }, '✨ Proposer 3 légendes');

  return el('div', { class: 'two-cols' },
    el('section', { class: 'panel-card legend-area' },
      el('h2', { class: 'panel-title' }, 'Légende TikTok', counter),
      el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Texte envoyé avec le brouillon (modifiable librement)'), ta),
      el('p', { class: 'hint' }, '2 à 3 lignes, une question pour les commentaires, puis 4 à 5 hashtags.'),
      el('div', { class: 'page-actions' },
        el('button', { class: 'btn', type: 'button', onclick: () => save().then(() => toast('Légende enregistrée')).catch(e => toast(e.message)) }, 'Enregistrer la légende'),
        el('button', { class: 'btn', type: 'button', onclick: () => copy(ta.value) }, 'Copier la légende'))),
    el('section', { class: 'panel-card' }, el('h2', { class: 'panel-title' }, 'Propositions', btn), suggestions));
}

// ----- Onglet Sources -----
function sourcesPanel() {
  let editing = false;
  const box = el('section', { class: 'panel-card' });
  const draw = () => {
    const toggle = el('button', { class: 'btn btn-small', type: 'button', onclick: () => { editing = !editing; draw(); } }, editing ? 'Voir le rendu' : 'Modifier à la main');
    let content;
    if (editing) {
      const ta = el('textarea', { class: 'sources-editor', 'aria-label': 'Contenu des sources' });
      ta.value = state.sources;
      ta.addEventListener('input', e => { state.sources = e.target.value; setDirty(); });
      content = el('div', { class: 'field' }, ta, el('p', { class: 'hint' }, 'Format Markdown. Chaque chiffre affiché sur une slide doit apparaître ici, sinon la génération est bloquée.'));
    } else content = el('article', { class: 'sources' }, markdown(state.sources));
    box.replaceChildren(el('h2', { class: 'panel-title' }, 'Sources', toggle), content);
  };
  draw();
  return box;
}

function inlineMd(text) {
  const out = [];
  const re = /\[([^\]]+)\]\((https?:[^)\s]+)\)|(https?:\/\/[^\s|)]+)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    out.push(text.slice(last, m.index).replace(/\*\*|`/g, ''));
    out.push(el('a', { href: m[2] ?? m[3], target: '_blank', rel: 'noopener' }, m[1] ?? m[3]));
    last = re.lastIndex;
  }
  out.push(text.slice(last).replace(/\*\*|`/g, ''));
  return out;
}

function markdown(md) {
  const blocks = [];
  const lines = (md ?? '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { if (!/^\|[\s|:-]+\|$/.test(lines[i].trim())) rows.push(lines[i]); i++; }
      i--;
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const [head, ...body] = rows;
      blocks.push(el('table', {}, el('thead', {}, el('tr', {}, cells(head).map(c => el('th', {}, inlineMd(c))))),
        el('tbody', {}, body.map(r => el('tr', {}, cells(r).map(c => el('td', {}, inlineMd(c))))))));
    } else if (/^#{1,3} /.test(line)) blocks.push(el(line.startsWith('# ') ? 'h1' : 'h2', {}, line.replace(/^#+ /, '')));
    else if (/^```/.test(line)) { const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); blocks.push(el('pre', { class: 'log' }, code.join('\n'))); }
    else if (/^\s*([-*]|\d+\.) /.test(line)) blocks.push(el('p', {}, '• ', inlineMd(line.replace(/^\s*([-*]|\d+\.) /, ''))));
    else if (/^---+$/.test(line.trim())) blocks.push(el('hr'));
    else if (line.trim()) blocks.push(el('p', {}, inlineMd(line.replace(/^> ?/, ''))));
  }
  return blocks.length ? blocks : [el('p', { class: 'hint' }, 'Vide pour l’instant.')];
}

// ----- Onglet Infos et couleurs -----
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

function infosPanel() {
  const c = state.config;
  const input = (labelText, key) => {
    const i = el('input', { type: 'text' });
    i.value = c[key] ?? '';
    i.addEventListener('input', e => { c[key] = e.target.value; setDirty(); });
    return el('label', { class: 'field' }, el('span', { class: 'field-label' }, labelText), i);
  };
  const select = (labelText, key, options) => {
    const s = el('select', {}, options.map(o => el('option', { value: o }, o)));
    s.value = c[key];
    s.addEventListener('change', e => { c[key] = e.target.value; setDirty(); });
    return el('label', { class: 'field' }, el('span', { class: 'field-label' }, labelText), s);
  };
  const startup = el('input', { type: 'checkbox' });
  startup.checked = !!c.startup;
  startup.addEventListener('change', e => { c.startup = e.target.checked; setDirty(); });
  const hooks = el('textarea', { rows: 3 });
  hooks.value = (c.accroches ?? []).join('\n');
  hooks.addEventListener('input', e => { c.accroches = e.target.value.split('\n').map(x => x.trim()).filter(Boolean); setDirty(); });

  const theme = c.theme ?? (c.theme = { palettes: {}, sequence: [] });
  const brand = el('input', { type: 'text' });
  brand.value = theme.brand ?? '';
  brand.addEventListener('input', e => { theme.brand = e.target.value; setDirty(); });
  const palettes = Object.entries(theme.palettes).map(([name, p]) => {
    const preview = el('div', { class: 'palette-preview' });
    const check = el('span', { class: 'contrast' });
    const paint = () => {
      preview.style.background = p.bg; preview.style.color = p.ink;
      const block = el('span', {}, 'Bloc');
      block.style.background = p.boxBg; block.style.color = p.boxInk;
      preview.replaceChildren(el('span', {}, name), block);
      const r1 = contrast(p.ink, p.bg), r2 = contrast(p.boxInk, p.boxBg), ok = r1 >= 4.5 && r2 >= 4.5;
      check.textContent = ok ? 'Lisible' : `Peu lisible (${Math.min(r1, r2).toFixed(1)} : 4,5 minimum)`;
      check.classList.toggle('bad', !ok);
    };
    const color = (labelText, key) => {
      const i = el('input', { type: 'color', 'aria-label': `${name} : ${labelText}` });
      i.value = p[key];
      i.addEventListener('input', e => { p[key] = e.target.value.toUpperCase(); setDirty(); paint(); });
      return el('label', { class: 'color' }, labelText, i);
    };
    paint();
    return el('div', { class: 'palette' }, el('div', {}, preview, check), color('Fond', 'bg'), color('Texte', 'ink'), color('Bloc', 'boxBg'), color('Texte du bloc', 'boxInk'));
  });

  return el('div', { class: 'two-cols' },
    el('section', { class: 'panel-card' }, el('h2', { class: 'panel-title' }, 'Infos du post'),
      input('Sujet', 'sujet'),
      el('div', { class: 'row' }, select('Rubrique', 'rubrique', RUBRIQUES), input('Secteur', 'secteur')),
      el('div', { class: 'row' }, select('Statut', 'statut', STATUTS), el('label', { class: 'toggle' }, startup, 'Sujet startup')),
      el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Variantes d’accroche (une par ligne)'), hooks),
      el('p', { class: 'hint' }, `Dossier : posts/${state.post.slug}`)),
    el('section', { class: 'panel-card' }, el('h2', { class: 'panel-title' }, 'Couleurs de la marque'),
      el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Marque et source de la charte'), brand),
      el('div', {}, palettes.length ? palettes : el('p', { class: 'hint' }, 'Aucune palette.')),
      el('p', { class: 'hint' }, 'Chaque slide utilise une de ces palettes (au choix slide par slide dans l’onglet Slides). ⌘S pour voir le résultat.')));
}

// ----- Actions du post -----
async function save() {
  const keepSlide = state.slide;
  const detail = await api(`/api/posts/${encodeURIComponent(state.post.slug)}`, { method: 'PUT', body: { config: state.config, legende: state.legend, sources: state.sources } });
  loadDetail(detail);
  state.slide = Math.min(keepSlide, state.config.slides.length - 1);
  for (const n of document.querySelectorAll('.dirty, #preview-note')) n.hidden = true;
  return detail;
}

async function generateNow(force = false) {
  if (state.busy || !state.post) return;
  state.busy = true;
  if ($('#busy')) $('#busy').hidden = false;
  if ($('#btn-generate')) $('#btn-generate').disabled = true;
  try {
    await save();
    const keepSlide = state.slide;
    const detail = await api(`/api/posts/${encodeURIComponent(state.post.slug)}/generer`, { method: 'POST', body: { force } });
    loadDetail(detail);
    state.slide = keepSlide;
    toast(detail.generation.rendered ? 'Slides générées' : 'Pas de génération : corrige les erreurs signalées');
  } catch (e) { toast(e.message); }
  state.busy = false;
  route();
}

function downloadFlow() {
  if (!state.post.rendered) { toast('Génère d’abord les slides'); return; }
  if (state.dirty) { toast('Enregistre et génère d’abord tes modifications (⌘S) : le téléchargement prend les slides générées'); return; }
  location.href = `/telecharger/${encodeURIComponent(state.post.slug)}`;
  toast('Téléchargement : slides en JPEG + légende (dossier Téléchargements)');
}

function scheduleFlow() {
  if (state.dirty) { toast('Enregistre et génère d’abord tes modifications (⌘S)'); return; }
  if (!state.post.rendered) { toast('Génère d’abord les slides'); return; }
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  let d = new Date(`${state.post.date}T18:00`);
  if (!(d > new Date(Date.now() + 15 * 60_000))) { d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); }
  const when = el('input', { type: 'datetime-local', id: 'sch-date', value: fmt(d), min: fmt(new Date()) });
  const radio = (value, title, text, checked) => el('label', { class: 'radio-card' }, el('input', { type: 'radio', name: 'sch-mode', value, checked }), el('span', {}, el('strong', {}, title), el('span', { class: 'hint' }, text)));
  modal('Programmer sur TikTok', [
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Date et heure de publication'), when),
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Comment publier ?'),
      radio('notif', 'Je publie moi-même (recommandé)', 'À l’heure prévue, l’appli Metricool t’envoie une notification : tu ouvres le post dans TikTok, tu ajoutes le son tendance et tu publies.', true),
      radio('auto', 'Publication automatique', 'Metricool publie tout seul à l’heure prévue, sans son tendance.', false)),
    el('p', { class: 'hint' }, 'Les slides sont envoyées à Metricool avec la légende. Tu pourras modifier ou supprimer la programmation dans Metricool.'),
  ], [{ label: 'Annuler' }, { label: 'Programmer', primary: true, run: async () => {
    try {
      const auto = document.querySelector('input[name="sch-mode"]:checked')?.value === 'auto';
      const job = await api(`/api/posts/${encodeURIComponent(state.post.slug)}/programmer`, { method: 'POST', body: { date: $('#sch-date').value, auto } });
      closeModal(); await pollJobs(); showJob(job.id);
    } catch (err) { toast(err.message); }
  } }]);
}

function draftFlow() {
  const e = state.etat;
  if (!e.tiktokConfigure || !e.tiktokConnecte) {
    modal('TikTok pas encore connecté', el('p', {}, 'Il faut d’abord renseigner tes clés TikTok et te connecter. Tout se fait dans les réglages, une seule fois.'),
      [{ label: 'Plus tard' }, { label: 'Aller aux réglages', primary: true, run: () => { closeModal(); go('#/reglages'); } }]);
    return;
  }
  if (state.dirty) { toast('Enregistre et génère d’abord tes modifications (⌘S)'); return; }
  modal('Envoyer en brouillon ?', [
    el('p', {}, 'Ce qui va se passer :'),
    el('ol', {},
      el('li', {}, 'Les slides sont converties en JPEG et mises en ligne sur ton site GitHub Pages.'),
      el('li', {}, 'TikTok les récupère et dépose le carrousel et sa légende dans ta boîte de réception.'),
      el('li', {}, 'Rien n’est publié : tu ajoutes le son et tu publies depuis l’appli.')),
  ], [{ label: 'Annuler' }, { label: 'Envoyer', primary: true, run: async () => {
    try { const job = await api(`/api/posts/${encodeURIComponent(state.post.slug)}/brouillon`, { method: 'POST' }); closeModal(); await pollJobs(); showJob(job.id); }
    catch (err) { toast(err.message); }
  } }]);
}

function publishedFlow() {
  modal('Marquer comme publié ?', el('p', {}, 'À faire une fois le post publié depuis l’appli TikTok.'), [
    { label: 'Annuler' },
    { label: 'Marquer publié', primary: true, run: async () => {
      closeModal();
      loadDetail(await api(`/api/posts/${encodeURIComponent(state.post.slug)}/publie`, { method: 'POST' }));
      toast('Post marqué comme publié');
      route();
    } },
  ]);
}

// ================= RÉGLAGES =================
async function renderSettings(r) {
  const result = r.params.get('tiktok');
  if (result) { toast(result === 'ok' ? 'Compte TikTok connecté' : `Connexion TikTok : ${result}`); history.replaceState(null, '', '#/reglages'); state.currentHash = '#/reglages'; }
  show(el('div', { class: 'page-head' }, el('div', {}, el('p', { class: 'eyebrow' }, 'Configuration'), el('h1', { class: 'page-title' }, 'Réglages'))), el('p', { class: 'hint' }, 'Chargement…'));
  const [values, tk, service, mc] = await Promise.all([api('/api/reglages'), api('/api/tiktok'), api('/api/service'), api('/api/metricool')]);
  const checking = state.jobs.find(j => j.kind === 'metricool' && !j.endedAt);

  const field = (labelText, key, { type = 'text', placeholder = '' } = {}) => {
    const i = el('input', { type, id: `set-${key}`, placeholder, autocomplete: 'off' });
    i.value = type === 'password' ? '' : values[key] ?? '';
    return el('label', { class: 'field' }, el('span', { class: 'field-label' }, labelText), i);
  };
  const collect = () => Object.fromEntries(['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'PAGES_BASE_URL', 'TIKTOK_REDIRECT_URI', 'VEILLE_HEURE'].map(k => [k, $(`#set-${k}`)?.value ?? '']));
  const saveSettings = async (silent = false) => {
    const v = collect();
    if (v.PAGES_BASE_URL && !v.PAGES_BASE_URL.endsWith('/')) v.PAGES_BASE_URL += '/';
    v.TIKTOK_REDIRECT_URI = v.PAGES_BASE_URL ? `${v.PAGES_BASE_URL}callback.html` : v.TIKTOK_REDIRECT_URI;
    await api('/api/reglages', { method: 'PUT', body: v });
    await refreshGlobal();
    if (!silent) { toast('Réglages enregistrés'); route(); }
  };
  const step = (n, done, title, ...content) => el('div', { class: 'step' }, el('div', { class: `step-n ${done ? 'done' : ''}`, 'aria-label': done ? 'Étape terminée' : `Étape ${n}` }, done ? '✓' : n), el('div', { class: 'step-body' }, el('h3', { class: 'step-title' }, title), content));
  const redirect = values.PAGES_BASE_URL ? `${values.PAGES_BASE_URL}callback.html` : values.TIKTOK_REDIRECT_URI;
  const copyRow = (labelText, value) => value && el('div', { class: 'field' }, el('span', { class: 'field-label' }, labelText),
    el('div', { class: 'copy-row' }, el('input', { type: 'text', value, readonly: true, 'aria-label': labelText }), el('button', { class: 'btn btn-small', type: 'button', onclick: () => copy(value) }, 'Copier')));
  const hours = el('select', { id: 'set-VEILLE_HEURE' }, [6, 7, 8, 9, 10, 11, 12].map(h => el('option', { value: String(h) }, `${h} h`)));
  hours.value = values.VEILLE_HEURE || '8';

  show(
    el('div', { class: 'page-head' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Configuration'), el('h1', { class: 'page-title' }, 'Réglages')),
      el('div', { class: 'page-actions' }, el('a', { class: 'btn', href: '#/guide' }, 'Guide pas à pas'), el('button', { class: 'btn btn-primary', type: 'button', onclick: () => saveSettings() }, 'Enregistrer'))),
    el('div', { class: 'settings' },
      el('section', { class: 'panel-card' },
        el('h2', { class: 'panel-title' }, 'Publication sur TikTok'),
        el('p', { class: 'hint' }, 'Le studio programme tes carrousels via Metricool, qui a déjà l’autorisation de TikTok : rien à faire valider.'),
        step(1, true, 'Ton compte Metricool',
          el('p', { class: 'hint' }, 'Compte gratuit (20 posts programmés par mois), avec ton TikTok connecté dans ', el('a', { href: 'https://app.metricool.com', target: '_blank', rel: 'noopener' }, 'app.metricool.com'), '.')),
        step(2, !!mc?.tiktok, 'Le lien entre Claude et Metricool',
          el('p', { class: 'hint' }, 'Le connecteur Metricool de Claude (claude.ai > Paramètres > Connecteurs). C’est lui que le studio utilise.'),
          mc?.tiktok ? el('div', { class: 'account' }, el('div', { style: 'flex:1' }, el('strong', {}, `Compte TikTok relié : ${mc.tiktok}`), el('p', { class: 'hint' }, `Vérifié le ${new Date(mc.verifie).toLocaleString('fr-FR')}`))) : null,
          el('div', {}, el('button', { class: 'btn btn-small', type: 'button', disabled: !!checking, onclick: async () => {
            try { const job = await api('/api/metricool/verifier', { method: 'POST' }); await pollJobs(); toast('Vérification en cours (10 s environ)'); const wait = setInterval(async () => { const j = await api(`/api/jobs/${job.id}`); if (j.endedAt) { clearInterval(wait); toast(j.error ? `Metricool : ${j.error}` : `Compte TikTok relié : ${j.result.tiktok}`); route(); } }, 2000); }
            catch (e) { toast(e.message); }
          } }, checking ? 'Vérification…' : 'Vérifier la connexion'))),
        step(3, false, 'L’appli Metricool sur ton téléphone',
          el('p', { class: 'hint' }, 'Installe l’appli Metricool et active ses notifications : à l’heure prévue, elle te prévient pour que tu publies toi-même avec le son tendance.'))),
      el('details', { class: 'panel-card advanced' },
        el('summary', {}, 'Option avancée : API TikTok directe (demande une validation de TikTok)'),
        el('p', { class: 'hint' }, 'Pour envoyer en brouillon sans Metricool. Nécessite une appli développeur TikTok, validée par TikTok pour un usage public.'),
        step(1, tk.cles, 'Les clés de ton appli TikTok',
          el('p', { class: 'hint' }, 'Sur ', el('a', { href: 'https://developers.tiktok.com/apps', target: '_blank', rel: 'noopener' }, 'developers.tiktok.com'), ', ouvre ton appli : les clés sont en haut de la page. Pour les tests, prends celles de la Sandbox.'),
          el('div', { class: 'row' }, field('Client key', 'TIKTOK_CLIENT_KEY'), field('Client secret', 'TIKTOK_CLIENT_SECRET', { type: 'password', placeholder: values.TIKTOK_CLIENT_SECRET ? 'Déjà enregistré (laisser vide pour garder)' : '' })),
          el('div', {}, el('button', { class: 'btn btn-small', type: 'button', onclick: () => saveSettings() }, 'Enregistrer les clés'))),
        step(2, tk.pages, 'Le site qui héberge tes images',
          el('p', { class: 'hint' }, 'TikTok ne prend les photos que depuis une adresse en ligne : ton site GitHub Pages, gratuit. ', el('a', { href: '#/guide' }, 'Comment le créer')),
          field('Adresse de ton site GitHub Pages', 'PAGES_BASE_URL', { type: 'url', placeholder: 'https://ton-compte.github.io/decrypte-marketing/' }),
          values.PAGES_BASE_URL && el('div', { class: `check ${tk.pages ? 'ok' : 'warn'}` }, tk.pages ? 'Site en ligne' : 'Site introuvable pour l’instant : publie le projet sur GitHub et active Pages (voir le guide).'),
          copyRow('À coller dans TikTok > Login Kit > Redirect URI', redirect),
          copyRow('À déclarer dans TikTok > URL properties (préfixe d’URL)', values.PAGES_BASE_URL),
          values.PAGES_BASE_URL && el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Fichier de vérification donné par TikTok (URL properties > Verify)'),
            el('input', { type: 'file', accept: '.txt', onchange: async e => {
              const file = e.target.files[0]; if (!file) return;
              try {
                const res = await fetch('/api/tiktok/verification', { method: 'POST', headers: { 'X-Filename': encodeURIComponent(file.name) }, body: file });
                const data = await res.json(); if (!res.ok) throw new Error(data.error);
                toast(data.message);
              } catch (err) { toast(err.message); }
            } })),
          el('input', { type: 'hidden', id: 'set-TIKTOK_REDIRECT_URI', value: redirect ?? '' }),
          el('div', {}, el('button', { class: 'btn btn-small', type: 'button', onclick: () => saveSettings() }, 'Enregistrer l’adresse'))),
        step(3, tk.connecte, 'Ton compte TikTok',
          tk.connecte
            ? el('div', { class: 'account' }, tk.compte?.avatar_url && el('img', { src: tk.compte.avatar_url, alt: '' }),
              el('div', { style: 'flex:1' }, el('strong', {}, tk.compte?.display_name ?? 'Compte connecté'), el('p', { class: 'hint' }, 'Les brouillons arriveront dans ta boîte de réception TikTok.')),
              el('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: async () => { await api('/api/tiktok/deconnexion', { method: 'POST' }); await refreshGlobal(); route(); } }, 'Se déconnecter'))
            : [el('div', {}, el('button', { class: 'btn btn-primary', type: 'button', disabled: !(tk.cles && redirect), onclick: async () => {
                try { await saveSettings(true); const { url } = await api('/api/tiktok/connexion', { method: 'POST' }); location.href = url; } catch (e) { toast(e.message); }
              } }, 'Se connecter à TikTok')),
              !(tk.cles && redirect) && el('p', { class: 'hint' }, 'Remplis d’abord les étapes 1 et 2.')],
          tk.erreur && el('div', { class: 'check err' }, tk.erreur))),
      el('section', { class: 'panel-card' },
        el('h2', { class: 'panel-title' }, 'Veille automatique'),
        el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Heure de la veille quotidienne'), hours),
        el('p', { class: 'hint' }, 'Si ton Mac dort à cette heure-là, la veille se lance à son réveil.'),
        el('div', {}, el('button', { class: 'btn btn-small', type: 'button', onclick: () => saveSettings() }, 'Enregistrer'))),
      el('section', { class: 'panel-card' },
        el('h2', { class: 'panel-title' }, 'Studio toujours disponible'),
        service.installe
          ? [el('div', { class: 'check ok' }, 'Le studio démarre tout seul à chaque ouverture de session : http://localhost:4321 est toujours disponible et la veille part chaque matin.'),
             el('div', {}, el('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: async () => { await api('/api/service', { method: 'DELETE' }); toast('Démarrage automatique désactivé'); route(); } }, 'Désactiver le démarrage automatique'))]
          : [el('p', { class: 'hint' }, 'Pour l’instant, le studio s’arrête quand ton Mac redémarre. Active le démarrage automatique : il sera toujours ouvert sur http://localhost:4321 et la veille partira chaque matin toute seule. Tu peux le désactiver ici à tout moment.'),
             el('div', {}, el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { try { await api('/api/service', { method: 'POST' }); toast('Démarrage automatique activé'); route(); } catch (e) { toast(e.message); } } }, 'Activer le démarrage automatique'))])));
}

async function renderGuide() {
  const { markdown: md } = await api('/api/guide');
  show(el('a', { class: 'back', href: '#/reglages' }, '← Réglages'), el('section', { class: 'panel-card sources' }, markdown(md)));
}

// ================= ACTIVITÉ =================
let pollTimer;
const seenDone = new Set();
let jobsLoaded = false;

async function pollJobs() {
  clearTimeout(pollTimer);
  let jobs;
  try { jobs = await api('/api/jobs'); } catch { pollTimer = setTimeout(pollJobs, 5000); return; }
  state.jobs = jobs;
  let changed = false;
  for (const j of jobs) {
    if (!j.endedAt || seenDone.has(j.id)) continue;
    seenDone.add(j.id);
    if (!jobsLoaded) continue;
    changed = true;
    if (j.kind === 'rediger' && j.status === 'terminé') toast(`Post prêt : ${j.meta.sujet}`);
    else if (j.kind === 'veille' && j.status === 'terminé') toast('Nouvelle veille disponible');
    else if (j.status === 'échec') toast(`Échec : ${j.label}`);
  }
  jobsLoaded = true;
  const active = jobs.filter(j => !j.endedAt);
  $('#activity-pulse').hidden = !active.length;
  $('#badge-activity').textContent = active.length || '';
  renderJobs();
  if (changed) await refreshGlobal();
  // Rafraîchit la veille et la galerie (progression, nouveaux posts), jamais une page de post en cours d'édition
  const page = parseRoute().name;
  if ((changed || active.length) && ['veille', 'posts'].includes(page) && !$('#modal').open) route();
  pollTimer = setTimeout(pollJobs, active.length ? 4000 : 15000);
}

function renderJobs() {
  $('#jobs').replaceChildren(...(state.jobs.length ? state.jobs.map(j => el('li', {},
    el('button', { class: 'job', type: 'button', onclick: () => showJob(j.id) },
      el('span', { class: 'job-head' }, el('span', {}, !j.endedAt && el('span', { class: 'pulse' }), ' ', j.label), el('span', { class: 'job-status', 'data-s': j.status }, j.status)),
      el('span', { class: 'job-log' }, j.error ?? j.lastLog ?? ''))))
    : [el('li', { class: 'hint' }, 'Aucune tâche en cours. Les veilles, rédactions et envois apparaissent ici.')]));
}

function toggleActivity(open) {
  const d = $('#activity');
  const show = open ?? d.hidden;
  d.hidden = !show;
  $('#btn-activity').setAttribute('aria-expanded', String(show));
}

async function showJob(id) {
  const log = el('div', { class: 'log' }, 'Chargement…');
  const dlg = modal('Activité', log, [{ label: 'Fermer' }]);
  let timer;
  const refresh = async () => {
    const j = await api(`/api/jobs/${id}`);
    $('#modal-title').textContent = j.label;
    log.textContent = [`Statut : ${j.status}`, ...j.logs, j.error && `\n❌ ${j.error}`,
      j.kind === 'rediger' && j.status === 'terminé' && `\n✅ Post créé : ${j.result}`,
      j.kind === 'brouillon' && j.status === 'terminé' && (j.result === 'SEND_TO_USER_INBOX' ? '\n📥 Brouillon reçu : ouvre la boîte de réception de l’appli TikTok, ajoute le son et publie.' : `\n⏳ Toujours en traitement (${j.result}).`)].filter(Boolean).join('\n');
    log.scrollTop = log.scrollHeight;
    if (j.kind === 'programmer' && j.status === 'terminé' && j.result?.plannerUrl && !document.getElementById('open-metricool')) {
      log.textContent += `\n\n✅ Programmé dans Metricool (compte TikTok ${j.result.tiktok ?? ''}).`;
      $('#modal-actions').prepend(el('a', { class: 'btn btn-primary', id: 'open-metricool', href: j.result.plannerUrl, target: '_blank', rel: 'noopener' }, 'Voir dans Metricool'));
      if (state.post?.slug === j.meta?.slug) { loadDetail(await api(`/api/posts/${encodeURIComponent(j.meta.slug)}`)); route(); }
    }
    if (j.kind === 'rediger' && j.status === 'terminé' && !document.getElementById('open-new-post')) {
      $('#modal-actions').prepend(el('button', { class: 'btn btn-primary', id: 'open-new-post', type: 'button', onclick: () => { dlg.close(); go(postHash(j.result)); } }, 'Ouvrir le post'));
    }
    if (j.endedAt) clearInterval(timer);
  };
  timer = setInterval(refresh, 2000);
  dlg.addEventListener('close', () => clearInterval(timer), { once: true });
  refresh();
}

// ================= BRANCHEMENTS =================
$('#btn-new').addEventListener('click', newPostFlow);
$('#btn-activity').addEventListener('click', () => toggleActivity());
$('#close-activity').addEventListener('click', () => toggleActivity(false));
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (parseRoute().name === 'post' && state.post) generateNow(false); }
  if (e.key === 'Escape' && !$('#activity').hidden) toggleActivity(false);
});
window.addEventListener('beforeunload', e => { if (state.dirty) e.preventDefault(); });

(async () => {
  try {
    // Anciennes adresses redirigées vers la nouvelle structure
    if (/^#post\//.test(location.hash)) history.replaceState(null, '', postHash(decodeURIComponent(location.hash.slice(6))));
    if (!location.hash || location.hash === '#' || location.hash === '#veille') history.replaceState(null, '', '#/veille');
    state.currentHash = location.hash;
    await Promise.all([refreshGlobal(), pollJobs()]);
    const v = await api('/api/veille');
    if (v.date === v.today) updateVeilleBadge(v.veille?.sujets ?? []);
    await route();
  } catch (e) { toast(e.message); }
})();
