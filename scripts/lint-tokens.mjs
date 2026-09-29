#!/usr/bin/env node
/**
 * Validates custom property references, and that the compat shim matches its generator
 * and never grows past the legacy baseline.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const baselinePath = path.join(root, 'scripts', 'token-baseline.json');
const compatPath = path.join(srcDir, 'styles', '_cf-legacy-compat.scss');

const SCAN_EXT = new Set(['.scss', '.html', '.ts', '.css']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.angular']);

/**
 * Tokens that were already undefined before consolidation. Defining them globally changes
 * rendering of every call site (and overrides differing fallbacks), so each must be fixed
 * per feature with review — see docs/design-system/README.md "Known token gaps".
 * This list may only shrink.
 */
const ALLOW_UNDEFINED = new Set([
  '--primary-rgb',
  '--cf-brand',
  '--cf-text-muted',
  '--code-bg',
  '--danger-bg',
  '--hover-bg',
  '--cf-border',
  '--cf-border-subtle',
  '--cf-radius-md',
  '--cf-surface',
  '--cf-text',
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (SCAN_EXT.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function parseDefinedTokensFromAllSources() {
  const defined = new Set();
  const re = /--([a-zA-Z0-9-]+)\s*:/g;
  for (const file of walk(srcDir)) {
    const content = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(content)) !== null) {
      defined.add(`--${m[1]}`);
    }
  }
  return defined;
}

function collectReferences(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const refs = [];
  const varRe = /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)/g;
  const getPropRe = /getPropertyValue\(\s*['"](--[a-zA-Z0-9-]+)['"]\s*\)/g;
  let m;
  while ((m = varRe.exec(content)) !== null) {
    refs.push({ name: m[1], fallback: m[2]?.trim() ?? null, file: filePath });
  }
  while ((m = getPropRe.exec(content)) !== null) {
    refs.push({ name: m[1], fallback: null, file: filePath });
  }
  return refs;
}

if (!fs.existsSync(baselinePath)) {
  console.error('Missing scripts/token-baseline.json — run: node scripts/generate-legacy-compat.mjs');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const defined = parseDefinedTokensFromAllSources();

const baselineRootCount = Object.keys(baseline.legacyRoot ?? {}).length;

let errors = 0;

const drift = spawnSync(process.execPath, [path.join(__dirname, 'generate-legacy-compat.mjs'), '--check'], {
  stdio: 'inherit',
});
if (drift.status !== 0) {
  console.error('Run: npm run generate:legacy-compat (after editing scripts/generate-legacy-compat.mjs, never the shim).');
  errors++;
}

if (fs.existsSync(compatPath)) {
  const compatContent = fs.readFileSync(compatPath, 'utf8');
  const rootBlockMatch = compatContent.match(/^:root\s*\{([\s\S]*?)\n\}/m);
  const compatRootCount = rootBlockMatch
    ? (rootBlockMatch[1].match(/^  --[a-zA-Z0-9-]+:/gm) ?? []).length
    : 0;
  if (compatRootCount > baselineRootCount) {
    console.error(
      `Compat shim root block grew: ${compatRootCount} declarations vs baseline ${baselineRootCount}. Shrink-only rule violated.`,
    );
    errors++;
  }
}

const refs = walk(srcDir).flatMap(collectReferences);
const missing = new Map();

for (const ref of refs) {
  if (defined.has(ref.name) || ALLOW_UNDEFINED.has(ref.name)) continue;
  if (ref.fallback !== null && ref.fallback !== '(unset)') continue;
  if (!missing.has(ref.name)) {
    missing.set(ref.name, { files: new Set() });
  }
  missing.get(ref.name).files.add(path.relative(root, ref.file));
}

if (missing.size > 0) {
  console.error('Undefined custom properties with no fallback (not allowlisted):');
  for (const [name, info] of [...missing.entries()].sort()) {
    console.error(`  ${name}`);
    for (const f of [...info.files].slice(0, 3)) {
      console.error(`    - ${f}`);
    }
    if (info.files.size > 3) console.error(`    … +${info.files.size - 3} more`);
  }
  errors += missing.size;
}

if (errors === 0) {
  console.log(`lint:tokens OK — ${defined.size} defined tokens, ${refs.length} references scanned`);
  process.exit(0);
}

process.exit(1);
