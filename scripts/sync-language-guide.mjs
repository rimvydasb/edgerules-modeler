// Copies the topic files of ../edgerules/docs/reference/ into src/components/webmcp/project/guide/reference/ and writes
// guide-source.json (the engine commit and the file list). The copy is checked in, so CI needs no sibling repository.
// Usage: node scripts/sync-language-guide.mjs [path-to-edgerules-repository]
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engineRepository = resolve(process.argv[2] ?? join(root, '..', 'edgerules'));
const sourceDirectory = join(engineRepository, 'docs', 'reference');
const guideDirectory = join(root, 'src', 'components', 'webmcp', 'project', 'guide');
const targetDirectory = join(guideDirectory, 'reference');

// `_reference.md` (authoring rules) and `optimise-solver-hosting.md` (host wiring, not DSL) are not topics.
const EXCLUDED = new Set(['_reference.md', 'optimise-solver-hosting.md']);

if (!existsSync(sourceDirectory)) {
  console.error(`Not found: ${sourceDirectory}. Pass the path of the edgerules repository as the first argument.`);
  process.exit(1);
}

const files = readdirSync(sourceDirectory)
  .filter((file) => file.endsWith('.md') && !EXCLUDED.has(file))
  .sort();

rmSync(targetDirectory, {recursive: true, force: true});
mkdirSync(targetDirectory, {recursive: true});
for (const file of files) copyFileSync(join(sourceDirectory, file), join(targetDirectory, file));

const commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: engineRepository, encoding: 'utf8'}).trim();
writeFileSync(join(guideDirectory, 'guide-source.json'), `${JSON.stringify({commit, files}, null, 2)}\n`);
console.log(`Copied ${files.length} files of ${sourceDirectory} (commit ${commit.slice(0, 8)}).`);
