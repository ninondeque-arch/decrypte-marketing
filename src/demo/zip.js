// Archive ZIP minimale (fichiers stockés sans compression), sans dépendance ni commande `zip` :
// la démo est construite sur Vercel, où l'outil `zip` n'est pas garanti.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import zlib from 'node:zlib';

const TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => (zlib.crc32 ? zlib.crc32(buf) : (buf.reduce((c, b) => TABLE[(c ^ b) & 0xFF] ^ (c >>> 8), 0xFFFFFFFF) ^ 0xFFFFFFFF) >>> 0);

/** Écrit `out` avec les fichiers donnés, à plat (comme `zip -j`). */
export function writeZip(out, files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const file of files) {
    const data = readFileSync(file), name = Buffer.from(basename(file), 'utf8'), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); // UTF-8
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  writeFileSync(out, Buffer.concat([...locals, dir, end]));
}
