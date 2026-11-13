// Copies the single-file build to the repo root as avas-choices.html (served by GitHub Pages).
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
copyFileSync(resolve(here, '../dist/index.html'), resolve(here, '../../avas-choices.html'));
console.log('✔ Wrote ../avas-choices.html');
