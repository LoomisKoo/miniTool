#!/usr/bin/env node
/** Create a QMuse managed-project binding from trusted CREATE and status evidence. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BY_ENV = {
  prod: 'https://api.qmuse.cn',
  pre: 'https://api-pre.qmuse.cn'
};

function argument(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function nonempty(value, name, max = 512) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\0\r\n]/u.test(value)) {
    throw new Error(`${name} must be a nonempty single-line string`);
  }
  return value.trim();
}

function normalizeApiBaseUrl(value) {
  const url = new URL(nonempty(value, 'apiBaseUrl'));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('apiBaseUrl must use HTTP(S)');
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  return url.toString().replace(/\/$/u, '');
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readEvidenceFile(filename, projectRoot, label) {
  const supplied = path.resolve(filename);
  const stat = fs.lstatSync(supplied);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || stat.size > 1024 * 1024) {
    throw new Error(`${label} must be a regular nonlinked JSON file under 1 MiB`);
  }
  const evidencePath = fs.realpathSync(supplied);
  if (isInside(projectRoot, evidencePath)) throw new Error(`${label} must remain outside the managed project/upload root`);
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
  const fd = fs.openSync(supplied, flags);
  let raw;
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size || opened.nlink !== 1) {
      throw new Error(`${label} changed before read`);
    }
    raw = fs.readFileSync(fd, 'utf8');
  } finally { fs.closeSync(fd); }
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error(`${label} is not valid JSON`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} root must be a JSON object`);
  return { value, evidencePath, sha256: crypto.createHash('sha256').update(raw).digest('hex') };
}

export function createBinding(options) {
  const suppliedRoot = path.resolve(nonempty(options.projectRoot, 'projectRoot'));
  const rootStat = fs.lstatSync(suppliedRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('Project root must be a real directory');
  const projectRoot = fs.realpathSync(suppliedRoot);
  const environment = nonempty(options.environment ?? 'prod', 'environment');
  if (!['prod', 'pre'].includes(environment)) throw new Error('environment must be prod or pre');
  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl ?? API_BY_ENV[environment]);
  if (apiBaseUrl !== API_BY_ENV[environment]) throw new Error(`apiBaseUrl does not match ${environment}`);
  const spaceId = nonempty(options.spaceId, 'spaceId');
  if (!/^S[A-Za-z0-9_-]+$/u.test(spaceId)) throw new Error('spaceId has an invalid format');
  const expectedAppId = nonempty(options.expectedAppId, 'expectedAppId');

  const create = readEvidenceFile(options.evidencePath, projectRoot, 'CREATE evidence');
  if (create.value.success !== true || create.value.operation !== 'CREATE') throw new Error('CREATE evidence must be a successful CREATE result');
  const result = {
    jobId: nonempty(create.value.jobId, 'jobId'),
    appId: nonempty(create.value.appId, 'appId'),
    versionId: nonempty(create.value.versionId, 'versionId'),
    sourceHash: nonempty(create.value.sourceHash, 'sourceHash'),
    templateCommit: nonempty(create.value.templateCommit, 'templateCommit')
  };
  if (result.appId !== expectedAppId) throw new Error('CREATE evidence appId does not match expectedAppId');
  if (!/^[a-f0-9]{64}$/iu.test(result.sourceHash)) throw new Error('sourceHash must be a SHA-256 hex digest');
  if (!/^[a-f0-9]{7,64}$/iu.test(result.templateCommit)) throw new Error('templateCommit must be a commit-like hex identifier');

  const status = readEvidenceFile(options.statusEvidencePath, projectRoot, 'status evidence');
  if (!(status.value.status === 'READY' || status.value.success === true)) throw new Error('Status evidence must be a READY terminal result');
  if (nonempty(status.value.jobId, 'status jobId') !== result.jobId) throw new Error('Status evidence jobId does not match CREATE evidence');
  if (nonempty(status.value.appId, 'status appId') !== expectedAppId) throw new Error('Status evidence appId does not match expectedAppId');
  if (status.value.versionId !== undefined && status.value.versionId !== result.versionId) throw new Error('Status evidence versionId does not match CREATE evidence');

  let spaceIdVerifiedByEvidence = false;
  if (create.value.spaceId !== undefined) {
    if (nonempty(create.value.spaceId, 'CREATE evidence spaceId') !== spaceId) throw new Error('CREATE evidence spaceId does not match --space-id');
    spaceIdVerifiedByEvidence = true;
  }
  if (create.value.apiBaseUrl !== undefined && normalizeApiBaseUrl(create.value.apiBaseUrl) !== apiBaseUrl) {
    throw new Error('CREATE evidence apiBaseUrl does not match the target API environment');
  }

  const controlDir = path.join(projectRoot, '.qmuse');
  if (fs.existsSync(controlDir)) {
    const controlStat = fs.lstatSync(controlDir);
    if (controlStat.isSymbolicLink() || !controlStat.isDirectory()) throw new Error('.qmuse must be a real directory');
  } else {
    fs.mkdirSync(controlDir, { mode: 0o700 });
  }
  fs.chmodSync(controlDir, 0o700);
  const manifestPath = path.join(controlDir, 'project.json');
  if (fs.existsSync(manifestPath)) throw new Error('Refusing to overwrite an existing QMuse binding');

  const manifest = {
    schemaVersion: 1,
    packageVersion: 1,
    projectKind: 'QMUSE_TEMPLATE',
    appType: 'GENERAL',
    templateCommit: result.templateCommit,
    skillVersions: {},
    defaultSpaceId: spaceId,
    targets: {
      [environment]: {
        apiBaseUrl,
        appId: result.appId,
        spaceId,
        lastVersionId: result.versionId,
        lastSourceHash: result.sourceHash,
        updatedAt: new Date().toISOString()
      }
    }
  };
  const temporary = path.join(controlDir, `.project.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.chmodSync(temporary, 0o600);
    const fd = fs.openSync(temporary, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.linkSync(temporary, manifestPath);
    fs.unlinkSync(temporary);
    fs.chmodSync(manifestPath, 0o600);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  return {
    status: 'BINDING_CREATED',
    manifestPath,
    environment,
    apiBaseUrl,
    appId: result.appId,
    versionId: result.versionId,
    sourceHash: result.sourceHash,
    spaceId,
    spaceIdVerifiedByEvidence,
    statusEvidencePath: status.evidencePath,
    evidencePath: create.evidencePath,
    evidenceSha256: create.sha256,
    statusEvidenceSha256: status.sha256
  };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const projectRoot = argv[0];
    if (!projectRoot) throw new Error('Usage: node create-binding.mjs <projectRoot> --evidence <create-result.json> --status-evidence <ready-status.json> --space-id <id> --expected-app-id <id> [--env prod|pre]');
    const result = createBinding({
      projectRoot,
      evidencePath: argument(argv, '--evidence'),
      statusEvidencePath: argument(argv, '--status-evidence'),
      spaceId: argument(argv, '--space-id'),
      expectedAppId: argument(argv, '--expected-app-id'),
      environment: argument(argv, '--env') ?? 'prod',
      apiBaseUrl: argument(argv, '--api-base-url')
    });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.log(JSON.stringify({ status: 'BLOCKED', message: error.message }, null, 2));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) process.exit(main());
