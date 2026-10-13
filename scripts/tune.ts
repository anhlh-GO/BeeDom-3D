// Fit every level to the difficulty curve (CURVE in src/levels.ts): search seed, hive count, order spread
// and (hard / super) where the tense finish starts, until a careless bot wins at the target rate and, on
// hard levels, its losses come late (around 80–85% of the screws out: smooth start, tense finish).
//   node scripts/tune.ts            report only
//   node scripts/tune.ts --write    write src/tuned.ts
//   node scripts/tune.ts --range=5-9
import { writeFileSync } from 'node:fs';
import { CURVE, HIVES, LEVELS, generate } from '../src/levels.ts';
import { TUNED } from '../src/tuned.ts';
import { botRun, casualPolicy } from '../src/sim.ts';

const RUNS = 50;
const LOSS_AT = 0.82;
const args = process.argv.slice(2);
const range = args.find((a) => a.startsWith('--range='))?.slice(8).split('-').map(Number) ?? [1, LEVELS.length];
const out = [...TUNED];

for (let i = range[0] - 1; i < range[1]; i++) {
  const base = LEVELS[i];
  const target = CURVE[i];
  const tense = base.diff === 'hard' || base.diff === 'super';
  const h0 = HIVES[base.diff];
  let best = { seed: 1, hives: h0, mix: base.mix, late: 0.65, rate: -1, loss: 0, d: 9, screws: 0 };
  search: for (const dh of base.diff === 'easy' ? [0, -3, -6, 3] : [0, 3, -3, 5]) {
    for (const mix of tense ? [0.7, 1.0] : [base.mix, base.mix + 0.25]) {
      for (const late of tense ? [0.85, 0.88, 0.8] : [1]) {
        for (let seed = 1; seed <= 18; seed++) {
          const def = { ...base, hives: h0 + dh, mix, late, seed };
          let spec;
          try { spec = generate(i, def, seed); } catch { continue; }
          let w = 0;
          const losses: number[] = [];
          for (let k = 0; k < RUNS; k++) {
            const p = botRun(spec, casualPolicy, k * 7919 + 1);
            if (p >= 1) w++; else losses.push(p);
          }
          const rate = w / RUNS;
          const loss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 1;
          let d = Math.abs(rate - target);
          // the late loss matters more than hitting the win rate exactly
          if (tense && losses.length >= 3) d += Math.max(0, Math.abs(loss - LOSS_AT) - 0.03) * 3;
          if (d < best.d) best = { seed, hives: h0 + dh, mix, late, rate, loss, d, screws: spec.screws.length };
          if (d <= 0.04) break search;
        }
      }
    }
  }
  out[i] = { seed: best.seed, hives: best.hives, mix: +best.mix.toFixed(2), ...(tense ? { late: best.late } : {}) };
  console.log(`L${i + 1} ${base.name.padEnd(12)} ${base.diff.padEnd(6)} target=${Math.round(target * 100)}% win=${Math.round(best.rate * 100)}%${tense ? ` lossAt=${Math.round(best.loss * 100)}%` : ''} seed=${best.seed} hives=${best.hives} mix=${best.mix.toFixed(2)}${tense ? ` late=${best.late}` : ''} screws=${best.screws}`);
}

if (args.includes('--write')) {
  const body = out.map((t) => (t ? `  { seed: ${t.seed}, hives: ${t.hives}, mix: ${t.mix}${t.late ? `, late: ${t.late}` : ''} },` : '  null,')).join('\n');
  writeFileSync(new URL('../src/tuned.ts', import.meta.url),
    `// Written by \`node scripts/tune.ts --write\`: per level seed, hive count, order spread, tense-finish start.\nexport const TUNED: ({ seed: number; hives: number; mix: number; late?: number } | null)[] = [\n${body}\n];\n`);
  console.log('written');
}
