---
description: Recherche un cas marketing, rédige le carrousel sourcé et génère les slides
argument-hint: <sujet> [date AAAA-MM-JJ]
---

Tu prépares un post TikTok pour un compte qui décrypte le marketing derrière la culture pop.
Sujet demandé (avec, si la demande vient de la veille, l'angle et des sources de départ) : **$ARGUMENTS**

> **Lancement depuis le studio (sans interlocuteur)** : ne pose aucune question et n'attends aucune validation. Fais les choix raisonnables toi-même (accroche la plus forte en slide 1 et en premier dans `accroches`, date = prochain jour libre) et note-les dans ton résumé final. Ta toute dernière ligne doit être exactement `POST: <nom-du-dossier>`, par exemple `POST: 2026-11-04_labubu-fin-de-hype`.

## 0. Cadrage
- Lis `calendrier.md` pour connaître les posts existants.
- Lis `performances.md` s'il existe (stats TikTok des posts publiés, `npm run stats`) et **reprends les bonnes pratiques des posts qui ont le mieux marché** : le type d'accroche, une star ou une marque que les 18-25 ans connaissent, la rubrique, le ton. Inspire-toi de ce qui a marché sans copier les textes, et cite dans ton rendu final la ou les pratiques reprises.
- Classe le sujet dans une rubrique : « Le marketing derrière la culture pop » (cible 60 %), « Pourquoi tu l'as acheté » (25 %) ou « Le flop » (15 %). Indique le secteur et si c'est une startup.
- Le sujet peut être d'actualité ou un cas culte du passé, mais il doit toujours avoir un lien clair avec le marketing ou les réseaux sociaux. Si le secteur est le même que celui du post précédent, signale-le.

## 1. Recherche (aucun fait inventé)
- Recherche sur le web : contexte, idée de la campagne ou de la stratégie, mécanique, résultats chiffrés, réactions. Privilégie l'actualité récente et les sources primaires (la marque, ses communiqués et rapports financiers), puis la presse reconnue (presse éco, presse marketing).
- Chaque chiffre et chaque fait doit venir d'une source lue, avec son URL. Si un chiffre n'est pas trouvé, il n'apparaît pas. Pas de causalité non prouvée (« grâce à ») : écris ce que la source dit.
- Rubrique « Le flop » : uniquement des faits publics et sourcés. Ton analytique, jamais moqueur, aucune accusation non établie.

## 2. Images
- Priorité aux visuels réels du cas : photos du produit ou du lieu sur le site officiel, kit presse, pages de la campagne, captures de la pub, posts de la marque. Pinterest, Google Images et banques d'images servent à trouver des visuels du cas, pas des illustrations génériques.
- Télécharge-les dans `posts/<dossier>/images/` avec des noms parlants. Si un site bloque le téléchargement direct, passe par Chrome (Claude in Chrome). Pour une capture d'écran de page, refuse les cookies non essentiels.
- Note pour chaque image : slide, sujet, URL d'origine. Crédit affiché : « Photo : <site ou auteur> ».
- Produit sur fond simple : ajoute `"detourer": true` à la photo (détourage rembg). Appli ou réseau social : préfère une capture d'écran.

## 3. Thème visuel de la marque
- Relève les couleurs de la marque (charte officielle, site de design, ou couleurs calculées sur son site : `getComputedStyle` sur le texte, les boutons, le logo).
- Construis 3 ou 4 palettes `{ bg, ink, boxBg, boxInk }` et une `sequence` d'une palette par slide, comme dans `posts/2026-11-03_visit-norway-toilettes/slides-config.json`. Les contrastes doivent être d'au moins 4,5:1 : le rendu refuse sinon.
- Charte introuvable : copie `assets/theme-defaut.json` et dis-le.

## 4. Rédaction (français, tutoiement, ton direct et complice)
Crée `posts/<AAAA-MM-JJ>_<sujet-court>/` (date : celle donnée, sinon le prochain jour sans post) avec :

**slides-config.json**, **8 slides**, une idée par slide :
1. **Couverture** (`hook`) : `title` = une **question de 4 à 6 mots qui contient le nom de la marque ou de la star** (« Pourquoi Selena Gomez vend un blush ? »). `fact` = une ligne de fait qui crée la **tension** : un paradoxe, un chiffre qui choque, une équation surprenante (« 2 stars + un téléfilm de 2009 = un coffret à 50 $ »). Jamais un résumé du sujet : on doit avoir envie de swiper pour comprendre. Plus `photo` et `cta: "On décrypte →"`.
2. **Pourquoi c'est important maintenant** (`text`, `label: "Pourquoi maintenant"`) : la tendance + **un chiffre clé**, avec sa source écrite sur la slide dans `source` (« Source : Skift, octobre 2026 »).
3. **Le cas** (`text`, `label: "Le cas"`) : ce que la marque a fait + le résultat + une phrase qui annonce les leçons (« 3 leçons à retenir → »).
4, 5, 6. **Une leçon par slide** (`lesson`, `label: "Leçon 1"`, `"Leçon 2"`, `"Leçon 3"`) : `title` = la leçon en **une phrase complète** ; `body` = 2 à 4 phrases courtes (**moins de 25 mots**) ; `quote` + `attribution` = une **citation réelle** si les sources en ont une (sinon, pas de citation).
7. **Cas comparables** (`list`, `label: "Cas comparables"`) : 1 ou 2 autres marques ou stars qui ont fait pareil, une par point, **avec le résultat de chacune** (« Quince : le pull rouge de Ross ressorti avec David Schwimmer → rupture de stock »). Chaque cas et chaque résultat viennent des sources. **S'il n'y en a pas dans les sources, mets une 4e leçon à la place** (`lesson`, `label: "Leçon 4"`).
8. **Conclusion** (`outro`, `title: "À retenir"`) : `lesson` = la leçon générale **en une phrase** ; pas de `conclusion` ; `cta` = la signature, exactement « Derrière la Hype · abonne-toi pour le prochain décryptage ».

Règles pour toutes les slides :
- **un titre doit se comprendre seul**, sans avoir lu les autres slides ;
- **1 à 2 passages surlignés** par slide (`highlight`, écrits exactement comme dans le texte) ;
- **une idée par slide** ;
- **aucune citation ni aucun chiffre absent des sources** : `npm run verifier` bloque le rendu sinon ;
- une `photo` par slide si possible (avec `caption` et `credit`).

Champs du post : `sujet`, `rubrique`, `secteur`, `startup` (booléen), `statut: "à rédiger"`, `accroches` (3 variantes de la question de couverture, la slide 1 reprend la première mot pour mot), `theme`, `slides`.

**legende.txt** : reprends l'accroche, résume le cas en 2 à 3 phrases, puis finis par une **question à deux choix qui oblige à choisir son camp** (« Arnaque ou coup de génie ? », « Tu achètes ou pas ? »), jamais une question ouverte et molle (« Et toi, t'en penses quoi ? »), juste avant 4 à 5 hashtags pertinents.

**sources.md** : un tableau slide par slide (affirmation, source avec lien), puis un tableau des images (fichier, slide, sujet, URL d'origine). Chaque nombre affiché sur une slide et chaque citation (mot pour mot) doivent apparaître dans ce fichier : `npm run verifier` le contrôle.

## 5. Contrôle et rendu
- Lance `npm run images -- <dossier>`. Corrige le JSON tant qu'il reste des erreurs.
- Regarde `apercu.png` et `apercu-zones.png` : texte lisible, rien dans les zones vertes, photos bien cadrées (ajuste `focusY` entre 0 et 1 si besoin). Régénère jusqu'à ce que ce soit propre.

## 5 bis. Relecture par l'agent juge
Une IA indépendante relit le carrousel fini dans une session séparée : elle ne voit que les fichiers du post (jamais ton raisonnement), ouvre les sources et note 6 critères de 1 à 5 (fidélité aux sources, accroche, clarté, leçon, ton, légende).
- Lance `npm run juger -- <dossier>` (plusieurs minutes : utilise un délai d'au moins 10 minutes, 600000 ms). Le résultat est dans `posts/<dossier>/juge.json`.
- Verdict « à corriger » : applique les corrections proposées (en priorité les bloquantes ; une erreur de fidélité se corrige en revenant à la source, jamais en inventant), relance `npm run images -- <dossier>`, puis `npm run juger -- <dossier>`.
- **3 passages maximum.** Si ce n'est toujours pas « validé » après le 3e, arrête-toi : ne contourne pas le juge et ne modifie jamais `juge.json` toi-même. Liste les points restants dans le rendu.
- Si une correction te semble fausse (le juge a mal lu une source), ne l'applique pas et explique pourquoi dans le rendu.

## 6. Rendu à l'utilisatrice
Présente : les 3 accroches (celle utilisée en premier), le texte de chaque slide, la légende, les sources principales, le chemin de `apercu.png`, et les points à vérifier.
Ajoute la relecture du juge : verdict, note de chaque critère (avec sa justification) et nombre de passages ; si le post n'est pas validé, les corrections restantes. Elle peut alors corriger, ou cliquer sur « Valider quand même » dans le studio.
Ne lance pas `npm run brouillon` : elle valide d'abord (et l'envoi est bloqué tant que le juge ou elle n'a pas validé).
