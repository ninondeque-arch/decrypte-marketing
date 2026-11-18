import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeZip } from '../src/demo/zip.js';
import { pushPublishedPost, pushVeille } from '../src/publish/github.js';

const theme = JSON.parse(readFileSync(new URL('../assets/theme-defaut.json', import.meta.url)));

test('writeZip produit une archive lisible, fichiers à plat', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  writeFileSync(join(dir, 'légende.txt'), 'Bonjour 👋');
  writeFileSync(join(dir, 'slide.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x42]));
  const out = join(dir, 'post.zip');
  writeZip(out, [join(dir, 'légende.txt'), join(dir, 'slide.jpg')]);
  const buf = readFileSync(out);
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  try {
    const list = execFileSync('unzip', ['-t', out], { encoding: 'utf8' }); // contrôle CRC par l'outil système s'il existe
    assert.match(list, /No errors detected/);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
});

test('pushPublishedPost n\'envoie que le dossier du post et le calendrier', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pub-'));
  writeFileSync(join(dir, 'slides-config.json'), JSON.stringify({ sujet: 'Rare Beauty', theme, slides: [] }));
  const calls = [];
  const git = (...args) => { calls.push(args); return args[0] === 'diff' ? 'posts/x/slides-config.json' : ''; };
  assert.equal(pushPublishedPost(dir, { git }), true);
  assert.deepEqual(calls.map(c => c[0]), ['add', 'diff', 'commit', 'push']);
  const commit = calls[2];
  assert.equal(commit[2], 'Post publié : Rare Beauty');
  assert.deepEqual(commit.slice(commit.indexOf('--') + 1).at(-1), 'calendrier.md');
  assert.ok(!calls[0].includes('.') && !calls[0].includes('-A'), 'jamais de git add global');

  const idle = [];
  assert.equal(pushPublishedPost(dir, { git: (...a) => { idle.push(a[0]); return ''; } }), false);
  assert.deepEqual(idle, ['add', 'diff']); // rien de nouveau : ni commit ni push
});

test('pushVeille n\'envoie que le fichier de la veille', () => {
  const calls = [];
  const git = (...args) => { calls.push(args); return args[0] === 'diff' ? 'veille/2026-11-20.json' : ''; };
  pushVeille('2026-11-20', { git });
  assert.deepEqual(calls[0], ['add', '--', 'veille/2026-11-20.json']);
  assert.deepEqual(calls[2], ['commit', '-m', 'Veille du 2026-11-20', '--', 'veille/2026-11-20.json']);
  assert.deepEqual(calls[3], ['push']);
});
