# Décrypte

Génère des carrousels TikTok (1080×1440, voir `src/config.js`) pour mon compte perso **Derrière la Hype** : on décrypte le marketing derrière la culture pop, un cas réel, une leçon marketing. Node ≥ 20.12, modules ES, tout en français (code, commentaires, messages).

## Règles éditoriales
- **Aucun chiffre sans source** : chaque fait vient d'une source lue, notée dans `sources.md`. `npm run verifier` bloque le rendu sinon. Pas de causalité non prouvée.
- **Ton** : tutoiement, direct et complice. « Le flop » : faits publics uniquement, analytique, jamais moqueur.
- **Structure (8 slides)** : couverture (question de 4 à 6 mots avec la marque ou la star + ligne de fait), pourquoi maintenant (chiffre + source sur la slide), le cas, 3 leçons (titre = la leçon en une phrase), cas comparables avec leur résultat (sinon une 4e leçon), conclusion (leçon générale en une phrase + signature). Détail dans `.claude/commands/rediger.md`.
- **Règles** : chaque titre se comprend seul, une idée par slide, 1 à 2 passages surlignés, < 25 mots par slide, contraste ≥ 4,5:1, aucune citation ni aucun chiffre absent des sources.
- **Cible 18-25 ans** : sujets qu'ils connaissent (stars, créateurs, séries, jeux vidéo, marques qu'ils utilisent), notés 4 ou 5 dans la veille.
- **Tension** : la ligne de fait de la couverture crée une tension (paradoxe, chiffre qui choque, équation), jamais un résumé. **Fin** : la légende finit par une question à deux choix.
- **Rubriques** : culture pop 60 %, « Pourquoi tu l'as acheté » 25 %, « Le flop » 15 % (suivi dans `calendrier.md`).

## Pipeline
1. `/veille` (ou `npm run veille`, `/lot <n>` pour la semaine) : propose des sujets.
   `/veille`, `/lot`, `/rediger` et le juge lisent d'abord `performances.md` pour reprendre ce qui a marché.
2. `/rediger <sujet>` : recherche, sources, visuels, `slides-config.json`, `legende.txt`, `sources.md`.
3. `npm run images -- <post>` : contrôles éditoriaux + rendu PNG + aperçus.
4. `npm run juger -- <post>` : relecture par l'agent juge.
5. `npm run brouillon -- <post>` : envoi dans la boîte de réception TikTok (jamais publié automatiquement).
6. `npm run stats` : stats TikTok via Metricool → `posts/<post>/stats.json` et `performances.md` (généré, ne pas éditer).

Pas de page Réglages dans le studio : l'utilisatrice n'a rien à régler ni aucune commande à lancer. Metricool passe par le connecteur Claude ; les options avancées sont dans `.env`.

`npm test` avant tout commit. `<post>` peut être un morceau du nom de dossier.

## Agent juge (`src/agent/juge.js`)
IA indépendante, session séparée, lecture seule : elle ne voit que les fichiers du post et ouvre les sources. 6 critères notés de 1 à 5, plus une phrase « Comparé aux posts qui ont marché : … » ; « validé » seulement si toutes les notes ≥ 4 et aucune correction bloquante (règle appliquée par le code). **3 passages maximum** : au-delà, on s'arrête et on liste les points restants.

## Ne jamais
- Publier ou envoyer en brouillon sans validation humaine (juge validé ou « Valider quand même » dans le studio).
- Modifier `juge.json` à la main, ni contourner le juge.
- Inventer un chiffre, une citation ou un visuel.
