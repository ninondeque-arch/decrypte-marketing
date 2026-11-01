# Envoyer les carrousels en brouillon sur TikTok

L'outil utilise l'**API officielle Content Posting** de TikTok en mode `MEDIA_UPLOAD` : le carrousel et sa légende arrivent dans ta **boîte de réception TikTok**. Tu ajoutes le son tendance et tu publies toi-même depuis l'appli. Rien n'est jamais publié automatiquement.

Tout est gratuit : compte développeur TikTok, GitHub et GitHub Pages.

---

## Ce qu'il faut savoir avant de commencer

| Contrainte TikTok (doc du 27/10/2026) | Ce que fait l'outil |
|---|---|
| Les photos ne s'envoient **que par URL** (`PULL_FROM_URL`), sur un domaine ou un préfixe d'URL **dont tu prouves la propriété** | Les JPEG sont publiés sur ton site GitHub Pages (`docs/m/…`), dont tu vérifies le préfixe une fois pour toutes |
| Formats acceptés : **JPEG ou WebP**, 1080p maximum, 20 Mo par image, 35 images maximum | Les PNG sont convertis en JPEG 1080×1920 au moment de l'envoi |
| Droit nécessaire : `video.upload` | Demandé à la connexion |
| 5 brouillons en attente maximum par 24 h | Message d'erreur explicite si la limite est atteinte |
| Appli TikTok en version 31.8 minimum | Idem |

Sources : [référence photo](https://developers.tiktok.com/doc/content-posting-api-reference-photo-post), [guide média](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide), [règles de partage](https://developers.tiktok.com/doc/content-sharing-guidelines).

### Le post sera-t-il public ?

- **Ce qui est certain :** pour la *publication directe* (`DIRECT_POST`), une appli non validée par TikTok ne peut publier qu'en **privé** (`SELF_ONLY`), et le compte doit lui-même être privé au moment de publier.
- **Ce qui ne l'est pas :** pour l'envoi en *brouillon* (`MEDIA_UPLOAD`, ce qu'on utilise), la doc ne le dit pas explicitement. C'est toi qui publies depuis l'appli, donc tu choisis la visibilité, *a priori* librement. Mais l'erreur `unaudited_client_can_only_post_to_private_accounts` vise le même endpoint. Il est donc possible que TikTok refuse l'envoi tant que ton compte est public et que l'appli n'est pas validée.
- **Comment trancher :** fais un premier envoi en sandbox (étape 5). L'outil affiche clairement cette erreur si elle survient.

**Si TikTok bloque :**
1. **Demander la validation de l'appli (audit)**, gratuit : bouton *Submit for review* dans le portail. Il faut décrire l'usage (outil personnel, envoi en brouillon), fournir une courte vidéo de démonstration, et les liens des conditions d'utilisation et de la politique de confidentialité. Ces pages sont déjà prêtes dans `docs/cgu.html` et `docs/confidentialite.html`. Délai : quelques jours à quelques semaines.
2. **Passer ton compte en privé** le temps de l'envoi, puis le repasser en public avant de publier depuis l'appli.
3. **Passer par un service déjà validé par TikTok.** **Upload-Post** demande l'offre Basic, payante, pour TikTok : l'offre gratuite ne publie pas sur TikTok. **Postiz** est open source : la version auto-hébergée demande quand même ta propre appli TikTok, et la version en ligne est payante. Rien n'a été souscrit : c'est à toi de décider.

---

## Étape 1 : publier le projet sur GitHub et activer Pages

1. Crée un dépôt **public** nommé `decrypte-marketing` sur github.com. GitHub Pages est gratuit pour les dépôts publics.
2. Dans le dossier du projet :
   ```bash
   git init && git add . && git commit -m "Premier commit"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/decrypte-marketing.git
   git push -u origin main
   ```
3. Sur GitHub, va dans **Settings > Pages > Build and deployment** : *Deploy from a branch*, branche `main`, dossier `/docs`.
4. Au bout d'une à deux minutes, `https://TON-COMPTE.github.io/decrypte-marketing/` affiche une page de texte. C'est ton `PAGES_BASE_URL`.

> Les visuels bruts des marques (`posts/*/images/`) ne sont pas envoyés sur GitHub (voir `.gitignore`). Seules les slides finales le sont.

## Étape 2 : créer l'appli développeur TikTok

1. Va sur [developers.tiktok.com](https://developers.tiktok.com/) et connecte-toi avec ton compte TikTok.
2. Clique sur **Manage apps > Connect an app**, puis remplis la fiche :
   - **Nom :** par exemple `Decrypte Marketing` ;
   - **Icône :** une image carrée ;
   - **Catégorie :** par exemple *Photo & Video* ;
   - **Description :** « Outil personnel qui envoie mes carrousels photo dans ma boîte de réception TikTok pour que je les publie moi-même. » ;
   - **Terms of Service URL :** `https://TON-COMPTE.github.io/decrypte-marketing/cgu.html` ;
   - **Privacy Policy URL :** `https://TON-COMPTE.github.io/decrypte-marketing/confidentialite.html` ;
   - **Platforms :** *Web*, avec l'adresse de ton site GitHub Pages.
3. Ajoute les produits :
   - **Login Kit**, avec comme *Redirect URI* `https://TON-COMPTE.github.io/decrypte-marketing/callback.html` ;
   - **Content Posting API** : active l'envoi en brouillon (*Upload*). Inutile d'activer *Direct Post*.
4. Dans **Scopes**, vérifie que `user.info.basic` et `video.upload` sont présents.

## Étape 3 : vérifier le préfixe d'URL (obligatoire pour les photos)

1. Dans l'appli, ouvre **URL properties > Add URL property**, choisis *URL prefix* et saisis `https://TON-COMPTE.github.io/decrypte-marketing/`, en gardant le `/` final.
2. TikTok te fait télécharger un fichier de vérification. Lance :
   ```bash
   npm run tiktok:verification -- ~/Downloads/<fichier-tiktok>.txt
   git add docs && git commit -m "Vérification TikTok" && git push
   ```
3. Attends une à deux minutes, puis clique sur **Verify** dans le portail.

## Étape 4 : tester en sandbox avec ton compte

1. Dans l'appli, crée une **Sandbox**. Elle a ses propres *Client key* et *Client secret*.
2. Dans **Sandbox settings > Target users**, ajoute ton compte TikTok. Seuls ces comptes peuvent se connecter tant que l'appli n'est pas validée.
3. Copie `.env.example` en `.env` et remplis-le avec les clés de la sandbox :
   ```
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   TIKTOK_REDIRECT_URI=https://TON-COMPTE.github.io/decrypte-marketing/callback.html
   PAGES_BASE_URL=https://TON-COMPTE.github.io/decrypte-marketing/
   ```
   Le fichier `.env` n'est jamais envoyé sur GitHub : il est exclu par le `.gitignore`.

## Étape 5 : se connecter puis envoyer un brouillon

```bash
npm run tiktok:connexion
```
1. Le navigateur s'ouvre sur TikTok : tu autorises l'appli.
2. TikTok te renvoie sur `callback.html`, qui affiche une adresse : tu cliques sur **Copier**, puis tu la colles dans le terminal.
3. Les jetons sont enregistrés dans `.tiktok-tokens.json` (local, exclu de Git) et renouvelés automatiquement.

```bash
npm run brouillon -- visit-norway
```
1. Les slides partent en JPEG sur GitHub Pages (commit et push automatiques de `docs/m/<post>/`).
2. L'outil attend que les images soient en ligne.
3. TikTok récupère les images et les dépose dans ta boîte de réception.
4. Ouvre l'appli TikTok, puis la notification de la boîte de réception : tu ajoutes le son et tu publies.
5. Lance ensuite `npm run publie -- visit-norway` pour mettre le calendrier à jour.

## Erreurs fréquentes

| Code TikTok | Que faire |
|---|---|
| `url_ownership_unverified` | Le préfixe GitHub Pages n'est pas vérifié (étape 3), ou `PAGES_BASE_URL` ne correspond pas exactement au préfixe déclaré |
| `unaudited_client_can_only_post_to_private_accounts` | Voir « Si TikTok bloque » plus haut |
| `spam_risk_too_many_pending_share` | Plus de 5 brouillons en attente : publie ou supprime ceux de la boîte de réception |
| `scope_not_authorized` | Le droit `video.upload` n'a pas été accordé : vérifie les *Scopes* puis relance `npm run tiktok:connexion` |
| `app_version_check_failed` | Mets à jour l'appli TikTok (version 31.8 minimum) |
