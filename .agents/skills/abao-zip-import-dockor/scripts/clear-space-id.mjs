#!/usr/bin/env node
/** Atomically remove only top-level spaceId from a QMuse CLI JSON config. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

function regularFile(file) {
  const meta = fs.lstatSync(file);
  if (meta.isSymbolicLink() || !meta.isFile() || meta.nlink !== 1 || meta.size > 1024 * 1024) {
    throw new Error('Config must be a regular nonlinked JSON file under 1 MiB');
  }
  return meta;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function clearSpaceId(configPath, backupDirectory, projectRoot = null) {
  const file = path.resolve(configPath);
  if (path.basename(file) !== '.qmuse-cli.json') throw new Error('Refusing to modify a non-QMuse config filename');
  const before = regularFile(file);
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
  const fd = fs.openSync(file, flags);
  let raw;
  try {
    const opened = fs.fstatSync(fd);
    if (opened.ino !== before.ino || opened.dev !== before.dev || opened.size !== before.size || opened.nlink !== 1) throw new Error('Config changed before read');
    raw = fs.readFileSync(fd, 'utf8');
  } finally { fs.closeSync(fd); }
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error('Config is not valid JSON; no changes made'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Config root must be a JSON object');
  if (!Object.hasOwn(value, 'spaceId')) return { status: 'UNCHANGED', changed: false, configPath: file };

  const backupDir = path.resolve(backupDirectory);
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupMeta = fs.lstatSync(backupDir);
  if (backupMeta.isSymbolicLink() || !backupMeta.isDirectory()) throw new Error('Backup directory must be a real directory');
  fs.chmodSync(backupDir, 0o700);

  if (projectRoot) {
    const realProject = fs.realpathSync(path.resolve(projectRoot));
    const realBackup = fs.realpathSync(backupDir);
    if (isInside(realProject, realBackup)) {
      throw new Error('Backup directory must remain outside the project/upload root');
    }
  }

  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  const backup = path.join(backupDir, `.qmuse-cli.backup-${Date.now()}-${digest.slice(0, 12)}.json`);
  fs.writeFileSync(backup, raw, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  fs.chmodSync(backup, 0o600);

  delete value.spaceId;
  const output = `${JSON.stringify(value, null, 2)}\n`;
  const current = regularFile(file);
  if (current.ino !== before.ino || current.dev !== before.dev || current.size !== before.size || current.mtimeMs !== before.mtimeMs) {
    throw new Error('Config changed concurrently; backup kept and no changes made');
  }
  const temporary = path.join(path.dirname(file), `.qmuse-cli.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`);
  try {
    fs.writeFileSync(temporary, output, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.chmodSync(temporary, 0o600);
    const tempFd = fs.openSync(temporary, 'r+');
    try { fs.fsyncSync(tempFd); } finally { fs.closeSync(tempFd); }
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o600);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  return { status: 'CLEARED', changed: true, configPath: file, backupPath: backup, beforeSha256: digest };
}

export function main(argv = process.argv.slice(2)) {
  const config = argv[0];
  const index = argv.indexOf('--backup-dir');
  const backup = index >= 0 ? argv[index + 1] : undefined;
  const projectIdx = argv.indexOf('--project-root');
  const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : undefined;
  try {
    if (!config || !backup) throw new Error('Usage: node clear-space-id.mjs <.qmuse-cli.json> --backup-dir <secureDirectory> [--project-root <dir>]');
    console.log(JSON.stringify(clearSpaceId(config, backup, projectRoot), null, 2));
    return 0;
  } catch (error) {
    console.log(JSON.stringify({ status: 'BLOCKED', message: error.message }, null, 2));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) process.exit(main());
