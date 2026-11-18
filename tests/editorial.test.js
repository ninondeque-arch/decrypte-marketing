import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { numbersIn, quoteKey, validatePost } from '../src/editorial/validate.js';
import { varietyAlerts } from '../src/planning/calendar.js';

const theme = JSON.parse(readFileSync(new URL('../assets/theme-defaut.json', import.meta.url)));

function fixture({ slides, sources = '', legend = 'Texte\n#a #b #c #d' }) {
  const dir = mkdtempSync(join(tmpdir(), 'post-'));
  writeFileSync(join(dir, 'sources.md'), sources);
  writeFileSync(join(dir, 'legende.txt'), legend);
  const cfg = { sujet: 'Test', rubrique: 'Le flop', secteur: 'Tech', statut: 'prêt', theme, slides };
  return { dir, cfg };
}

const base = () => [
  { type: 'hook', title: 'Pourquoi cette marque a tout misé ?' },
  { type: 'text', label: 'Le contexte', body: 'Une phrase courte.' },
  { type: 'text', label: "L'idée", body: 'Une autre phrase.' },
  { type: 'list', label: 'La mécanique', items: ['Un', 'Deux', 'Trois'] },
  { type: 'stats', label: 'Les chiffres', items: [{ value: '80 000+', text: 'vues en 5 jours' }] },
  { type: 'outro', lesson: 'Une leçon.', conclusion: 'Une conclusion.', cta: 'Abonne-toi !' },
];

test('numbersIn normalise les séparateurs de milliers et les décimales', () => {
  assert.deepEqual(numbersIn('80 000+ vues, 50,9 milliards, × 540'), ['80000', '50.9', '540']);
});

test('un post conforme passe les contrôles', () => {
  const { dir, cfg } = fixture({ slides: base(), sources: '| 6 | 80 000 vues en 5 jours | Skift |' });
  assert.deepEqual(validatePost(dir, cfg).errors, []);
});

test('un chiffre absent de sources.md est bloquant', () => {
  const { dir, cfg } = fixture({ slides: base(), sources: '80 000 vues' });
  const { errors } = validatePost(dir, cfg);
  assert.ok(errors.some(e => e.includes('« 5 »')), errors.join('\n'));
});

test('accroche trop longue et slide trop bavarde sont refusées', () => {
  const slides = base();
  slides[0].title = 'Voici une accroche beaucoup trop longue pour une première slide TikTok';
  slides[1].body = Array(30).fill('mot').join(' ');
  const { dir, cfg } = fixture({ slides, sources: '80 000 5' });
  const { errors } = validatePost(dir, cfg);
  assert.ok(errors.some(e => e.startsWith('accroche trop longue')));
  assert.ok(errors.some(e => e.startsWith('slide 2 : 30 mots')));
});

test('structure : 6 à 8 slides, 8 conseillées, conclusion en dernier', () => {
  const short = base().slice(0, 4).concat(base().at(-1));
  let r = validatePost(...Object.values(fixture({ slides: short, sources: '80 000 5' })));
  assert.ok(r.errors.some(e => e.includes('entre 6 et 8')));
  const noOutro = base().slice(0, -1).concat({ type: 'text', label: 'Fin', body: 'Une phrase.' });
  r = validatePost(...Object.values(fixture({ slides: noOutro, sources: '80 000 5' })));
  assert.ok(r.errors.some(e => e.includes('conclusion')));
  r = validatePost(...Object.values(fixture({ slides: base(), sources: '80 000 5' })));
  assert.ok(r.warnings.some(w => w.includes('la structure en prévoit 8')));
});

/** Carrousel conforme à la structure en 8 slides. */
const eight = () => [
  { type: 'hook', title: 'Pourquoi Selena Gomez vend un blush ?', fact: '2 stars + un téléfilm de 2009 = 50 $', highlight: ['50 $'] },
  { type: 'text', label: 'Pourquoi maintenant', body: 'La nostalgie fait vendre.', source: 'Source : Hypebae', highlight: ['nostalgie'] },
  { type: 'text', label: 'Le cas', body: 'Un coffret, deux stars. 3 leçons →', highlight: ['deux stars'] },
  { type: 'lesson', label: 'Leçon 1', title: 'La nostalgie est un raccourci émotionnel.', body: 'On achète un souvenir.', quote: 'The nostalgia is so real', attribution: 'Commentaire TikTok', highlight: ['raccourci émotionnel'] },
  { type: 'lesson', label: 'Leçon 2', title: 'Deux stars valent mieux qu\'une.', body: 'Chaque fan amène l\'autre.', highlight: ['Deux stars'] },
  { type: 'lesson', label: 'Leçon 3', title: 'Le recyclage peut passer pour une nouveauté.', body: 'Les teintes existaient déjà.', highlight: ['recyclage'] },
  { type: 'list', label: 'Cas comparables', items: ['Quince : le pull rouge de Ross → rupture de stock'], highlight: ['rupture de stock'] },
  { type: 'outro', title: 'À retenir', lesson: 'La nostalgie vend.', cta: 'Derrière la Hype · abonne-toi pour le prochain décryptage', highlight: ['nostalgie'] },
];
const sevenSources = '| 1 | 2 stars, téléfilm de 2009, coffret à 50 $ | Hypebae |\n| 4 | « THE NOSTALGIA IS SO REAL » | TikTok |\n| 3 | 3 leçons |';

test('la structure en 8 slides passe les contrôles sans avertissement de structure', () => {
  const { dir, cfg } = fixture({ slides: eight(), sources: sevenSources });
  const { errors, warnings } = validatePost(dir, cfg);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('une citation absente de sources.md est bloquante (ponctuation et casse ignorées)', () => {
  const slides = eight();
  slides[3].quote = 'Une phrase que personne n\'a dite';
  const { dir, cfg } = fixture({ slides, sources: sevenSources });
  assert.ok(validatePost(dir, cfg).errors.some(e => e.includes('la citation')));
  assert.equal(quoteKey('« Vous avez pensé à tout, sauf à vous. »'), quoteKey('Vous avez pensé à tout. Sauf à vous'));
});

test('les chiffres de la ligne de fait sont contrôlés, une leçon sans titre est refusée', () => {
  const slides = eight();
  slides[0].fact = 'Un coffret à 75 $';
  slides[4].title = '';
  const { dir, cfg } = fixture({ slides, sources: sevenSources });
  const { errors } = validatePost(dir, cfg);
  assert.ok(errors.some(e => e.includes('« 75 »')));
  assert.ok(errors.some(e => e.includes('slide 5 : une leçon a besoin d\'un titre')));
});

test('1 à 2 passages surlignés par slide', () => {
  const slides = eight();
  slides[1].highlight = [];
  slides[2].highlight = ['Un', 'coffret', 'deux'];
  const { dir, cfg } = fixture({ slides, sources: sevenSources });
  const { warnings } = validatePost(dir, cfg);
  assert.ok(warnings.some(w => w.startsWith('slide 2 : aucun passage surligné')));
  assert.ok(warnings.some(w => w.startsWith('slide 3 : 3 passages surlignés')));
});

test('variété : deux secteurs identiques d\'affilée', () => {
  const alerts = varietyAlerts([{ sujet: 'A', secteur: 'Tech' }, { sujet: 'B', secteur: 'Tech' }]);
  assert.equal(alerts.length, 1);
});

test('variété : 10 posts avec trop peu de secteurs et aucune startup', () => {
  const posts = Array.from({ length: 10 }, (_, i) => ({ sujet: `P${i}`, secteur: ['Tech', 'Food', 'Sport'][i % 3], rubrique: 'Le marketing derrière la culture pop' }));
  const alerts = varietyAlerts(posts);
  assert.ok(alerts.some(a => a.includes('3 secteurs')));
  assert.ok(alerts.some(a => a.includes('startup')));
});
