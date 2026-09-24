#!/usr/bin/env node
/**
 * Generates src/styles/_cf-legacy-compat.scss from the archived legacy token cascade.
 * Merge order (later wins): color-system → variables → styles.scss inline :root → BRAND_OVERRIDES.
 *
 *   node scripts/generate-legacy-compat.mjs          write shim + baseline
 *   node scripts/generate-legacy-compat.mjs --check  exit 1 if the committed shim drifted
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const CHECK_ONLY = process.argv.includes('--check');

const SOURCE_FILES = [
  path.join(root, 'scripts', 'legacy-sources', '_color-system.scss'),
  path.join(root, 'scripts', 'legacy-sources', '_variables.scss'),
  path.join(root, 'scripts', 'legacy-sources', 'styles-inline-root.scss'),
];

/**
 * Phase 2 brand reset: legacy purple/indigo chrome remapped to --cf-* brand.
 * Every key must exist in the legacy cascade; this list may only shrink as call sites migrate.
 */
const BRAND_OVERRIDES = {
  '--border-primary': 'var(--cf-primary)',
  '--btn-primary-active': 'var(--cf-primary-active)',
  '--btn-primary-bg': 'var(--cf-primary)',
  '--btn-primary-hover': 'var(--cf-primary-hover)',
  '--input-border-focus': 'var(--cf-primary)',
  '--modal-header-bg': 'var(--cf-slate-50)',
  '--primary-color': 'var(--cf-primary)',
  '--primary-color-rgb': '37, 99, 235',
  '--primary-dark': 'var(--cf-primary-active)',
  '--primary-light': '#60a5fa',
  '--topbar-bg': '#ffffff',
};

/**
 * Spacing overrides from the legacy styles.scss (the parser skips :root nested in @media).
 * Array order is cascade order and must be preserved: at <480px both the 640px and the
 * 479px blocks match, and the 479px values must win.
 */
const MEDIA_OVERRIDES = [
  {
    query: '@media (max-width: 640px)',
    tokens: {
      '--spacing-lg': '1rem',
      '--spacing-xl': '1.5rem',
      '--spacing-2xl': '2rem',
    },
  },
  {
    query: '@media (max-width: 479px)',
    tokens: {
      '--spacing-sm': '0.375rem',
      '--spacing-md': '0.75rem',
      '--spacing-lg': '0.875rem',
      '--spacing-xl': '1.25rem',
      '--spacing-2xl': '1.5rem',
    },
  },
  {
    query: '@media (min-width: 480px) and (max-width: 767px)',
    tokens: {
      '--spacing-sm': '0.5rem',
      '--spacing-md': '0.875rem',
      '--spacing-lg': '1rem',
      '--spacing-xl': '1.5rem',
      '--spacing-2xl': '2rem',
    },
  },
];

const OUTPUT = path.join(srcDir, 'styles', '_cf-legacy-compat.scss');
const BASELINE = path.join(root, 'scripts', 'token-baseline.json');

/** @typedef {{ value: string, source: string, media?: string }} TokenEntry */

/** @type {Map<string, TokenEntry>} */
const rootTokens = new Map();
/** @type {Map<string, Map<string, TokenEntry>>} */
const mediaTokens = new Map();

function stripComments(text) {
  return text
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseCssBlocks(content, sourceLabel) {
  const cleaned = stripComments(content);
  const blockRe = /(@media[^{]+)\{([\s\S]*?)\}/g;
  let lastIndex = 0;
  let match;

  while ((match = blockRe.exec(cleaned)) !== null) {
    const before = cleaned.slice(lastIndex, match.index);
    parseRootBlocks(before, sourceLabel, null);
    const mediaQuery = match[1].trim();
    parseRootBlocks(match[2], sourceLabel, mediaQuery);
    lastIndex = blockRe.lastIndex;
  }

  parseRootBlocks(cleaned.slice(lastIndex), sourceLabel, null);
}

function parseRootBlocks(text, sourceLabel, mediaQuery) {
  const rootRe = /:root\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = rootRe.exec(text)) !== null) {
    parseDeclarations(match[1], sourceLabel, mediaQuery);
  }
}

function parseDeclarations(block, sourceLabel, mediaQuery) {
  const declRe = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = declRe.exec(block)) !== null) {
    const name = `--${match[1]}`;
    const value = match[2].trim();
    const entry = { value, source: sourceLabel, media: mediaQuery ?? undefined };

    if (mediaQuery) {
      if (!mediaTokens.has(mediaQuery)) {
        mediaTokens.set(mediaQuery, new Map());
      }
      mediaTokens.get(mediaQuery).set(name, entry);
    } else {
      rootTokens.set(name, entry);
    }
  }
}

for (const file of SOURCE_FILES) {
  if (!fs.existsSync(file)) {
    console.warn(`Skip missing ${file}`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  parseCssBlocks(content, path.relative(root, file));
}

if (mediaTokens.size > 0) {
  throw new Error('Unexpected @media :root blocks parsed from legacy sources; add them to MEDIA_OVERRIDES in cascade order.');
}

for (const block of MEDIA_OVERRIDES) {
  const map = new Map();
  for (const [name, value] of Object.entries(block.tokens)) {
    map.set(name, { value, source: 'styles.scss (media override)' });
  }
  mediaTokens.set(block.query, map);
}

const legacyRoot = Object.fromEntries([...rootTokens.entries()].map(([k, v]) => [k, v.value]));

for (const [name, value] of Object.entries(BRAND_OVERRIDES)) {
  if (!rootTokens.has(name)) {
    throw new Error(`BRAND_OVERRIDES key ${name} is not a legacy token`);
  }
  rootTokens.set(name, { value, source: 'BRAND_OVERRIDES' });
}

function formatTokenMap(map, indent) {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entry]) => `${indent}${name}: ${entry.value};`)
    .join('\n');
}

let scss = `/* ========================================================================
   LEGACY TOKEN COMPAT SHIM — GENERATED (scripts/generate-legacy-compat.mjs)
   Preserves pre-consolidation effective values, plus the Phase 2 BRAND_OVERRIDES.
   Do NOT edit by hand: npm run lint fails when this file drifts from the generator.
   @media blocks are emitted in cascade order — do not reorder.
   ======================================================================== */

:root {
${formatTokenMap(rootTokens, '  ')}
}
`;

for (const [mediaQuery, map] of mediaTokens.entries()) {
  scss += `\n${mediaQuery} {\n  :root {\n${formatTokenMap(map, '    ')}\n  }\n}\n`;
}

const baseline = {
  legacyRoot,
  brandOverrides: BRAND_OVERRIDES,
  root: Object.fromEntries([...rootTokens.entries()].map(([k, v]) => [k, v.value])),
  media: MEDIA_OVERRIDES.map((block) => ({ query: block.query, tokens: block.tokens })),
};
const baselineJson = `${JSON.stringify(baseline, null, 2)}\n`;

if (CHECK_ONLY) {
  const drift = [];
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== scss) drift.push(path.relative(root, OUTPUT));
  if (!fs.existsSync(BASELINE) || fs.readFileSync(BASELINE, 'utf8') !== baselineJson) drift.push(path.relative(root, BASELINE));
  if (drift.length) {
    console.error(`Generated token files drifted from scripts/generate-legacy-compat.mjs: ${drift.join(', ')}`);
    process.exit(1);
  }
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, scss, 'utf8');
fs.writeFileSync(BASELINE, baselineJson, 'utf8');

console.log(`Wrote ${path.relative(root, OUTPUT)} (${rootTokens.size} root tokens, ${mediaTokens.size} media blocks)`);
console.log(`Wrote ${path.relative(root, BASELINE)}`);
