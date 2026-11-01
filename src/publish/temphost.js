// Hébergement temporaire des images (72 h) le temps que Metricool les copie chez lui.
import { openAsBlob } from 'node:fs';
import { basename } from 'node:path';

const ENDPOINT = 'https://litterbox.catbox.moe/resources/internals/api.php';

/** Envoie un fichier et renvoie son adresse publique (valable 72 h). */
export async function uploadTemp(file) {
  const form = new FormData();
  form.set('reqtype', 'fileupload');
  form.set('time', '72h');
  form.set('fileToUpload', await openAsBlob(file), basename(file));
  const res = await fetch(ENDPOINT, { method: 'POST', body: form });
  const text = (await res.text()).trim();
  if (!res.ok || !/^https:\/\/\S+$/.test(text)) throw new Error(`Hébergement des images impossible : ${text.slice(0, 200)}`);
  return text;
}
