---
description: Veille quotidienne, propose des sujets marketing (actualité + cas cultes) à transformer en carrousel
argument-hint: [date AAAA-MM-JJ]
---

Tu fais la veille du jour pour un compte TikTok qui décrypte le marketing derrière la culture pop. Ce travail se fait sans interlocuteur : ne pose aucune question.

Date de la veille : **$ARGUMENTS** (si vide, la date du jour).

## 1. Contexte
- Lis `calendrier.md` : sujets déjà traités, secteurs et rubriques récents, alertes de variété.
- Lis les fichiers `veille/*.json` des 30 derniers jours pour ne pas reproposer un sujet déjà présenté.
- Lis `performances.md` s'il existe (stats TikTok des posts publiés) : privilégie ce qui a marché (rubriques, secteurs, types d'accroche, sujets portés par une star ou une marque connue).

## Le filtre « 18-25 ans »
Le compte plafonne autour de 750-800 vues par carrousel, sauf quand le sujet parle d'une star que les jeunes connaissent (Rare Beauty et Selena Gomez : 2 355 vues). Pour chaque sujet envisagé, réponds honnêtement : **« Est-ce qu'un ou une 18-25 ans connaît cette marque, ce produit ou cette star ? »**
- 5 : tout le monde la connaît et en parle (star mondiale, marque qu'ils utilisent tous les jours, jeu ou série du moment).
- 4 : très connue de la plupart des 18-25 ans.
- 3 : connue d'une partie d'entre eux seulement.
- 1 ou 2 : marque B2B, de niche, ou qui parle surtout à leurs parents.

Privilégie la culture pop : stars, créateurs et créatrices, séries, films, musique, jeux vidéo, et les marques que les jeunes utilisent vraiment (appli, mode, beauté, food, sneakers, tech). Une campagne brillante d'une marque inconnue d'eux passe après.

## 2. Recherche
Fais au moins 8 recherches web différentes sur l'actualité des **7 derniers jours**, en français et en anglais :
- campagnes et coups marketing viraux ;
- lancements de produits, drops, ruptures de stock et files d'attente ;
- startups grand public (levées de fonds racontées par leur marketing, croissance sur TikTok ou Instagram, ambassadeurs, bouche-à-oreille) ;
- bad buzz, pubs retirées, rebrandings ratés ;
- résultats financiers liés à une hype ;
- tendances TikTok reprises par les marques.

Couvre des secteurs variés : food, boissons, tech, IA, jeux vidéo, sport, musique, streaming, retail, auto, jouets, voyage, médias, mode, beauté, créateurs. Privilégie les sources reconnues : presse éco et marketing, communiqués des marques. Ouvre au moins une source par sujet retenu pour vérifier les faits.

Cherche aussi des **cas cultes du passé** : campagnes, lancements, stratégies réseaux sociaux ou flops qui ont marqué et dont on parle encore. Exemples : la croissance de Duolingo sur TikTok, le Super Bowl Oreo « You can still dunk in the dark », le Ice Bucket Challenge, les premiers utilisateurs d'Airbnb, Old Spice, le rebranding de Gap en 2010, Liquid Death. Ce sont des histoires impressionnantes, surprenantes ou contre-intuitives, qui fonctionnent sur TikTok même sans actualité. Un anniversaire, une suite ou une tendance actuelle qui fait écho est un plus, pas une obligation.

**Chaque sujet doit avoir un lien clair avec le marketing ou les réseaux sociaux.** Les faits divers et l'actualité politique ou économique sans angle marketing sont exclus.

## 3. Sélection
Retiens **8 sujets** : environ **5 d'actualité** (`"type": "actu"`) et **3 cas cultes** (`"type": "culte"`). Règles :
- **ne propose que des sujets notés 4 ou 5 au filtre « 18-25 ans »**. Si tu n'en trouves vraiment pas 8 après tes recherches, complète avec des sujets notés 3 et dis-le dans le résumé final, jamais en dessous ;
- environ 5 « Le marketing derrière la culture pop », 2 « Pourquoi tu l'as acheté » et 1 « Le flop » ;
- au moins 2 startups et au moins 6 secteurs différents ;
- sujet d'actualité : moins de 7 jours. Cas culte : histoire marquante et bien documentée ;
- dans tous les cas, des chiffres sourcés possibles et une vraie leçon marketing ;
- jamais un sujet déjà traité dans `calendrier.md` ni proposé dans les 30 derniers jours de veille.

## 4. Fichier à écrire
Écris `veille/<date>.json` (crée le dossier si besoin), en JSON strictement valide :

```json
{
  "date": "2026-11-02",
  "sujets": [
    {
      "id": "visit-norway-toilettes",
      "type": "actu",
      "sujet": "Visit Norway transforme l'insulte de Trump en campagne",
      "angle": "Comment une vieille page web est devenue la plus vue du site en 5 jours",
      "accroche": "Comment des toilettes ont répondu à Trump ?",
      "rubrique": "Le marketing derrière la culture pop",
      "secteur": "Tourisme",
      "startup": false,
      "actu": "Campagne lancée le 26 octobre 2026 en réponse à un meeting de Trump",
      "pourquoi_maintenant": "Sujet viral cette semaine, chiffres d'audience publiés par Skift",
      "chiffres_cles": ["80 000 vues en 5 jours", "moins de 10 000 $ de promotion"],
      "sources": [{ "titre": "Skift", "url": "https://…", "date": "2026-10-30" }],
      "note_jeunes": { "note": 4, "justification": "Le sujet passe par Trump, que tous les 18-25 ans connaissent, même si Visit Norway leur parle peu." },
      "potentiel": 5
    }
  ]
}
```

Précisions sur les champs :
- `rubrique` : exactement « Le marketing derrière la culture pop », « Pourquoi tu l'as acheté » ou « Le flop ».
- `type` : « actu » ou « culte ». Pour un cas culte, `actu` donne la date ou l'époque des faits, et `pourquoi_maintenant` explique pourquoi l'histoire captive encore (ou l'écho actuel s'il y en a un).
- `note_jeunes` : la note du filtre « 18-25 ans » (de 1 à 5) et une phrase de justification qui nomme la marque, le produit ou la star concernés.
- `potentiel` : de 1 à 5. Les sujets sont triés par `note_jeunes.note` décroissante, puis du plus fort au plus faible potentiel.
- `chiffres_cles` : uniquement des chiffres lus dans les sources, sinon une liste vide.
- `id` : court, en minuscules, avec des tirets.

Termine par une ligne de résumé : le nombre de sujets, les secteurs couverts et la répartition des notes « 18-25 ans ».
