// Token Radar's entrypoint (Node 22, standard library only), radar-2.
//
// The run is four stages, in order. First the program finds the sealed snapshot —
// /input/snapshot.json in the grader's container, or --input <file|directory> anywhere else —
// and scores every pre-token protocol with the model in lib/model.ts. Then it writes the
// ranked board to /output/board.json and the dashboard's dataset beside the page. Then it
// copies this repository's dashboard/ and screenshots/ into /output. Last it writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Radar-2 improves on the starter in three places. It applies the watchlist's own exclusion
// rules (wrapped, staked and bridged products, versioned names, exchanges) to every row, not
// just to the watchlist. It scores with a category multiple, an inverted-U maturity curve and
// a multi-chain breadth multiplier. And every farm plan has seven steps, the second a
// different qualifying action from the first, so one wallet shows two distinct entries.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html,
// dashboard/app.css and dashboard/app.js read /output/data.js, which this program writes
// from the same board. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  boardIssue,
  buildRadar,
  dataScript,
  parseSnapshot,
} from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

// The folder this file lives in: dashboard/ and screenshots/ are copied from beside it.
const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/**
 * One named flag out of the arguments: `--name value` wins, then `--name=value`,
 * then the fallback. Unknown flags are ignored, so the grader's own flags pass
 * through untouched.
 */
function flagValue(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

/** The snapshot file for an --input that names a file or a directory holding one. */
function snapshotPathFor(inputArg: string): string {
  return inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
}

/** The output directory: --output wins, then the environment, then the container's /output. */
function outputDirFor(): string {
  return flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
}

/** Fail with the same usage hint the starter gave when the snapshot is not where it should be. */
function requireSnapshot(inputFile: string): void {
  if (existsSync(inputFile)) return;
  process.stderr.write(
    `token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`,
  );
  process.exit(2);
}

const inputFile = snapshotPathFor(flagValue('input', '/input'));
requireSnapshot(inputFile);
const out = outputDirFor();

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/**
 * Copy one directory's regular files into `to`, skipping names that start with a dot,
 * and report the names that landed. A missing source copies nothing and reports nothing.
 */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

/**
 * Refuse a screenshots/ set the gate will not take: fewer than three images, or a name
 * outside the letters, digits and . _ - rule. Same messages, same exits as before.
 */
function checkScreenshots(names: string[]): void {
  if (names.length < 3) {
    process.stderr.write(
      `token radar: screenshots/ holds ${names.length} image${names.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`,
    );
    process.exit(1);
  }
  for (const name of names) {
    if (!IMAGE_NAME.test(name)) {
      process.stderr.write(
        `token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`,
      );
      process.exit(1);
    }
  }
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
checkScreenshots(shots);

/** The dossier's own caps, in one place: the text cap, the screenshot caps, the dashboard caps. */
const DOSSIER_OPTIONS = {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: SCREENSHOT_CAPS,
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
};

/** Write the dossier last: the scorer rebuilds it from this /output and compares bytes. */
function writeDossier(outDir: string): void {
  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, DOSSIER_OPTIONS));
}

writeDossier(out);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.excluded_early} early excluded, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (3 files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
