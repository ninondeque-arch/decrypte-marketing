---
description: Recherche un cas marketing, rédige le carrousel sourcé et génère les slides
argument-hint: <sujet> [date AAAA-MM-JJ]
---

Tu prépares un post TikTok pour un compte qui décrypte le marketing derrière la culture pop.
Sujet demandé (avec, si la demande vient de la veille, l'angle et des sources de départ) : **$ARGUMENTS**

> **Lancement depuis le studio (sans interlocuteur)** : ne pose aucune question et n'attends aucune validation. Fais les choix raisonnables toi-même (accroche la plus forte en slide 1, date = prochain jour libre) et note-les dans ton résumé final. Ta toute dernière ligne doit être exactement `POST: <nom-du-dossier>`, par exemple `POST: 2026-11-04_labubu-fin-de-hype`.

## 0. Cadrage
- Lis `calendrier.md` pour connaître les posts existants.
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

**slides-config.json**, 6 à 8 slides :
1. `hook` : accroche en question ou paradoxe, **moins de 10 mots**, 1 expression dans `highlight`, `photo`, `cta: "On décrypte →"`.
2. Slides du milieu (`text`, `quote` ou `list`) : contexte, idée, mécanique. Chacune a un `label` court et 2 à 3 lignes (**moins de 25 mots**) ou une liste de 3 points. 1 ou 2 expressions dans `highlight`, une `photo` par slide si possible (avec `caption` et `credit`).
3. Avant-dernière slide `stats` : 2 ou 3 chiffres `{ value, text }` + `source`.
4. Dernière slide `outro` : `title: "Résultat ?"`, `lesson` (la leçon marketing en une phrase forte), `conclusion` (une phrase), `cta` (s'abonner + question pour les commentaires).

Champs du post : `sujet`, `rubrique`, `secteur`, `startup` (booléen), `statut: "à rédiger"`, `accroches` (3 variantes), `theme`, `slides`.

**legende.txt** : 2 à 3 lignes d'accroche + question, puis 4 à 5 hashtags pertinents.

**sources.md** : un tableau slide par slide (affirmation, source avec lien), puis un tableau des images (fichier, slide, sujet, URL d'origine). Chaque nombre affiché sur une slide doit apparaître dans ce fichier : `npm run verifier` le contrôle.

## 5. Contrôle et rendu
- Lance `npm run images -- <dossier>`. Corrige le JSON tant qu'il reste des erreurs.
- Regarde `apercu.png` et `apercu-zones.png` : texte lisible, rien dans les zones vertes, photos bien cadrées (ajuste `focusY` entre 0 et 1 si besoin). Régénère jusqu'à ce que ce soit propre.

## 6. Rendu à l'utilisatrice
Présente : les 3 accroches (celle utilisée en premier), le texte de chaque slide, la légende, les sources principales, le chemin de `apercu.png`, et les points à vérifier. Ne lance pas `npm run brouillon` : elle valide d'abord.
