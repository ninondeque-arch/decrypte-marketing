#!/usr/bin/env node
// Point d'entrée : une commande par étape du pipeline.
import { copyFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { draft, generate, markPublished, verify } from './actions.js';
import { PAGES_DIR } from './config.js';
import { resolvePost } from './editorial/post.js';
import { writeCalendar } from './planning/calendar.js';
import { login } from './tiktok/oauth.js';

function report({ errors, warnings }) {
  for (const w of warnings) console.log(`⚠️  ${w}`);
  for (const e of errors) console.log(`❌ ${e}`);
  if (!errors.length) console.log('✅ Contrôles éditoriaux OK');
  return errors.length === 0;
}

const commands = {
  /** Vérifie un post sans rien générer. */
  async verifier([query]) {
    if (!report(verify(resolvePost(query)))) process.exitCode = 1;
  },

  /** Contrôle, détourage, rendu des PNG, compression, mise à jour du calendrier. */
  async images([query, flag]) {
    const dir = resolvePost(query);
    const res = await generate(dir, { force: flag === '--force' });
    report(res);
    if (!res.rendered) { console.log('Corrige le slides-config.json (ou ajoute --force pour un aperçu).'); process.exitCode = 1; return; }
    console.log(`🖼  ${res.files.length} slides générées dans ${basename(dir)}/ (PNG compressés de ${res.gain} % en moyenne)`);
    console.log(`   Aperçu : ${join(dir, 'apercu.png')}`);
  },

  /** Fait relire le post par l'agent juge (IA indépendante, lecture seule) et enregistre juge.json. */
  async juger([query]) {
    const { CRITERES, judgePost } = await import('./agent/juge.js');
    const j = await judgePost(resolvePost(query), { onLog: console.log });
    console.log(`\n⚖️  Verdict : ${j.verdict.toUpperCase()} (passage ${j.passage})`);
    for (const [k, label] of Object.entries(CRITERES)) console.log(`   ${j.scores[k].note}/5  ${label} : ${j.scores[k].justification}`);
    if (j.corrections.length) console.log('\nCorrections :');
    if (j.comparaison) console.log(`\n📈 ${j.comparaison}`);
    for (const c of j.corrections) console.log(`   ${c.bloquant ? '⛔' : '•'} ${typeof c.slide === 'number' ? `Slide ${c.slide}` : c.slide ?? 'Général'} : ${c.probleme}\n     → ${c.correction_proposee}`);
  },

  /** Envoie le carrousel et sa légende dans la boîte de réception TikTok (brouillon). */
  async brouillon([query, flag]) {
    const status = await draft(resolvePost(query), { push: flag !== '--sans-push' });
    console.log(status === 'SEND_TO_USER_INBOX'
      ? '📥 Brouillon reçu : ouvre l\'appli TikTok (notification « boîte de réception »), ajoute le son et publie.'
      : `⏳ Toujours en traitement (${status}). Vérifie ta boîte de réception TikTok dans quelques minutes.`);
  },

  /** À lancer une fois le post publié depuis l'appli. */
  async publie([query]) {
    const dir = resolvePost(query);
    markPublished(dir);
    console.log(`✅ ${basename(dir)} marqué comme publié`);
  },

  /** Relève les stats TikTok des posts publiés (Metricool) et régénère performances.md. */
  async stats() {
    const { runStats } = await import('./publish/stats.js');
    const { trouves, manquants } = await runStats({ onLog: console.log });
    console.log(`\n📈 Stats enregistrées pour ${trouves.length} post${trouves.length > 1 ? 's' : ''} · performances.md mis à jour`);
    if (manquants.length) console.log(`⚠️  Vidéo TikTok introuvable pour : ${manquants.join(', ')}`);
  },

  async calendrier() {
    const { posts, alerts } = writeCalendar();
    console.log(`calendrier.md mis à jour (${posts.length} post${posts.length > 1 ? 's' : ''})`);
    alerts.forEach(a => console.log(`⚠️  ${a}`));
  },

  /** Ouvre le studio visuel local. */
  async studio() { await import('./studio/server.js'); },

  /** Lance la veille du jour avec Claude Code. */
  async veille([date]) {
    const { runVeille, today } = await import('./planning/veille.js');
    console.log(await runVeille({ date: date ?? today(), onLog: console.log }));
  },

  /** Démarre le studio automatiquement à chaque ouverture de session (macOS). */
  async 'studio-installer'() {
    const { install } = await import('./studio/service.js');
    console.log(`✅ Studio installé (${install()}).\n   Il tourne en permanence sur http://localhost:4321.`);
  },

  async 'studio-desinstaller'() {
    const { uninstall } = await import('./studio/service.js');
    uninstall();
    console.log('Studio arrêté et retiré du démarrage automatique.');
  },

  async 'tiktok-connexion'() { await login(); },

  /** Vérifie que Metricool est relié au compte TikTok (utilisé pour programmer les posts). */
  async 'metricool-verification'() {
    const { checkMetricool } = await import('./publish/metricool.js');
    const r = await checkMetricool({ onLog: console.log });
    console.log(r.tiktok ? `✅ Metricool relié au compte TikTok ${r.tiktok}` : '⚠️  Aucun compte TikTok relié dans Metricool (app.metricool.com)');
  },

  /** Copie le fichier de vérification TikTok à la racine du site GitHub Pages. */
  async 'tiktok-verification'([file]) {
    if (!file || !existsSync(file)) throw new Error('Usage : npm run tiktok:verification -- ~/Downloads/tiktokXXXX.txt');
    copyFileSync(file, join(PAGES_DIR, basename(file)));
    console.log(`Copié dans docs/${basename(file)}. Commit et push, puis clique sur « Verify » dans le portail TikTok.`);
  },
};

const [name, ...args] = process.argv.slice(2);
if (!commands[name]) {
  console.log(`Commandes : ${Object.keys(commands).join(', ')}\nLa recherche et la rédaction se font dans Claude Code : /rediger <sujet> ou /lot <nombre>`);
  process.exitCode = name ? 1 : 0;
} else {
  commands[name](args).catch(err => { console.error(`❌ ${err.message}`); process.exitCode = 1; });
}
