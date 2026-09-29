#!/usr/bin/env node
/**
 * Stylelint ratchet: existing raw hex / rgba() / literal spacing is recorded per file and
 * rule in scripts/style-baseline.json. A file may never gain violations; new files start at 0.
 *
 *   node scripts/lint-styles-ratchet.mjs           check (fails on any increase)
 *   node scripts/lint-styles-ratchet.mjs --update  lower the baseline after a cleanup
 *                                                  (refuses to record an increase)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const baselinePath = path.join(__dirname, 'style-baseline.json');
const UPDATE = process.argv.includes('--update');

const result = await stylelint.lint({
  files: 'src/**/*.scss',
  cwd: root,
  configFile: path.join(root, '.stylelintrc.json'),
  allowEmptyInput: true,
});

/** @type {Record<string, Record<string, number>>} */
const current = {};
for (const file of result.results) {
  if (file.ignored) continue;
  const rel = path.relative(root, file.source).split(path.sep).join('/');
  for (const warning of file.warnings) {
    current[rel] ??= {};
    current[rel][warning.rule] = (current[rel][warning.rule] ?? 0) + 1;
  }
  if (file.parseErrors?.length) {
    console.error(`Parse error in ${rel}: ${file.parseErrors[0].text}`);
    process.exitCode = 1;
  }
}

const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;

const increases = [];
let decreased = 0;
if (baseline) {
  for (const [file, rules] of Object.entries(current)) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = baseline.files?.[file]?.[rule] ?? 0;
      if (count > allowed) increases.push(`  ${file}: ${rule} ${allowed} -> ${count}`);
    }
  }
  for (const [file, rules] of Object.entries(baseline.files ?? {})) {
    for (const [rule, allowed] of Object.entries(rules)) {
      if ((current[file]?.[rule] ?? 0) < allowed) decreased++;
    }
  }
}

const total = Object.values(current).reduce(
  (sum, rules) => sum + Object.values(rules).reduce((a, b) => a + b, 0),
  0,
);

if (increases.length) {
  console.error('New raw colors or literal spacing (use --cf-* tokens instead):');
  console.error(increases.join('\n'));
  console.error('Run `npx stylelint <file>` for line numbers.');
  process.exit(1);
}

if (UPDATE || !baseline) {
  const sorted = Object.fromEntries(Object.keys(current).sort().map((f) => [f, current[f]]));
  fs.writeFileSync(baselinePath, `${JSON.stringify({ total, files: sorted }, null, 2)}\n`, 'utf8');
  console.log(`lint:styles baseline written — ${total} existing violations`);
  process.exit(process.exitCode ?? 0);
}

const hint = decreased ? ` (${decreased} counts dropped — run npm run lint:styles -- --update to lock them in)` : '';
console.log(`lint:styles OK — ${total} existing violations, none added${hint}`);
