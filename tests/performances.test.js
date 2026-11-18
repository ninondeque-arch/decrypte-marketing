import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPerformances, dayOf, fetchTikTokVideos, hookType, likeRate, matchVideos, normalize, similarity } from '../src/publish/stats.js';

// ---------- stats ----------
test('hookType classe les accroches', () => {
  assert.equal(hookType('Ton enfance Disney Channel coûte 50 $.'), 'chiffre');
  assert.equal(hookType('« Delena is back » : la nostalgie a un prix.'), 'citation');
  assert.equal(hookType('Comment vendre un blush ?'), 'question');
  assert.equal(hookType('Elle vend du rouge sans pub.'), 'affirmation / paradoxe');
});

test('likeRate : j\'aime par vue en %', () => {
  assert.equal(likeRate({ vues: 2355, jaime: 120 }), 5.1);
  assert.equal(likeRate({ vues: 0, jaime: 3 }), 0);
});

test('matchVideos retrouve chaque vidéo malgré une légende retouchée, sinon par la date', () => {
  const videos = [
    { date: '20261101214030', description: '= un coffret blush à 50 $ 💗👑 Rare Beauty ressort le surnom « Delena » et recycle deux teintes déjà en vente. Tu achètes ou pas ? #rarebeauty #selenagomez' },
    { date: '20261102113344', description: 'Juste Claude, Perplexity, Grok, ChatGPT… et Notion au milieu. Coup de génie ou pub ratée ? #marketing #notion' },
    { date: '20261116120000', description: 'Vidéo sans légende' },
  ];
  const posts = [
    { slug: 'rare', jours: ['2026-11-02'], legende: 'Selena Gomez + Demi Lovato + un téléfilm Disney de 2009 = un coffret blush à 50 $ 💗👑\nRare Beauty ressort le surnom « Delena » et recycle deux teintes déjà en vente.\nTu achètes ou pas ?\n#rarebeauty #selenagomez' },
    { slug: 'notion', jours: ['2026-11-05'], legende: 'Un panneau sans un mot. Juste Claude, Perplexity, Grok, ChatGPT… et Notion au milieu.\nCoup de génie ou pub ratée ?' },
    { slug: 'autre', jours: ['2026-11-16'], legende: 'Une légende réécrite de fond en comble' },
    { slug: 'perdu', jours: ['2026-11-20'], legende: 'Rien à voir' },
  ];
  const m = matchVideos(posts, videos);
  assert.equal(m.get('rare'), videos[0]);
  assert.equal(m.get('notion'), videos[1]);
  assert.equal(m.get('autre'), videos[2]);
  assert.equal(m.has('perdu'), false);
  assert.equal(similarity('un deux trois', 'un deux trois'), 0); // trop peu de mots pour conclure
  assert.equal(dayOf('20261115165414'), '2026-11-15');
  assert.equal(dayOf('2026-11-15T18:02:00+01:00'), '2026-11-15');
  assert.equal(normalize('Élan #hype !'), 'elan');
});

test('fetchTikTokVideos n\'utilise que les outils Metricool en lecture et convertit les nombres', async () => {
  let opts, prompt;
  const run = async (p, o) => { prompt = p; opts = o; return { isError: false, text: 'Voici : {"videos": [{"date": "2026-11-15", "url": "u", "description": "d", "vues": "2 355", "jaime": 120, "commentaires": 8, "partages": 3}]}' }; };
  const v = await fetchTikTokVideos({ from: '2026-11-01', to: '2026-11-18', run });
  assert.equal(v[0].vues, 2355);
  assert.ok(opts.tools.every(t => /getBrandSettings|getAnalyticsDataByMetrics/.test(t)));
  assert.match(prompt, /TKPO07/);
  await assert.rejects(fetchTikTokVideos({ from: 'a', to: 'b', run: async () => ({ isError: false, text: '{"error": "pas de compte"}' }) }), /pas de compte/);
});

test('buildPerformances classe les posts et résume ce qu\'ont en commun les meilleurs', () => {
  const e = (slug, vues, extra = {}) => ({ slug, sujet: slug, rubrique: 'Le marketing derrière la culture pop', secteur: 'Tech', accroche: 'Pourquoi ?', typeAccroche: 'question', stats: { vues, jaime: vues / 20, commentaires: 1, partages: 1 }, ...extra });
  const md = buildPerformances([
    e('notion', 760), e('rare-beauty', 2355, { secteur: 'Beauté', typeAccroche: 'chiffre' }), e('quince', 800), e('sans-stats', 0, { stats: null }),
  ], new Date('2026-11-18'));
  const ranking = md.slice(md.indexOf('## Classement'), md.indexOf('## Ce qu'));
  assert.ok(ranking.indexOf('rare-beauty') < ranking.indexOf('quince') && ranking.indexOf('quince') < ranking.indexOf('notion'));
  assert.match(md, /2\s355/);
  assert.match(md, /5 %/);
  assert.match(md, /\*\*Secteur\*\* : Beauté \(1\/1\)/);
  assert.match(md, /sans stats retrouvées : sans-stats/);
  assert.match(buildPerformances([]), /Aucune stat/);
});
