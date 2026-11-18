// Agent juge : une IA indépendante relit le carrousel fini, le note et le renvoie en correction si besoin.
// Session séparée de la rédaction, en lecture seule : elle ne voit que les fichiers du post et les sources citées.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../config.js';
import { loadConfig } from '../editorial/post.js';
import { runClaude } from './claude.js';

export const JUGE_FILE = 'juge.json';
/** Seuls outils du juge : lire les fichiers et ouvrir les sources. */
export const JUGE_TOOLS = ['Read', 'Glob', 'Grep', 'WebFetch'];
export const NOTE_MIN = 4;
/** Synthèse des stats TikTok (npm run stats), lue avant de juger. */
export const PERFORMANCES = join(ROOT, 'performances.md');
export const COMPARAISON_DEBUT = 'Comparé aux posts qui ont marché : ';

export const CRITERES = {
  fidelite: 'Fidélité aux sources',
  accroche: 'Accroche',
  clarte: 'Clarté et rythme TikTok',
  lecon: 'Leçon marketing',
  ton: 'Ton',
  legende: 'Légende',
};

/** Consigne du juge : il ne connaît du post que ses fichiers. */
export function judgePrompt(dir, { performances = PERFORMANCES } = {}) {
  const cfg = loadConfig(dir);
  const perf = existsSync(performances);
  const file = f => join(dir, f);
  return `Tu es le juge éditorial d'un compte TikTok français qui décrypte le marketing. Tu relis un carrousel déjà rédigé par un autre agent, dont tu ne connais pas le raisonnement. Tu es exigeant et indépendant : ton rôle est de trouver ce qui ne va pas avant publication.
Tu es en lecture seule : tu ne modifies aucun fichier.

Lis ces fichiers :
- ${file('slides-config.json')} (texte des slides ; rubrique : « ${cfg.rubrique} »)
- ${file('legende.txt')}
- ${file('sources.md')}
- ${file('apercu.png')} (aperçu des slides rendues)
${perf ? `- ${performances} (stats TikTok des posts déjà publiés : classement et points communs des meilleurs). Lis-le avant de juger, pour privilégier ce qui a marché.` : '- (pas encore de stats des posts publiés : performances.md est absent)'}

Ouvre avec WebFetch les liens de sources.md qui appuient les chiffres et les affirmations clés, et vérifie qu'ils disent bien ce que la slide affirme. Si une source est inaccessible, dis-le dans la justification (ce n'est pas en soi une erreur de fidélité).

Note chaque critère de 1 à 5, avec une justification d'une phrase :
- fidelite : chaque affirmation et chaque chiffre correspond à ce que dit la source ; aucune causalité non prouvée (« grâce à », « a permis de ») si la source ne l'établit pas.
- accroche : la slide 1 donne envie de swiper : une question de 4 à 6 mots avec le nom de la marque ou de la star, plus une ligne de fait qui crée la tension (paradoxe, chiffre qui choque, équation surprenante), jamais un résumé.
- clarte : structure en 8 slides (couverture, pourquoi maintenant avec un chiffre sourcé sur la slide, le cas, 3 leçons, 1 ou 2 cas comparables avec leur résultat ou une 4e leçon, conclusion avec signature) ; chaque titre se comprend seul ; une idée par slide ; 1 à 2 passages surlignés par slide ; rien de superflu, rythme TikTok.
- lecon : les slides 4 à 6 donnent chacune une leçon claire et réutilisable, en titre et en une phrase complète ; les cas comparables (slide 7) éclairent le cas avec un résultat sourcé pour chacun ; la conclusion tient la leçon générale en une phrase.
- ton : direct et complice, tutoiement ; pour la rubrique « Le flop », analytique et jamais moqueur, aucune accusation non établie.
- legende : reprend l'accroche, résume le cas en 2 à 3 phrases, 4 à 5 hashtags pertinents, et finit par une question à deux choix qui donne envie de répondre en commentaire : elle oblige à choisir son camp (« Arnaque ou coup de génie ? », « Tu achètes ou pas ? »), jamais une question ouverte et molle (« Qu'en penses-tu ? »).

Pour chaque problème, ajoute une correction : la slide concernée (numéro, ou "légende"), le critère, le problème, une correction proposée concrète (le texte de remplacement si possible), et bloquant: true si le post ne doit pas partir en l'état. Une erreur de fidélité aux sources est toujours bloquante.
Ajoute une phrase de comparaison qui commence exactement par « ${COMPARAISON_DEBUT}» : ce que ce post partage ou non avec les posts qui ont le mieux marché (rubrique, secteur, type d'accroche, sujet connu des 18-25 ans…)${perf ? '' : ', ou indique qu\'il n\'y a pas encore de stats'}. Elle n'entre pas dans le verdict.
Règle du verdict : "validé" seulement si tous les critères sont à 4 ou plus et qu'aucune correction n'est bloquante ; sinon "à corriger".

Réponds uniquement avec ce JSON, sans texte autour :
{"verdict": "validé" | "à corriger",
 "scores": {${Object.keys(CRITERES).map(k => `"${k}": {"note": 1-5, "justification": "…"}`).join(', ')}},
 "corrections": [{"slide": 1, "critere": "fidelite", "probleme": "…", "correction_proposee": "…", "bloquant": true}],
 "comparaison": "${COMPARAISON_DEBUT}…"}`;
}

/** Applique la règle du verdict (on ne se fie pas au verdict annoncé par l'IA). */
export function verdictFor({ scores, corrections }) {
  const notesOk = Object.keys(CRITERES).every(k => scores[k]?.note >= NOTE_MIN);
  return notesOk && !corrections.some(c => c.bloquant) ? 'validé' : 'à corriger';
}

/**
 * Lit et valide la réponse du juge. Lève une erreur si elle est mal formée.
 * @returns {{verdict: string, scores: Record<string, {note: number, justification: string}>, corrections: object[], comparaison?: string}}
 */
export function parseJudgement(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Réponse du juge illisible (aucun JSON) : ${text.slice(-200)}`);
  let raw;
  try { raw = JSON.parse(text.slice(start, end + 1)); } catch (e) { throw new Error(`Réponse du juge illisible (JSON invalide : ${e.message})`); }
  const fail = msg => { throw new Error(`Réponse du juge mal formée : ${msg}`); };

  if (!['validé', 'à corriger'].includes(raw.verdict)) fail(`verdict « ${raw.verdict} » inconnu`);
  if (!raw.scores || typeof raw.scores !== 'object') fail('scores manquants');
  const scores = {};
  for (const k of Object.keys(CRITERES)) {
    const s = raw.scores[k];
    if (!s || !Number.isInteger(s.note) || s.note < 1 || s.note > 5) fail(`note de « ${k} » absente ou hors de 1 à 5`);
    if (typeof s.justification !== 'string' || !s.justification.trim()) fail(`justification de « ${k} » manquante`);
    scores[k] = { note: s.note, justification: s.justification.trim() };
  }
  if (!Array.isArray(raw.corrections)) fail('corrections doit être une liste');
  const corrections = raw.corrections.map((c, i) => {
    if (!c || typeof c.probleme !== 'string' || typeof c.correction_proposee !== 'string') fail(`correction ${i + 1} incomplète`);
    if (typeof c.bloquant !== 'boolean') fail(`correction ${i + 1} : bloquant doit valoir true ou false`);
    const critere = c.critere in CRITERES ? c.critere : undefined;
    // Une erreur de fidélité aux sources est toujours bloquante
    return { slide: c.slide ?? null, ...(critere && { critere }), probleme: c.probleme, correction_proposee: c.correction_proposee, bloquant: c.bloquant || critere === 'fidelite' };
  });
  // Comparaison aux posts qui ont marché : facultative, toujours préfixée de la même façon
  let comparaison = typeof raw.comparaison === 'string' ? raw.comparaison.trim() : '';
  if (comparaison && !comparaison.startsWith(COMPARAISON_DEBUT.trim())) comparaison = COMPARAISON_DEBUT + comparaison;
  return { verdict: verdictFor({ scores, corrections }), scores, corrections, ...(comparaison && { comparaison }) };
}

export function readJudgement(dir) {
  const file = join(dir, JUGE_FILE);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

const writeJudgement = (dir, data) => writeFileSync(join(dir, JUGE_FILE), JSON.stringify(data, null, 2) + '\n');

/** Enregistre un passage du juge, en gardant les précédents dans l'historique. */
export function saveJudgement(dir, result, now = new Date()) {
  const prev = readJudgement(dir);
  const { historique = [], ...last } = prev ?? {};
  const data = {
    ...result,
    date: now.toISOString(),
    passage: (prev?.passage ?? 0) + 1,
    historique: prev ? [...historique, last] : [],
  };
  writeJudgement(dir, data);
  return data;
}

/** Validation humaine explicite : l'humain garde le dernier mot. */
export function overrideJudgement(dir, now = new Date()) {
  const data = { ...(readJudgement(dir) ?? { verdict: null, passage: 0, historique: [] }), override_humain: true, override_date: now.toISOString() };
  writeJudgement(dir, data);
  return data;
}

export const isApproved = j => !!j && (j.verdict === 'validé' || j.override_humain === true);

/** Garde-fou avant tout envoi : juge passé et validé, ou validation humaine. */
export function assertJudged(dir) {
  const j = readJudgement(dir);
  if (!j) throw new Error('Pas encore relu par le juge : lance « npm run juger » (ou « Faire relire par le juge » dans le studio), ou valide quand même depuis le studio.');
  if (!isApproved(j)) throw new Error(`Le juge demande des corrections (passage ${j.passage}) : corrige puis relance « npm run juger », ou valide quand même depuis le studio.`);
}

/**
 * Fait relire le post par le juge et enregistre le résultat dans juge.json.
 * @param {{onLog?: (msg: string) => void, run?: typeof runClaude}} opts `run` remplaçable dans les tests
 */
export async function judgePost(dir, { onLog = () => {}, run = runClaude } = {}) {
  if (!existsSync(join(dir, 'apercu.png'))) throw new Error('apercu.png absent : génère d\'abord les slides (npm run images)');
  onLog('⚖️  Relecture par le juge (session séparée, lecture seule)…');
  const res = await run(judgePrompt(dir), { onLog, tools: JUGE_TOOLS, readOnly: true });
  if (res.isError) throw new Error(`Le juge a échoué : ${res.text.slice(-300)}`);
  const data = saveJudgement(dir, parseJudgement(res.text));
  onLog(`${data.verdict === 'validé' ? '✅' : '✏️ '} Verdict : ${data.verdict} (passage ${data.passage})`);
  return data;
}
