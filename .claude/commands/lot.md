---
description: Propose puis prépare plusieurs posts d'actualité d'un coup (ex. la semaine)
argument-hint: <nombre de posts> [date de début AAAA-MM-JJ]
---

Prépare un lot de posts : **$ARGUMENTS** (par défaut 3, à partir du prochain jour libre).

1. Lis `calendrier.md` (posts existants, secteurs et rubriques récents, alertes de variété) et `performances.md` s'il existe (stats TikTok des posts publiés : privilégie ce qui a marché).
2. Cherche sur le web l'actualité marketing des 2 à 4 dernières semaines : campagnes virales, lancements, drops et ruptures de stock, levées de fonds de startups grand public, bad buzz, résultats financiers liés à une hype. Couvre tous les secteurs (food, tech, IA, jeux vidéo, sport, musique, streaming, retail, auto, jouets, voyage, médias, créateurs…).
3. Applique le filtre « 18-25 ans » de `.claude/commands/veille.md` : pour chaque sujet, note de 1 à 5 « Est-ce qu'un ou une 18-25 ans connaît cette marque, ce produit ou cette star ? », avec une phrase de justification. **Ne propose que des sujets notés 4 ou 5** et privilégie la culture pop (stars, créateurs, séries, jeux vidéo, marques que les jeunes utilisent).
4. Propose 2 fois plus de sujets que demandé, sous forme de tableau : sujet, rubrique, secteur, startup ou non, note « 18-25 ans » et sa justification, actu précise et datée avec sa source, et pourquoi ça peut performer maintenant. Respecte la variété :
   - jamais deux posts d'affilée dans le même secteur ;
   - sur 10 posts, au moins 6 secteurs et 2 startups ;
   - rubriques proches de 60 / 25 / 15 %.
5. **Attends que l'utilisatrice choisisse** les sujets et leur ordre.
6. Pour chaque sujet retenu, applique toute la méthode de `.claude/commands/rediger.md`, avec une date par post (un post par jour, sauf indication contraire).
7. Termine par `npm run calendrier` et un récapitulatif : un lien vers l'`apercu.png` de chaque post, le verdict du juge (notes et nombre de passages) et les points à vérifier.
