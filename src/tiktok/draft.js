// Envoi d'un carrousel photo en brouillon (boîte de réception TikTok), jamais publié automatiquement.
// Doc : https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
import { accessToken } from './oauth.js';

const API = 'https://open.tiktokapis.com/v2/post/publish';

/** Tronque en unités UTF-16, comme le compte TikTok (title : 90, description : 4000). */
const clip = (s, max) => (s.length <= max ? s : s.slice(0, max - 1) + '…');

async function call(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error?.code && json.error.code !== 'ok') {
    const hints = {
      url_ownership_unverified: 'le préfixe GitHub Pages n\'est pas encore vérifié dans le portail développeur (voir guides/tiktok.md, étape 3)',
      unaudited_client_can_only_post_to_private_accounts: 'appli non validée par TikTok : passe ton compte en privé le temps des tests',
      spam_risk_too_many_pending_share: '5 brouillons en attente maximum par 24 h : publie ou supprime ceux de ta boîte de réception',
      app_version_check_failed: 'mets à jour l\'appli TikTok (version 31.8 minimum)',
      scope_not_authorized: 'le droit video.upload manque : relance npm run tiktok:connexion',
    };
    throw new Error(`TikTok : ${json.error.code} — ${hints[json.error.code] ?? json.error.message} (log_id ${json.error.log_id})`);
  }
  return json.data;
}

/** Crée le brouillon et renvoie son publish_id. */
export async function sendDraft({ title, description, imageUrls, coverIndex = 0 }) {
  if (imageUrls.length > 35) throw new Error('TikTok accepte 35 images maximum par carrousel');
  const data = await call('/content/init/', {
    media_type: 'PHOTO',
    post_mode: 'MEDIA_UPLOAD',
    post_info: { title: clip(title, 90), description: clip(description, 4000) },
    source_info: { source: 'PULL_FROM_URL', photo_images: imageUrls, photo_cover_index: coverIndex },
  });
  return data.publish_id;
}

/** Suit le traitement jusqu'à l'arrivée dans la boîte de réception (ou l'échec). */
export async function waitForInbox(publishId, timeoutMs = 3 * 60_000) {
  const start = Date.now();
  for (;;) {
    const { status, fail_reason } = await call('/status/fetch/', { publish_id: publishId });
    if (status === 'SEND_TO_USER_INBOX' || status === 'PUBLISH_COMPLETE') return status;
    if (status === 'FAILED') throw new Error(`TikTok a refusé le brouillon : ${fail_reason}`);
    if (Date.now() - start > timeoutMs) return status;
    await new Promise(r => setTimeout(r, 10_000)); // 6 requêtes / minute maximum
  }
}
