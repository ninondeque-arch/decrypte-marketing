// Connexion TikTok (OAuth 2.0 + PKCE) et gestion des jetons.
// Doc : https://developers.tiktok.com/doc/oauth-user-access-token-management
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { execFile } from 'node:child_process';
import { TOKENS_FILE } from '../config.js';

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
export const SCOPES = ['user.info.basic', 'video.upload'];

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable ${name} absente du fichier .env (voir .env.example et guides/tiktok.md)`);
  return v;
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), ...params }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`TikTok OAuth : ${data.error ?? res.status} ${data.error_description ?? ''}`.trim());
  const now = Date.now();
  const tokens = { ...data, expires_at: now + data.expires_in * 1000, refresh_expires_at: now + data.refresh_expires_in * 1000 };
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  return tokens;
}

/** Attend le retour de TikTok : serveur local (redirection http://localhost) ou URL collée à la main. */
async function waitForCode(redirectUri) {
  const url = new URL(redirectUri);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return new Promise((ok, ko) => {
      const server = createServer((req, res) => {
        const u = new URL(req.url, redirectUri);
        if (u.pathname !== url.pathname) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<p>Connexion reçue, tu peux fermer cet onglet.</p>');
        server.close();
        u.searchParams.get('error') ? ko(new Error(u.searchParams.get('error_description') ?? u.searchParams.get('error'))) : ok(u);
      }).listen(Number(url.port) || 80);
    });
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pasted = await rl.question('\nAprès avoir autorisé l\'appli, colle ici l\'adresse complète de la page de retour :\n> ');
  rl.close();
  return new URL(pasted.trim());
}

/** Prépare une demande d'autorisation TikTok (PKCE). */
export function authorization() {
  const redirectUri = env('TIKTOK_REDIRECT_URI');
  const state = randomBytes(16).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  // TikTok attend le SHA-256 du verifier encodé en hexadécimal.
  const challenge = createHash('sha256').update(verifier).digest('hex');
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_key: env('TIKTOK_CLIENT_KEY'), scope: SCOPES.join(','), response_type: 'code',
    redirect_uri: redirectUri, state, code_challenge: challenge, code_challenge_method: 'S256',
  });
  return { url: url.toString(), state, verifier, redirectUri };
}

/** Échange le code reçu contre des jetons (enregistrés dans .tiktok-tokens.json). */
export const exchangeCode = (code, { verifier, redirectUri }) =>
  tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: verifier });

/** Connexion depuis le terminal. */
export async function login() {
  const auth = authorization();
  console.log(`Ouverture de TikTok dans le navigateur…\nSi rien ne s'ouvre : ${auth.url}`);
  execFile('open', [auth.url], () => {});
  const back = await waitForCode(auth.redirectUri);
  if (back.searchParams.get('state') !== auth.state) throw new Error('Réponse TikTok invalide (state différent) : recommence la connexion.');
  const code = back.searchParams.get('code');
  if (!code) throw new Error('Pas de code d\'autorisation dans l\'adresse de retour.');
  const tokens = await exchangeCode(code, auth);
  console.log(`✅ Connecté (droits : ${tokens.scope}). Jetons enregistrés dans .tiktok-tokens.json`);
}

/** Profil du compte connecté (nom affiché et avatar), ou null si non connecté. */
export async function connectedUser() {
  if (!existsSync(TOKENS_FILE)) return null;
  const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url', { headers: { Authorization: `Bearer ${await accessToken()}` } });
  const json = await res.json();
  if (json.error?.code && json.error.code !== 'ok') throw new Error(json.error.message);
  return json.data?.user ?? null;
}

export function logout() { if (existsSync(TOKENS_FILE)) rmSync(TOKENS_FILE); }

/** Jeton d'accès valide, renouvelé automatiquement s'il expire dans moins de 5 minutes. */
export async function accessToken() {
  if (!existsSync(TOKENS_FILE)) throw new Error('Pas encore connecté à TikTok : va dans Réglages > Se connecter à TikTok');
  let tokens = JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));
  if (Date.now() > tokens.expires_at - 5 * 60_000) {
    if (Date.now() > tokens.refresh_expires_at) throw new Error('Connexion TikTok expirée : reconnecte-toi dans Réglages');
    tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  }
  if (!tokens.scope?.includes('video.upload')) throw new Error('Le droit video.upload n\'a pas été accordé : vérifie la configuration de l\'appli puis reconnecte-toi.');
  return tokens.access_token;
}
