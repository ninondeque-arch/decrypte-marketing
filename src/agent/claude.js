// Lance Claude Code en mode non interactif (`claude -p`) pour la veille et la rédaction.
// Utilise l'abonnement Claude de l'utilisatrice : aucune clé d'API.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { ROOT } from '../config.js';

/** Outils autorisés sans confirmation : recherche web, fichiers du projet, commandes du pipeline, Chrome. */
const ALLOWED_TOOLS = [
  'WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'Bash(npm run:*)', 'Bash(node:*)', 'Bash(curl:*)', 'Bash(mkdir:*)', 'Bash(ls:*)', 'Bash(file:*)', 'Bash(python3:*)', 'Bash(mv:*)',
  'mcp__claude-in-chrome__*',
];

/** Chemin du CLI `claude` (le PATH est minimal quand le studio tourne en tâche de fond). */
export function claudeBin() {
  const candidates = [
    process.env.CLAUDE_BIN,
    ...(process.env.PATH ?? '').split(delimiter).map(d => join(d, 'claude')),
    join(homedir(), '.npm-global/bin/claude'),
    join(homedir(), '.claude/local/claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ].filter(Boolean);
  const found = candidates.find(existsSync);
  if (!found) throw new Error('Claude Code introuvable : installe-le (npm i -g @anthropic-ai/claude-code) ou renseigne CLAUDE_BIN dans .env');
  return found;
}

/** Résumé lisible d'un appel d'outil, pour le journal du studio. */
function describeTool({ name, input = {} }) {
  if (name === 'WebSearch') return `🔎 Recherche : ${input.query}`;
  if (name === 'WebFetch') return `🌐 Lecture : ${input.url}`;
  if (name === 'Write') return `✏️  Écrit : ${String(input.file_path).replace(ROOT + '/', '')}`;
  if (name === 'Edit') return `✏️  Modifie : ${String(input.file_path).replace(ROOT + '/', '')}`;
  if (name === 'Bash') return `▶ ${String(input.command).split('\n')[0].slice(0, 120)}`;
  if (name.includes('Metricool')) return `📅 Metricool : ${name.split('__').pop()}`;
  if (name.startsWith('mcp__claude-in-chrome__')) return `🧭 Chrome : ${name.replace('mcp__claude-in-chrome__', '')}`;
  if (name === 'Read' || name === 'Glob' || name === 'Grep') return null; // trop bavard
  return `• ${name}`;
}

/**
 * Exécute une consigne avec Claude Code et suit sa progression.
 * @param {string} prompt
 * @param {{onLog?: (line: string) => void, chrome?: boolean}} opts
 * @returns {Promise<{text: string, isError: boolean}>}
 */
export function runClaude(prompt, { onLog = () => {}, chrome = false, tools = ALLOWED_TOOLS } = {}) {
  const bin = claudeBin();
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', ...tools];
  if (chrome) args.push('--chrome');
  // Node et claude doivent être trouvables même sous launchd
  const PATH = [dirname(process.execPath), dirname(bin), process.env.PATH ?? '', '/usr/bin', '/bin'].join(delimiter);

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: ROOT, env: { ...process.env, PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '', final = null, stderr = '';
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === 'assistant') {
          for (const part of event.message?.content ?? []) {
            if (part.type === 'tool_use') { const d = describeTool(part); if (d) onLog(d); }
            else if (part.type === 'text' && part.text.trim()) onLog(`💬 ${part.text.trim().split('\n')[0].slice(0, 200)}`);
          }
        } else if (event.type === 'result') {
          final = { text: event.result ?? '', isError: !!event.is_error };
        }
      }
    });
    child.stderr.on('data', c => { stderr += c; });
    child.on('error', reject);
    child.on('close', code => {
      if (final) resolve(final);
      else reject(new Error(`Claude Code s'est arrêté (code ${code}) ${stderr.trim().slice(-400)}`));
    });
  });
}
