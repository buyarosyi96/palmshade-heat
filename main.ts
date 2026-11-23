// Palmshade Heat - handoff entrypoint
// My job here is simple on paper but easy to get wrong in practice:
// take the playable files that sit next to this script, mirror them
// into the output folder the platform gives me, and then leave a
// dossier.json in that same folder describing exactly what was sent.
// I validate before I copy anything, because failing early with a
// readable message beats producing a half-copied output directory.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The caps below are the contract for this bounty. I keep them in one
// named place so the numbers are easy to audit against the task spec,
// instead of scattering magic numbers through the copy logic.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const SHOT_LIMIT = DOSSIER_CAPS.screenshots.max;
const SHOT_BYTE_LIMIT = DOSSIER_CAPS.screenshots.max_bytes;

const here = dirname(fileURLToPath(import.meta.url));

// Walk one folder recursively and return every regular file under it.
// Directories themselves are traversed but not returned; the caller
// only cares about files when counting and checking sizes.
function listFilesRecursively(root: string): string[] {
  const found: string[] = [];
  const pending: string[] = [root];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(full);
      } else if (entry.isFile()) {
        found.push(full);
      } else {
        throw new Error(`Unsupported entry while scanning ${root}: ${full} is not a plain file or folder`);
      }
    }
  }
  found.sort();
  return found;
}

// Screenshots live flat in their folder, so a shallow listing is
// enough there. Anything that is not a regular file is a problem
// worth surfacing rather than silently copying.
function listScreenshotFiles(folder: string): string[] {
  const names = readdirSync(folder, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of names) {
    if (!entry.isFile()) {
      throw new Error(`Screenshot entry is not a file: ${join(folder, entry.name)}`);
    }
    files.push(join(folder, entry.name));
  }
  files.sort();
  return files;
}

// Pre-flight checks. This runs before any copying so a bad bundle
// stops here and the output folder is never left in a mixed state.
// It also totals the game bytes, which the final summary reports and
// which gives a quick sanity check against a truncated copy later.
function checkBundle(gameDir: string, shotsDir: string): { gameFiles: string[]; shotFiles: string[]; gameBytes: number } {
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    throw new Error(`Missing game folder: expected a directory at ${gameDir}`);
  }
  const entryPage = join(gameDir, 'index.html');
  if (!existsSync(entryPage) || !statSync(entryPage).isFile()) {
    throw new Error(`Missing game/index.html: the game cannot start without its entry page (${entryPage})`);
  }

  const gameFiles = listFilesRecursively(gameDir);
  if (gameFiles.length === 0) {
    throw new Error('The game folder is empty, there is nothing to hand off');
  }
  const gameBytes = gameFiles.reduce((total, file) => total + statSync(file).size, 0);

  let shotFiles: string[] = [];
  if (existsSync(shotsDir)) {
    if (!statSync(shotsDir).isDirectory()) {
      throw new Error(`screenshots exists but is not a folder: ${shotsDir}`);
    }
    shotFiles = listScreenshotFiles(shotsDir);
    if (shotFiles.length > SHOT_LIMIT) {
      throw new Error(`Too many screenshots: found ${shotFiles.length}, but at most ${SHOT_LIMIT} are allowed`);
    }
    for (const shot of shotFiles) {
      const size = statSync(shot).size;
      if (size > SHOT_BYTE_LIMIT) {
        throw new Error(`Screenshot too large: ${shot} is ${size} bytes, over the ${SHOT_BYTE_LIMIT} byte limit per file`);
      }
    }
  }
  return { gameFiles, shotFiles, gameBytes };
}

function main(): void {
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR?.trim() ? process.env.MAKEFUN_OUTPUT_DIR.trim() : '/output';
  const gameSource = join(here, 'game');
  const shotsSource = join(here, 'screenshots');

  const { gameFiles, shotFiles, gameBytes } = checkBundle(gameSource, shotsSource);
  console.log(`Palmshade Heat handoff: ${gameFiles.length} game file(s) (${gameBytes} bytes), ${shotFiles.length} screenshot(s) checked`);

  mkdirSync(outputDir, { recursive: true });

  const gameTarget = join(outputDir, 'game');
  mkdirSync(gameTarget, { recursive: true });
  cpSync(gameSource, gameTarget, { recursive: true });

  // Screenshots are optional as a folder, but when they exist they
  // always get their own destination folder, even if it ends up empty.
  const shotsTarget = join(outputDir, 'screenshots');
  mkdirSync(shotsTarget, { recursive: true });
  if (existsSync(shotsSource)) {
    cpSync(shotsSource, shotsTarget, { recursive: true });
  } else {
    console.log('No screenshots folder found next to main.ts, continuing with an empty screenshots output');
  }

  const dossierPath = join(outputDir, 'dossier.json');
  const dossierBytes = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(dossierPath, dossierBytes);

  const copiedGameCount = listFilesRecursively(gameTarget).length;
  const copiedShotCount = existsSync(shotsTarget) ? listScreenshotFiles(shotsTarget).length : 0;
  if (copiedGameCount !== gameFiles.length || copiedShotCount !== shotFiles.length) {
    throw new Error(`Copy check failed: expected ${gameFiles.length} game and ${shotFiles.length} screenshot file(s), found ${copiedGameCount} and ${copiedShotCount} in ${outputDir}`);
  }
  console.log(`Done: copied ${copiedGameCount} game file(s) and ${copiedShotCount} screenshot(s) into ${outputDir}`);
  console.log(`Dossier written to ${dossierPath} (${dossierBytes.length} bytes)`);
}

main();
