import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTheme, contrast } from '../src/render/contrast.js';
import { countWords, nbsp, tokenize } from '../src/render/typo.js';

test('nbsp : espaces insécables français', () => {
  assert.equal(nbsp('Résultat ?'), 'Résultat ?');
  assert.equal(nbsp('« oui »'), '« oui »');
  assert.equal(nbsp('80 000 vues, 90 %'), '80 000 vues, 90 %');
});

test('tokenize : marque les mots des expressions surlignées', () => {
  const toks = tokenize('la mort de Duo arrive', ['mort de Duo']);
  assert.deepEqual(toks.filter(t => t.hl).map(t => t.t.trim()), ['mort', 'de', 'Duo']);
  assert.equal(toks.map(t => t.t).join(''), 'la mort de Duo arrive');
});

test('countWords ignore la ponctuation isolée', () => {
  assert.equal(countWords('Résultat ? Une leçon — forte.'), 4);
});

test('contraste WCAG : noir/blanc = 21:1', () => {
  assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21);
});

test('checkTheme refuse une palette illisible', () => {
  const errors = checkTheme({ palettes: { pale: { bg: '#FFFFFF', ink: '#CCCCCC', boxBg: '#000000', boxInk: '#FFFFFF' } }, sequence: ['pale'] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /palette « pale » \(texte\)/);
});
