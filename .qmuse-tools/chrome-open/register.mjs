// 入口：node --import .qmuse-tools/chrome-open/register.mjs <cli.js> login
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

register(pathToFileURL(path.join(import.meta.dirname, 'hook.mjs')).href);
