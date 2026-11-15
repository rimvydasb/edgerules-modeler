// Serves `storybook-static` for the e2e tests, and rebuilds it only when it is older than its sources.
//
//   node scripts/serve-storybook-static.mjs <port>
//
// `FORCE_STORYBOOK_BUILD=1` always rebuilds. A full Storybook build takes minutes, so an unchanged tree must not pay it.
import {spawnSync, spawn} from 'node:child_process';
import {existsSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';

const port = process.argv[2] ?? '6006';
const OUT = 'storybook-static/index.json';
const SOURCES = ['src', 'stories', 'models', '.storybook', 'package-lock.json', 'tsconfig.json'];

function newest(path) {
  const stat = statSync(path, {throwIfNoEntry: false});
  if (!stat) return 0;
  if (!stat.isDirectory()) return stat.mtimeMs;
  let latest = 0;
  for (const entry of readdirSync(path, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    latest = Math.max(latest, newest(join(path, entry.name)));
  }
  return latest;
}

const built = existsSync(OUT) ? statSync(OUT).mtimeMs : 0;
const stale = process.env.FORCE_STORYBOOK_BUILD === '1' || SOURCES.some((source) => newest(source) > built);
if (stale) {
  console.log('storybook-static is missing or older than its sources: building');
  const result = spawnSync('npm', ['run', 'storybook:build'], {stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.log('storybook-static is up to date: not rebuilding');
}
spawn('npx', ['http-server', 'storybook-static', '-p', port, '-s'], {stdio: 'inherit'});
