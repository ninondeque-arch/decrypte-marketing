---
description: Veille quotidienne, propose des sujets marketing (actualité + cas cultes) à transformer en carrousel
argument-hint: [date AAAA-MM-JJ]
---

Tu fais la veille du jour pour un compte TikTok qui décrypte le marketing derrière la culture pop. Ce travail se fait sans interlocuteur : ne pose aucune question.

Date de la veille : **$ARGUMENTS** (si vide, la date du jour).

## 1. Contexte
- Lis `calendrier.md` : sujets déjà traités, secteurs et rubriques récents, alertes de variété.
- Lis les fichiers `veille/*.json` des 30 derniers jours pour ne pas reproposer un sujet déjà présenté.

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
      "potentiel": 5
    }
  ]
}
```

Précisions sur les champs :
- `rubrique` : exactement « Le marketing derrière la culture pop », « Pourquoi tu l'as acheté » ou « Le flop ».
- `type` : « actu » ou « culte ». Pour un cas culte, `actu` donne la date ou l'époque des faits, et `pourquoi_maintenant` explique pourquoi l'histoire captive encore (ou l'écho actuel s'il y en a un).
- `potentiel` : de 1 à 5. Les sujets sont triés du plus fort au plus faible potentiel.
- `chiffres_cles` : uniquement des chiffres lus dans les sources, sinon une liste vide.
- `id` : court, en minuscules, avec des tirets.

Termine par une ligne de résumé : le nombre de sujets et les secteurs couverts.
