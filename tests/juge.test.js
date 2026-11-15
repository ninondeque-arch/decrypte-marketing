import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draft } from '../src/actions.js';
import { assertJudged, CRITERES, JUGE_TOOLS, judgePost, overrideJudgement, parseJudgement, readJudgement, saveJudgement, verdictFor } from '../src/agent/juge.js';

const theme = JSON.parse(readFileSync(new URL('../assets/theme-defaut.json', import.meta.url)));

/** Post minimal, avec aperçu (le contenu du PNG n'est pas lu : runClaude est simulé). */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'juge-'));
  const slides = [{ type: 'hook', title: 'Pourquoi ce panneau intrigue ?' }, { type: 'outro', lesson: 'Une leçon.', conclusion: 'Fin.', cta: 'Abonne-toi !' }];
  writeFileSync(join(dir, 'slides-config.json'), JSON.stringify({ sujet: 'Test', rubrique: 'Le flop', secteur: 'Tech', statut: 'prêt', theme, slides }));
  writeFileSync(join(dir, 'legende.txt'), 'Texte\n#a #b #c #d');
  writeFileSync(join(dir, 'sources.md'), '');
  writeFileSync(join(dir, 'apercu.png'), '');
  return dir;
}

const scores = (note = 5) => Object.fromEntries(Object.keys(CRITERES).map(k => [k, { note, justification: `Justification ${k}.` }]));
const answer = (over = {}) => JSON.stringify({ verdict: 'validé', scores: scores(), corrections: [], ...over });

test('parseJudgement lit un JSON entouré de texte ou de balises de code', () => {
  const j = parseJudgement('Voici mon avis :\n```json\n' + answer() + '\n```');
  assert.equal(j.verdict, 'validé');
  assert.equal(j.scores.fidelite.note, 5);
  assert.deepEqual(j.corrections, []);
});

test('parseJudgement refuse une réponse mal formée', () => {
  assert.throws(() => parseJudgement('Je ne peux pas répondre.'), /aucun JSON/);
  assert.throws(() => parseJudgement('{"verdict": "validé", "scores": '), /aucun JSON|JSON invalide/);
  assert.throws(() => parseJudgement('{"verdict": "validé", "scores": {"fidelite": 5}}'), /JSON invalide|mal formée/);
  assert.throws(() => parseJudgement(answer({ verdict: 'bof' })), /verdict/);
  const sansLegende = scores(); delete sansLegende.legende;
  assert.throws(() => parseJudgement(answer({ scores: sansLegende })), /legende/);
  assert.throws(() => parseJudgement(answer({ scores: { ...scores(), ton: { note: 6, justification: 'x' } } })), /ton/);
  assert.throws(() => parseJudgement(answer({ scores: { ...scores(), ton: { note: 4, justification: '' } } })), /justification/);
  assert.throws(() => parseJudgement(answer({ corrections: [{ slide: 2, probleme: 'x', correction_proposee: 'y', bloquant: 'oui' }] })), /bloquant/);
  assert.throws(() => parseJudgement(answer({ corrections: 'aucune' })), /liste/);
});

test('règle du verdict : toutes les notes à 4 ou plus et aucune correction bloquante', () => {
  assert.equal(verdictFor({ scores: scores(4), corrections: [] }), 'validé');
  assert.equal(verdictFor({ scores: { ...scores(5), accroche: { note: 3, justification: 'x' } }, corrections: [] }), 'à corriger');
  assert.equal(verdictFor({ scores: scores(5), corrections: [{ bloquant: false }] }), 'validé');
  assert.equal(verdictFor({ scores: scores(5), corrections: [{ bloquant: true }] }), 'à corriger');
});

test('le verdict annoncé par l\'IA est recalculé selon la règle', () => {
  const j = parseJudgement(answer({ verdict: 'validé', scores: { ...scores(), lecon: { note: 2, justification: 'Floue.' } } }));
  assert.equal(j.verdict, 'à corriger');
  const k = parseJudgement(answer({ verdict: 'à corriger' }));
  assert.equal(k.verdict, 'validé');
});

test('une erreur de fidélité aux sources est toujours bloquante', () => {
  const j = parseJudgement(answer({ corrections: [{ slide: 3, critere: 'fidelite', probleme: 'Chiffre faux', correction_proposee: 'Écrire 200', bloquant: false }] }));
  assert.equal(j.corrections[0].bloquant, true);
  assert.equal(j.verdict, 'à corriger');
});

test('judgePost appelle un juge en lecture seule et enregistre l\'historique des passages', async () => {
  const dir = fixture();
  const calls = [];
  const run = async (prompt, opts) => { calls.push({ prompt, opts }); return { text: calls.length === 1 ? answer({ scores: { ...scores(), clarte: { note: 3, justification: 'Trop long.' } } }) : answer(), isError: false }; };

  const first = await judgePost(dir, { run });
  assert.equal(first.verdict, 'à corriger');
  assert.equal(first.passage, 1);
  assert.deepEqual(calls[0].opts.tools, JUGE_TOOLS);
  assert.equal(calls[0].opts.readOnly, true);
  assert.ok(!JUGE_TOOLS.some(t => /Write|Edit|Bash/.test(t)));
  assert.match(calls[0].prompt, /apercu\.png/);

  const second = await judgePost(dir, { run });
  assert.equal(second.passage, 2);
  assert.equal(second.verdict, 'validé');
  assert.equal(second.historique.length, 1);
  assert.equal(second.historique[0].verdict, 'à corriger');
  assert.ok(second.date);
  assert.deepEqual(readJudgement(dir), second);
});

test('judgePost échoue proprement sur une réponse mal formée, sans écrire juge.json', async () => {
  const dir = fixture();
  await assert.rejects(judgePost(dir, { run: async () => ({ text: 'Pas de JSON ici', isError: false }) }), /illisible/);
  assert.equal(readJudgement(dir), null);
});

test('garde-fou : draft() refuse un post non relu ou à corriger', async () => {
  const dir = fixture();
  await assert.rejects(draft(dir, { log: () => {} }), /Pas encore relu par le juge/);
  saveJudgement(dir, { verdict: 'à corriger', scores: scores(3), corrections: [] });
  await assert.rejects(draft(dir, { log: () => {} }), /Le juge demande des corrections/);
});

test('garde-fou : un post validé ou validé par l\'humaine passe le juge', async () => {
  const dir = fixture();
  saveJudgement(dir, { verdict: 'à corriger', scores: scores(3), corrections: [] });
  const j = overrideJudgement(dir);
  assert.equal(j.override_humain, true);
  assert.ok(j.override_date);
  assert.doesNotThrow(() => assertJudged(dir));
  // draft() va plus loin : il échoue ensuite sur autre chose que le juge (contrôles, slides absentes)
  await assert.rejects(draft(dir, { log: () => {} }), err => !/juge/.test(err.message));

  // Une nouvelle relecture remplace la validation humaine (gardée dans l'historique)
  const next = saveJudgement(dir, { verdict: 'à corriger', scores: scores(3), corrections: [] });
  assert.equal(next.override_humain, undefined);
  assert.equal(next.historique.at(-1).override_humain, true);
  assert.throws(() => assertJudged(dir), /corrections/);
});
