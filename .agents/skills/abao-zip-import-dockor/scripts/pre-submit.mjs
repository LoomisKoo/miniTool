#!/usr/bin/env node
/** Mechanically validate and generate the phase-6 pre-submit checkpoint JSON. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditTree } from './audit-source.mjs';

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

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

const ALLOWED_SOURCES = new Set([
  'user', 'apps.json', 'app.json', 'package.json',
  '标题与介绍.txt', 'title.txt', 'README'
]);

export function generatePreSubmit(options) {
  const suppliedProject = path.resolve(nonempty(options.projectRoot, 'projectRoot'));
  const projectStat = fs.lstatSync(suppliedProject);
  if (projectStat.isSymbolicLink() || !projectStat.isDirectory()) throw new Error('projectRoot must be a directory');
  const projectRoot = fs.realpathSync(suppliedProject);

  const suppliedStaging = path.resolve(nonempty(options.stagingRoot, 'stagingRoot'));
  const stagingStat = fs.lstatSync(suppliedStaging);
  if (stagingStat.isSymbolicLink() || !stagingStat.isDirectory()) throw new Error('stagingRoot must be a directory');
  const stagingRoot = fs.realpathSync(suppliedStaging);

  const titleValue = nonempty(options.title, 'title');
  const titleSource = nonempty(options.titleSource, 'titleSource');
  if (!ALLOWED_SOURCES.has(titleSource)) {
    throw new Error(`titleSource must be one of: ${[...ALLOWED_SOURCES].join(', ')}`);
  }

  const spaceId = nonempty(options.spaceId, 'spaceId');
  if (!/^S[A-Za-z0-9_-]+$/u.test(spaceId)) throw new Error('spaceId has an invalid format');

  const apiEnvironment = nonempty(options.apiEnvironment ?? 'prod', 'apiEnvironment');
  if (!['prod', 'pre'].includes(apiEnvironment)) throw new Error('apiEnvironment must be prod or pre');

  const operation = nonempty(options.operation, 'operation');
  if (!['CREATE', 'UPDATE'].includes(operation)) throw new Error('operation must be CREATE or UPDATE');

  let targetAppId = null;
  if (operation === 'UPDATE') {
    targetAppId = nonempty(options.targetAppId, 'targetAppId');
  } else if (options.targetAppId) {
    throw new Error('CREATE operation must not specify targetAppId');
  }

  const cloudMode = nonempty(options.cloudMode ?? 'NONE', 'cloudMode');
  if (!['NONE', 'EXTERNAL', 'QMUSE'].includes(cloudMode)) throw new Error('cloudMode must be NONE, EXTERNAL, or QMUSE');
  const cloudImpact = typeof options.cloudImpact === 'string' ? options.cloudImpact.trim() : 'none';

  // Audit staging
  let auditReport;
  if (options.auditReportPath) {
    const reportFile = path.resolve(options.auditReportPath);
    if (!fs.existsSync(reportFile)) throw new Error('auditReportPath file not found');
    const raw = fs.readFileSync(reportFile, 'utf8');
    auditReport = JSON.parse(raw);
  } else {
    // Audit dynamically if not pre-saved
    auditReport = auditTree(stagingRoot, options.manifest ?? null);
  }

  if (auditReport.status !== 'PASS') {
    throw new Error(`Staging audit did not PASS (status: ${auditReport.status}). Fix audit findings before checkpoint.`);
  }
  if (!auditReport.manifestSha256 || typeof auditReport.fileCount !== 'number' || typeof auditReport.totalBytes !== 'number') {
    throw new Error('Invalid audit report: missing manifestSha256, fileCount, or totalBytes');
  }

  const suppliedOutput = path.resolve(nonempty(options.outputPath, 'outputPath'));
  const outputDir = path.dirname(suppliedOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  }
  const realOutputDir = fs.realpathSync(outputDir);
  if (isInside(stagingRoot, realOutputDir) || isInside(stagingRoot, suppliedOutput)) {
    throw new Error('outputPath must remain outside stagingRoot');
  }
  if (isInside(projectRoot, realOutputDir) || isInside(projectRoot, suppliedOutput)) {
    throw new Error('outputPath must remain outside projectRoot');
  }

  const checkpoint = {
    projectRoot,
    stagingRoot,
    title: {
      value: titleValue,
      source: titleSource
    },
    spaceId,
    apiEnvironment,
    operation,
    targetAppId,
    fileCount: auditReport.fileCount,
    totalBytes: auditReport.totalBytes,
    manifestSha256: auditReport.manifestSha256,
    auditStatus: auditReport.status,
    exceptions: [],
    cloudMode,
    cloudImpact: cloudImpact || 'none',
    authorizationMatches: options.authorizationMatches !== false
  };

  const outputContent = `${JSON.stringify(checkpoint, null, 2)}\n`;
  const temporary = path.join(realOutputDir, `.pre-submit.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temporary, outputContent, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.chmodSync(temporary, 0o600);
    const fd = fs.openSync(temporary, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, suppliedOutput);
    fs.chmodSync(suppliedOutput, 0o600);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }

  return {
    status: 'CHECKPOINT_VERIFIED',
    checkpointPath: suppliedOutput,
    checkpoint
  };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const projectRoot = argument(argv, '--project-root');
    const stagingRoot = argument(argv, '--staging-root');
    const title = argument(argv, '--title');
    const titleSource = argument(argv, '--title-source') ?? 'package.json';
    const spaceId = argument(argv, '--space-id');
    const operation = argument(argv, '--operation') ?? 'CREATE';
    const targetAppId = argument(argv, '--target-app-id');
    const outputPath = argument(argv, '--output');
    const auditReportPath = argument(argv, '--audit-report');
    const cloudMode = argument(argv, '--cloud-mode') ?? 'NONE';
    const cloudImpact = argument(argv, '--cloud-impact') ?? 'none';
    const apiEnvironment = argument(argv, '--env') ?? 'prod';

    if (!projectRoot || !stagingRoot || !title || !spaceId || !outputPath) {
      throw new Error('Usage: node pre-submit.mjs --project-root <dir> --staging-root <dir> --title <title> --space-id <id> --output <path> [--title-source <src>] [--operation CREATE|UPDATE] [--target-app-id <id>] [--audit-report <path>] [--env prod|pre] [--cloud-mode NONE|EXTERNAL|QMUSE]');
    }

    const result = generatePreSubmit({
      projectRoot,
      stagingRoot,
      title,
      titleSource,
      spaceId,
      operation,
      targetAppId,
      outputPath,
      auditReportPath,
      cloudMode,
      cloudImpact,
      apiEnvironment,
      authorizationMatches: true
    });

    console.log(JSON.stringify(result.checkpoint, null, 2));
    return 0;
  } catch (error) {
    console.log(JSON.stringify({ status: 'BLOCKED', message: error.message }, null, 2));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
