import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { numbersIn, validatePost } from '../src/editorial/validate.js';
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

test('structure : 6 à 8 slides, chiffres en avant-dernier', () => {
  const slides = base().filter(s => s.type !== 'stats');
  const { dir, cfg } = fixture({ slides, sources: '80 000 5' });
  const { errors } = validatePost(dir, cfg);
  assert.ok(errors.some(e => e.includes('entre 6 et 8')));
  assert.ok(errors.some(e => e.includes('avant-dernière')));
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
