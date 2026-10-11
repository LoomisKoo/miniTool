#!/usr/bin/env node
/**
 * Read-only staged-source / ZIP audit. Never extracts or executes project code.
 * Zero external dependencies (Node.js 20+ built-ins: fs, path, crypto, zlib).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const MAX_FILES = 5000;
export const MAX_FILE = 10 * 1024 * 1024;
export const MAX_TOTAL = 100 * 1024 * 1024;
export const MAX_RATIO = 100;
export const MAX_REPORT_ITEMS = 200;

export const DENY_DIRS = new Set([
  '.git', '.ssh', '.aws', '.azure', '.gcloud', '.kube', '.gnupg', '.qmuse', 'node_modules', '__pycache__'
]);

export const DENY_NAMES = new Set([
  '.npmrc', '.yarnrc', '.yarnrc.yml', '.pypirc', '.netrc', '_netrc',
  'credentials', 'credentials.json', 'id_rsa', 'id_ed25519', 'kubeconfig',
  'service-account.json', 'last-import-error.json'
]);

export const DENY_SUFFIXES = new Set([
  '.pem', '.key', '.p12', '.pfx', '.crt', '.cer', '.db', '.sqlite',
  '.sqlite3', '.sql', '.log', '.zip', '.tgz', '.gz', '.tar', '.7z',
  '.exe', '.dll', '.dylib', '.so'
]);

export const SECRET_RULES = [
  { rule: 'private-key', pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { rule: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { rule: 'npm-token', pattern: /\bnpm_[A-Za-z0-9]{24,}\b/ },
  { rule: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{30,})\b/ },
  { rule: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  {
    rule: 'secret-assignment',
    pattern: /(?:["']?)(?:password|passwd|secret|private[_-]?key|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|token)(?:["']?)\s*[:=]\s*["'`]([^"'`\r\n]{8,})["'`]/i
  },
  {
    rule: 'unquoted-secret-assignment',
    pattern: /\b(?:password|passwd|secret|private[_-]?key|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|token)\s*[:=]\s*[^\s"'`;,#{}]{8,}/i
  },
  {
    rule: 'bearer-header',
    pattern: /(?:\bAuthorization\s*[:=]\s*)?Bearer\s+[A-Za-z0-9._~+/=-]{8,}/i
  }
];

const TOKEN_REGEX = /(?<![A-Za-z0-9/+_-])[A-Za-z0-9/+_-]{32,}={0,2}(?![A-Za-z0-9/+_-])/g;

export function safeName(name) {
  if (!name || name.includes('\\') || /^[A-Za-z]:/.test(name)) return false;
  for (let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) < 32) return false;
  }
  const parts = name.split('/');
  if (name.startsWith('/') || parts.includes('..') || parts.includes('') || parts.includes('.')) {
    return false;
  }
  const windowsReserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
  if (parts.some(part => /[ .]$/.test(part) || windowsReserved.test(part))) return false;
  return true;
}

export function getAllSuffixes(filename) {
  const base = path.posix.basename(filename);
  const parts = base.split('.');
  if (parts.length <= 1) return [];
  const suffixes = [];
  for (let i = 1; i < parts.length; i++) {
    suffixes.push('.' + parts[i].toLowerCase());
  }
  return suffixes;
}

export function denied(name) {
  const parts = name.split('/');
  const blockedComponent = parts.some(p => {
    const lower = p.toLowerCase();
    if (DENY_DIRS.has(lower) || lower.startsWith('.env')) return true;
    for (const item of DENY_NAMES) {
      if (lower === item || lower.startsWith(item + '.')) return true;
    }
    return false;
  });
  if (blockedComponent) return true;
  const suffixes = getAllSuffixes(name);
  return suffixes.some(s => DENY_SUFFIXES.has(s));
}

export function imageKind(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return '.png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return '.jpg';
  }
  if (buf.length >= 6) {
    const head = buf.subarray(0, 6).toString('ascii');
    if (head === 'GIF87a' || head === 'GIF89a') return '.gif';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return '.webp';
  }
  return null;
}

export function entropy(str) {
  const counts = new Map();
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  let ent = 0;
  const len = str.length;
  for (const count of counts.values()) {
    const p = count / len;
    ent -= p * Math.log2(p);
  }
  return ent;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let k = 0; k < 8; k++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  CRC_TABLE[n] = value >>> 0;
}

export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

export function validIntegrity(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(sha1|sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  try {
    const canonical = match[2].replace(/=+$/, '');
    const buf = Buffer.from(match[2], 'base64');
    if (buf.toString('base64').replace(/=+$/, '') !== canonical) return false;
    const expected = { sha1: 20, sha256: 32, sha384: 48, sha512: 64 }[match[1]];
    return buf.length === expected;
  } catch {
    return false;
  }
}

export function scan(data, name, findings, review) {
  if (findings.length + review.length >= MAX_REPORT_ITEMS) {
    if (!findings.some(item => item.rule === 'project-scan-limit-exceeded')) {
      findings.push({ path: name, rule: 'project-scan-limit-exceeded' });
    }
    return;
  }
  const ext = path.posix.extname(name).toLowerCase();
  const kind = imageKind(data);
  if (kind) {
    const expected = ext === '.jpeg' ? '.jpg' : ext;
    if (expected !== kind) {
      findings.push({ path: name, rule: 'image-extension-mismatch' });
    }
    review.push({
      path: name,
      rule: 'binary-media-review',
      note: 'Check provenance, visible content and metadata; text secret scanning does not inspect embedded media metadata.'
    });
    return;
  }
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
    findings.push({ path: name, rule: 'invalid-image-signature' });
    return;
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    if (text.includes('\0')) throw new Error('nul byte');
  } catch {
    findings.push({ path: name, rule: 'unreviewed-binary' });
    return;
  }

  // Check secret rules
  for (const { rule, pattern } of SECRET_RULES) {
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let m;
    while ((m = regex.exec(text)) !== null) {
      const line = text.slice(0, m.index).split('\n').length;
      findings.push({ path: name, rule, line });
      if (findings.filter(f => f.path === name).length >= 20) {
        findings.push({ path: name, rule: 'scan-limit-exceeded' });
        return;
      }
    }
  }

  // Mask package-lock / npm-shrinkwrap integrity hashes if validated
  let entropyText = text;
  const baseName = path.posix.basename(name);
  if (baseName === 'package-lock.json' || baseName === 'npm-shrinkwrap.json') {
    try {
      const lock = JSON.parse(text);
      const recognized = new Set();
      if (lock && (lock.lockfileVersion === 1 || lock.lockfileVersion === 2 || lock.lockfileVersion === 3)) {
        const packages = lock.packages || {};
        for (const item of Object.values(packages)) {
          if (item && typeof item === 'object' && validIntegrity(item.integrity)) {
            recognized.add(item.integrity);
          }
        }
      }
      entropyText = text.replace(/"integrity"\s*:\s*"([^"\r\n]+)"/g, (match, val) => {
        return recognized.has(val) ? '"integrity":"checked-hash"' : match;
      });
    } catch {
      findings.push({ path: name, rule: 'invalid-lockfile' });
    }
  }

  // Token regex search
  const tokenRe = new RegExp(TOKEN_REGEX.source, 'g');
  let tm;
  while ((tm = tokenRe.exec(entropyText)) !== null) {
    const val = tm[0];
    const isHex = /^[0-9a-fA-F]{32,128}$/.test(val);
    const threshold = isHex ? 3.3 : 4.5;
    if (entropy(val) >= threshold) {
      const line = entropyText.slice(0, tm.index).split('\n').length;
      review.push({
        path: name,
        rule: isHex ? 'hex-credential-candidate' : 'high-entropy-candidate',
        line
      });
      if (review.filter(f => f.path === name).length >= 20) {
        findings.push({ path: name, rule: 'scan-limit-exceeded' });
        return;
      }
    }
  }
}

export function report(kind, entries, findings, review) {
  if (entries.length === 0 && findings.length === 0) {
    findings.push({ path: '.', rule: 'empty-upload-set' });
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const encoded = Buffer.from(JSON.stringify(entries));
  const manifestSha256 = crypto.createHash('sha256').update(encoded).digest('hex');

  let status = 'PASS';
  if (findings.length > 0) status = 'BLOCKED';
  else if (review.length > 0) status = 'REVIEW_REQUIRED';

  return {
    schemaVersion: 1,
    mode: kind,
    status,
    limits: {
      files: MAX_FILES,
      singleFileBytes: MAX_FILE,
      totalBytes: MAX_TOTAL,
      zipRatio: MAX_RATIO,
      reportItems: MAX_REPORT_ITEMS
    },
    fileCount: entries.length,
    totalBytes: entries.reduce((acc, e) => acc + e.size, 0),
    manifestSha256,
    entries,
    findings,
    reviewRequired: review,
    limitations: 'Heuristic text scan; not proof of no secrets or safe code. No code executed, archives extracted, or files uploaded. Re-audit immutable staging before upload; independently compare CLI collected file set.'
  };
}

export function auditTree(directory, manifest = null) {
  const supplied = path.resolve(directory);
  if (!fs.existsSync(supplied)) {
    throw new Error('Staging directory does not exist: ' + supplied);
  }
  const root = fs.realpathSync(supplied);
  const rootStat = fs.lstatSync(supplied);
  if (rootStat.isSymbolicLink() || !fs.statSync(root).isDirectory()) {
    throw new Error('Staging root must be a real directory, not a symlink');
  }

  const entries = [];
  const findings = [];
  const review = [];
  const seen = new Set();
  let total = 0;
  let count = 0;

  function examine(absPath, rel, recurse = true) {
    count++;
    if (count > MAX_FILES) throw new Error('File/entry count limit exceeded');

    const folded = rel.normalize('NFC').toLowerCase();
    if (!safeName(rel) || seen.has(folded)) {
      findings.push({ path: rel, rule: 'unsafe-or-colliding-path' });
      return;
    }
    seen.add(folded);

    const meta = fs.lstatSync(absPath);
    if (meta.isSymbolicLink()) {
      findings.push({ path: rel, rule: 'symlink-forbidden' });
      return;
    }
    if (denied(rel)) {
      findings.push({ path: rel, rule: 'denied-path' });
      return;
    }

    const real = fs.realpathSync(absPath);
    const relToRoot = path.relative(root, real);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      findings.push({ path: rel, rule: 'realpath-escape' });
      return;
    }

    if (meta.isDirectory()) {
      if (recurse) walk(absPath);
      else findings.push({ path: rel, rule: 'manifest-entry-not-file' });
      return;
    }

    if (!meta.isFile()) {
      findings.push({ path: rel, rule: 'special-file-forbidden' });
      return;
    }
    if (meta.nlink !== 1) {
      findings.push({ path: rel, rule: 'hardlink-forbidden' });
      return;
    }
    if (meta.size > MAX_FILE || total + meta.size > MAX_TOTAL) {
      findings.push({ path: rel, rule: 'size-limit' });
      return;
    }

    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
    const fd = fs.openSync(absPath, flags);
    let data;
    try {
      const before = fs.fstatSync(fd);
      if (before.ino !== meta.ino || before.dev !== meta.dev || before.nlink !== 1 || before.size !== meta.size) {
        findings.push({ path: rel, rule: 'file-changed-during-audit' });
        return;
      }
      data = Buffer.alloc(meta.size);
      let read = 0;
      while (read < meta.size) {
        const count = fs.readSync(fd, data, read, meta.size - read, read);
        if (count === 0) break;
        read += count;
      }
      const after = fs.fstatSync(fd);
      if (read !== meta.size || after.ino !== before.ino || after.dev !== before.dev ||
          after.nlink !== before.nlink || after.size !== before.size ||
          after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
        findings.push({ path: rel, rule: 'file-changed-during-audit' });
        return;
      }
    } finally {
      fs.closeSync(fd);
    }

    total += data.length;
    entries.push({
      path: rel,
      size: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex')
    });
    scan(data, rel, findings, review);
  }

  function walk(currentDir) {
    const items = fs.readdirSync(currentDir).sort();
    for (const item of items) {
      const abs = path.join(currentDir, item);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      examine(abs, rel, true);
    }
  }

  if (manifest === null) {
    walk(root);
  } else {
    if (!Array.isArray(manifest) || manifest.length === 0 || manifest.length > MAX_FILES ||
        manifest.some(p => typeof p !== 'string')) {
      throw new Error('Manifest must be a nonempty array of relative file paths');
    }
    for (const rel of manifest) {
      if (!safeName(rel)) {
        findings.push({ path: rel, rule: 'unsafe-manifest-path' });
        continue;
      }
      const abs = path.resolve(root, rel);
      // Check parent symlinks
      const parts = rel.split('/');
      let cur = root;
      let linkedParent = false;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = path.join(cur, parts[i]);
        if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) {
          linkedParent = true;
          break;
        }
      }
      if (linkedParent) {
        findings.push({ path: rel, rule: 'symlink-parent-forbidden' });
        continue;
      }
      if (!fs.existsSync(abs)) {
        findings.push({ path: rel, rule: 'manifest-file-not-found' });
        continue;
      }
      examine(abs, rel, false);
    }
  }

  const res = report('tree', entries, findings, review);
  res.selection = manifest !== null ? 'collector-manifest' : 'all-staging-files';
  return res;
}

export function auditZip(filename) {
  const metadata = fs.lstatSync(filename);
  if (!metadata.isFile() || metadata.nlink !== 1) {
    throw new Error('Archive must be a regular nonlinked file');
  }
  if (metadata.size > MAX_TOTAL) {
    throw new Error('Archive byte limit exceeded');
  }

  const buf = fs.readFileSync(filename);
  if (buf.length < 22) throw new Error('Bad ZIP file: too short');

  // Find End of Central Directory Record (0x06054b50)
  let eocdOffset = -1;
  const maxSearch = Math.min(buf.length, 65557);
  for (let i = buf.length - 22; i >= buf.length - maxSearch; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Bad ZIP file: missing EOCD signature');

  const diskNumber = buf.readUInt16LE(eocdOffset + 4);
  const centralDisk = buf.readUInt16LE(eocdOffset + 6);
  const diskEntries = buf.readUInt16LE(eocdOffset + 8);
  const cdEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const archiveCommentLength = buf.readUInt16LE(eocdOffset + 20);

  if (diskNumber !== 0 || centralDisk !== 0 || diskEntries !== cdEntries) {
    throw new Error('Multi-disk ZIP archives are unsupported');
  }
  if (cdEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are unsupported');
  }
  if (archiveCommentLength !== 0 || eocdOffset + 22 !== buf.length) {
    throw new Error('ZIP archive comments or trailing data are unsupported');
  }
  if (cdEntries > MAX_FILES) throw new Error('ZIP entry count limit exceeded');
  if (cdOffset + cdSize !== eocdOffset) throw new Error('Bad ZIP file: central directory boundary mismatch');

  const entries = [];
  const findings = [];
  const review = [];
  const seen = new Set();
  let total = 0;
  let pos = cdOffset;

  for (let i = 0; i < cdEntries; i++) {
    if (pos + 46 > buf.length) throw new Error('Bad ZIP file: truncated CD entry');
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x02014b50) throw new Error('Bad ZIP file: invalid CD signature');

    const flags = buf.readUInt16LE(pos + 8);
    const compMethod = buf.readUInt16LE(pos + 10);
    const centralCrc = buf.readUInt32LE(pos + 16);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const externalAttr = buf.readUInt32LE(pos + 38);
    const localOffset = buf.readUInt32LE(pos + 42);

    if (pos + 46 + nameLen + extraLen + commentLen > buf.length) {
      throw new Error('Bad ZIP file: entry header exceeds archive length');
    }

    const nameRaw = buf.subarray(pos + 46, pos + 46 + nameLen);
    const name = nameRaw.toString('utf8');

    // Filename truncation or NUL check
    if (name.includes('\0') || Buffer.byteLength(name, 'utf8') !== nameLen ||
        (nameRaw.some(byte => byte >= 0x80) && (flags & 0x0800) === 0)) {
      findings.push({ path: name, rule: 'zip-filename-truncation' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    const folded = name.replace(/\/+$/, '').normalize('NFC').toLowerCase();
    const mode = (externalAttr >>> 16) & 0xffff;
    const kind = mode & 0xf000;
    const isSymlink = kind === 0xa000;
    const isDir = name.endsWith('/') || kind === 0x4000;
    const isRegular = kind === 0 || kind === 0x8000;

    if (!safeName(name.replace(/\/+$/, '')) || seen.has(folded)) {
      findings.push({ path: name, rule: 'unsafe-or-colliding-path' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }
    seen.add(folded);

    if (isSymlink || (!isDir && !isRegular)) {
      findings.push({ path: name, rule: 'zip-link-or-special-file' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    if (extraLen > 0 || commentLen > 0) {
      findings.push({
        path: name,
        rule: extraLen > 0 ? 'zip-extra-fields-review' : 'zip-comment-review',
        note: 'Extra fields or comments can encode links or unsupported metadata. Repackage reviewed regular files in isolation.'
      });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    if (denied(name)) {
      findings.push({ path: name, rule: 'denied-path' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    if ((flags & ~0x0800) !== 0 || (compMethod !== 0 && compMethod !== 8)) {
      findings.push({ path: name, rule: 'encrypted-or-unsupported-zip' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    total += uncompSize;
    const ratio = uncompSize / Math.max(1, compSize);
    if (uncompSize > MAX_FILE || total > MAX_TOTAL || ratio > MAX_RATIO) {
      findings.push({ path: name, rule: 'zip-size-or-ratio-limit' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    if (isDir) {
      if (compSize !== 0 || uncompSize !== 0) findings.push({ path: name, rule: 'zip-directory-has-data' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    // Read and decompress entry
    if (localOffset + 30 > buf.length) throw new Error('Bad local header offset');
    const localSig = buf.readUInt32LE(localOffset);
    if (localSig !== 0x04034b50) throw new Error('Bad local header signature');
    const localFlags = buf.readUInt16LE(localOffset + 6);
    const localMethod = buf.readUInt16LE(localOffset + 8);
    const localCrc = buf.readUInt32LE(localOffset + 14);
    const localCompSize = buf.readUInt32LE(localOffset + 18);
    const localUncompSize = buf.readUInt32LE(localOffset + 22);
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLen;
    if (localNameEnd + localExtraLen > buf.length || localExtraLen !== 0 ||
        localFlags !== flags || localMethod !== compMethod || localCrc !== centralCrc ||
        localCompSize !== compSize || localUncompSize !== uncompSize ||
        !buf.subarray(localNameStart, localNameEnd).equals(nameRaw)) {
      findings.push({ path: name, rule: 'zip-local-header-mismatch' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }
    const dataStart = localNameEnd + localExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > cdOffset) throw new Error('Bad local entry payload length');

    const compData = buf.subarray(dataStart, dataEnd);
    let data;
    try {
      if (compMethod === 0) {
        data = compData;
      } else {
        data = zlib.inflateRawSync(compData, { maxOutputLength: Math.min(uncompSize + 1, MAX_FILE + 1) });
      }
    } catch {
      findings.push({ path: name, rule: 'zip-decompression-error' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    if (data.length !== uncompSize) {
      findings.push({ path: name, rule: 'zip-size-mismatch' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }
    if (crc32(data) !== centralCrc) {
      findings.push({ path: name, rule: 'zip-crc-mismatch' });
      pos += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    entries.push({
      path: name,
      size: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex')
    });
    scan(data, name, findings, review);

    pos += 46 + nameLen + extraLen + commentLen;
  }

  if (pos !== cdOffset + cdSize) throw new Error('Bad ZIP file: central directory size mismatch');
  return report('zip-inspection-only', entries, findings, review);
}

export function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  const targetPath = args[1];
  let manifestPath = null;
  const manifestIdx = args.indexOf('--manifest');
  if (manifestIdx >= 0 && args[manifestIdx + 1]) {
    manifestPath = args[manifestIdx + 1];
  }

  if (!mode || !targetPath || (mode !== 'tree' && mode !== 'zip')) {
    console.error('Usage: node audit-source.mjs <tree|zip> <path> [--manifest <manifest.json>]');
    process.exit(1);
  }

  let result;
  try {
    if (mode === 'zip' && manifestPath) {
      throw new Error('Manifest is only supported in tree mode');
    }
    const manifest = manifestPath ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
    result = mode === 'tree' ? auditTree(targetPath, manifest) : auditZip(targetPath);
  } catch (error) {
    result = {
      schemaVersion: 1,
      status: 'BLOCKED',
      errorType: error.name || 'Error',
      message: 'Audit incomplete; inspect the local path/archive without executing it.'
    };
  }

  console.log(JSON.stringify(result, null, 2));
  const exitCodes = { PASS: 0, REVIEW_REQUIRED: 2, BLOCKED: 1 };
  process.exit(exitCodes[result.status] ?? 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
