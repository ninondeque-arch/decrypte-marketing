// Démarrage automatique du studio à l'ouverture de session (macOS, launchd).
// Le studio reste alors disponible sur http://localhost:4321 comme un site, et lance la veille chaque matin.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { claudeBin } from '../agent/claude.js';
import { ROOT } from '../config.js';

const LABEL = 'com.decrypte.studio';
const PLIST = join(homedir(), 'Library/LaunchAgents', `${LABEL}.plist`);
const LOG_DIR = join(ROOT, '.studio');
const domain = `gui/${userInfo().uid}`;
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function install() {
  const PATH = [dirname(process.execPath), dirname(claudeBin()), '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':');
  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(dirname(PLIST), { recursive: true });
  writeFileSync(PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(process.execPath)}</string>
    <string>--watch-path=${xml(join(ROOT, 'src'))}</string>
    <string>${xml(join(ROOT, 'src/studio/server.js'))}</string>
  </array>
  <key>WorkingDirectory</key><string>${xml(ROOT)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${xml(PATH)}</string>
    <key>STUDIO_NO_OPEN</key><string>1</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${xml(join(LOG_DIR, 'studio.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(LOG_DIR, 'studio.log'))}</string>
</dict>
</plist>
`);
  try { execFileSync('launchctl', ['bootout', `${domain}/${LABEL}`], { stdio: 'ignore' }); } catch { /* pas encore chargé */ }
  execFileSync('launchctl', ['bootstrap', domain, PLIST]);
  return PLIST;
}

export const isInstalled = () => existsSync(PLIST);

export function uninstall() {
  try { execFileSync('launchctl', ['bootout', `${domain}/${LABEL}`], { stdio: 'ignore' }); } catch { /* déjà arrêté */ }
  if (existsSync(PLIST)) rmSync(PLIST);
}
