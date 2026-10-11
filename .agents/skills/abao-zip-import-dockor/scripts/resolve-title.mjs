#!/usr/bin/env node
/** Resolve a QMuse application title without executing project code. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TITLE_KEYS = ['标题', 'title', 'name'];
const PATH_KEYS = ['html', 'htmlPath', 'html_path', 'path', 'directory', 'dir', 'folder', '项目目录', '目录', 'html路径'];
const PROJECT_KEYS = ['project', 'projectName', 'directory', 'dir', 'folder', '项目', '目录'];
const TEXT_FILES = ['标题与介绍.txt', 'title.txt'];
const README_FILES = ['README.md', 'README.markdown', 'README.txt', 'readme.md', 'readme.txt'];

function cleanTitle(value) {
  if (typeof value !== 'string') return null;
  const title = value.replace(/^\uFEFF/u, '').trim();
  if (!title || title.length > 200 || /[\r\n\0]/u.test(title)) return null;
  return title;
}

function titleFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const key of TITLE_KEYS) {
    const title = cleanTitle(value[key]);
    if (title) return { title, key };
  }
  return null;
}

function pathMatches(entry, projectRoot, metadataDir) {
  const basename = path.basename(projectRoot).toLowerCase();
  for (const key of PROJECT_KEYS) {
    if (typeof entry[key] === 'string' && entry[key].trim().toLowerCase() === basename) return true;
  }
  for (const key of PATH_KEYS) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) continue;
    const resolved = path.resolve(metadataDir, entry[key].trim());
    const candidate = path.extname(resolved).toLowerCase() === '.html' ? path.dirname(resolved) : resolved;
    const relative = path.relative(projectRoot, candidate);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return true;
    if (path.basename(candidate).toLowerCase() === basename) return true;
  }
  return false;
}

function parseMetadata(file, projectRoot, warnings) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { warnings.push({ file, rule: 'invalid-json' }); return null; }
  if (!Array.isArray(data)) {
    const found = titleFromObject(data);
    return found ? { ...found, file } : null;
  }
  let matches = data.filter(item => item && typeof item === 'object' && !Array.isArray(item) && pathMatches(item, projectRoot, path.dirname(file)));
  if (matches.length === 0 && data.length === 1 && path.dirname(file) === projectRoot) matches = data;
  const found = matches.map(titleFromObject).filter(Boolean);
  const titles = [...new Set(found.map(item => item.title))];
  if (titles.length === 1) return { title: titles[0], key: found[0].key, file };
  if (titles.length > 1) warnings.push({ file, rule: 'ambiguous-matching-titles', count: titles.length });
  return null;
}

function firstNonemptyLine(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/u)) {
      const title = cleanTitle(line);
      if (title) return title;
    }
  } catch {}
  return null;
}

function readPackageName(file, warnings) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { warnings.push({ file, rule: 'invalid-package-json' }); return null; }
  return cleanTitle(data?.name);
}

function readReadmeTitle(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/u)) {
      const match = line.match(/^#\s+(.+?)\s*$/u);
      if (match) return cleanTitle(match[1]);
    }
  } catch {}
  return null;
}

export function resolveTitle(projectPath, explicitTitle) {
  const projectRoot = fs.realpathSync(projectPath);
  if (!fs.statSync(projectRoot).isDirectory()) throw new Error('Project root must be a directory');
  const warnings = [];
  const userTitle = cleanTitle(explicitTitle);
  if (userTitle) return { status: 'FOUND', title: userTitle, source: 'user', warnings };

  const parent = path.dirname(projectRoot);
  for (const directory of [projectRoot, parent]) {
    for (const filename of ['apps.json', 'app.json']) {
      const file = path.join(directory, filename);
      if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) continue;
      const found = parseMetadata(file, projectRoot, warnings);
      if (found) return { status: 'FOUND', title: found.title, source: filename, field: found.key, file, warnings };
    }
  }

  const packageFile = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageFile) && !fs.lstatSync(packageFile).isSymbolicLink()) {
    const title = readPackageName(packageFile, warnings);
    if (title) return { status: 'FOUND', title, source: 'package.json', file: packageFile, warnings };
  }

  for (const filename of TEXT_FILES) {
    const file = path.join(projectRoot, filename);
    if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) continue;
    const title = firstNonemptyLine(file);
    if (title) return { status: 'FOUND', title, source: filename, file, warnings };
  }

  for (const filename of README_FILES) {
    const file = path.join(projectRoot, filename);
    if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) continue;
    const title = readReadmeTitle(file);
    if (title) return { status: 'FOUND', title, source: 'README', file, warnings };
  }
  return { status: 'NEEDS_USER', warnings };
}

export function main(argv = process.argv.slice(2)) {
  const project = argv[0];
  const index = argv.indexOf('--user-title');
  const explicit = index >= 0 ? argv[index + 1] : undefined;
  try {
    if (!project) throw new Error('Usage: node resolve-title.mjs <projectRoot> [--user-title <title>]');
    const result = resolveTitle(project, explicit);
    console.log(JSON.stringify(result, null, 2));
    return result.status === 'FOUND' ? 0 : 2;
  } catch (error) {
    console.log(JSON.stringify({ status: 'BLOCKED', message: error.message }, null, 2));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) process.exit(main());
