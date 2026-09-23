// Exhaustive analysis of the "Аким на 5 часов" decision space, per docs/case/akim-simulator-dataset-and-rules.md
const K = ['T1','T2','E1','E2','S1','S2','B1','B2','C1','C2'];
const W = [0.10,0.10,0.09,0.11,0.11,0.11,0.09,0.09,0.10,0.10];
const DN = ['Есиль','Алматы','Сарыарка','Байконур','Нура'];
const POP = [0.27,0.24,0.20,0.13,0.16];
const BASE = [
  [45,62,68,72,48,55,78,60,75,70],
  [40,75,50,55,60,65,62,52,50,60],
  [50,70,42,40,62,68,58,55,45,55],
  [52,68,55,50,58,60,52,58,55,58],
  [55,40,45,65,38,35,55,50,60,50],
];
const M = {
  M1:{dir:'T',city:false,cost:18,lag:2,eff:{T1:6,T2:9}},
  M2:{dir:'T',city:true, cost:22,lag:2,eff:{T1:4,B2:3}},
  M3:{dir:'T',city:false,cost:30,lag:4,eff:{T1:16,T2:20,E2:4}},
  M4:{dir:'E',city:false,cost:15,lag:2,eff:{E1:12,E2:3,B1:2}},
  M5:{dir:'E',city:false,cost:25,lag:3,eff:{E2:14,C1:4}},
  M6:{dir:'E',city:true, cost:20,lag:4,eff:{E1:5,E2:3}},
  M7:{dir:'S',city:false,cost:24,lag:3,eff:{S1:16}},
  M8:{dir:'S',city:false,cost:20,lag:3,eff:{S2:14}},
  M9:{dir:'S',city:false,cost:10,lag:1,eff:{S1:3,S2:3,B1:3}},
  M10:{dir:'B',city:false,cost:12,lag:1,eff:{B1:12,B2:2}},
  M11:{dir:'B',city:false,cost:10,lag:1,eff:{B2:12,T1:-2}},
  M12:{dir:'C',city:true, cost:14,lag:1,eff:{C2:5}},
  M13:{dir:'C',city:false,cost:28,lag:4,eff:{C1:18,E2:2}},
  M14:{dir:'C',city:true, cost:16,lag:1,eff:{C1:5,C2:2}},
};
const IDS = Object.keys(M);
const SYN = [['M1','M2','T1',2],['M10','M12','B1',2],['M5','M6','E2',2]];

function evaluate(plan, opts = {}) { // plan: [{id, d}] d = district index or null
  const w = opts.weights || W;
  const I = BASE.map(r => r.slice());
  const ids = new Set(plan.map(p => p.id));
  for (const p of plan) {
    const m = M[p.id]; const f = (8 - m.lag) / 8;
    const targets = m.city ? [0,1,2,3,4] : [p.d];
    for (const d of targets) for (const [k,v] of Object.entries(m.eff)) I[d][K.indexOf(k)] += v * f;
  }
  for (const [a,b,k,v] of SYN) if (ids.has(a) && ids.has(b)) {
    const pa = plan.find(p => p.id === a);
    const ds = M[a].city ? [0,1,2,3,4] : [pa.d];
    for (const d of ds) I[d][K.indexOf(k)] += v;
  }
  let ncrit = 0;
  const D = I.map(row => row.reduce((s, x, k) => { const c = Math.min(100, Math.max(0, x)); if (c < 40) ncrit++; return s + w[k] * c; }, 0));
  const Davg = D.reduce((s, x, d) => s + POP[d] * x, 0);
  const Dmin = Math.min(...D);
  return { score: 0.7 * Davg + 0.3 * Dmin - ncrit, Davg, Dmin, ncrit, D, I };
}

function valid(plan, strictOnePerDir = false) {
  if (plan.length !== 5) return 'need exactly 5';
  const cost = plan.reduce((s, p) => s + M[p.id].cost, 0);
  if (cost > 100) return 'budget';
  const dirs = {}; for (const p of plan) dirs[M[p.id].dir] = (dirs[M[p.id].dir] || 0) + 1;
  if (Object.values(dirs).some(c => c > 2)) return 'dir>2';
  if (strictOnePerDir && Object.keys(dirs).length !== 5) return 'strict: not one per direction';
  const has = id => plan.find(p => p.id === id);
  if (has('M1') && has('M3')) return 'M1xM3';
  if (has('M4') && has('M7') && has('M4').d === has('M7').d) return 'M4xM7 same district';
  if (has('M5') && has('M13') && has('M5').d === has('M13').d) return 'M5xM13 same district';
  return null;
}

// sanity checks against the case
const base = evaluate([]);
console.log('BASELINE', base.score.toFixed(5), 'Davg', base.Davg.toFixed(4), 'Dmin', base.Dmin, 'ncrit', base.ncrit);
const ex = [{id:'M7',d:4},{id:'M8',d:4},{id:'M10',d:4},{id:'M12',d:null},{id:'M5',d:2}];
const exr = evaluate(ex); console.log('EXAMPLE', exr.score.toFixed(5), 'valid:', valid(ex) ?? 'ok');

// enumerate
function* combos(arr, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i < arr.length; i++) { acc.push(arr[i]); yield* combos(arr, k, i + 1, acc); acc.pop(); }
}
function* assignments(ids) {
  const distIdx = ids.map((id, i) => M[id].city ? -1 : i).filter(i => i >= 0);
  const n = distIdx.length; const total = 5 ** n;
  for (let x = 0; x < total; x++) {
    let y = x; const plan = ids.map(id => ({ id, d: null }));
    for (const i of distIdx) { plan[i].d = y % 5; y = Math.floor(y / 5); }
    yield plan;
  }
}
const fmt = p => p.map(x => x.id + (x.d === null ? '(город)' : '(' + DN[x.d] + ')')).join(' + ');
const all = []; let comboValid = 0;
for (const c of combos(IDS, 5)) {
  const cost = c.reduce((s, id) => s + M[id].cost, 0);
  if (cost > 100) continue;
  const dirs = {}; for (const id of c) dirs[M[id].dir] = (dirs[M[id].dir] || 0) + 1;
  if (Object.values(dirs).some(v => v > 2)) continue;
  if (c.includes('M1') && c.includes('M3')) continue;
  comboValid++;
  for (const plan of assignments(c)) {
    if (valid(plan)) continue;
    const r = evaluate(plan);
    all.push({ plan, cost, score: r.score, Davg: r.Davg, Dmin: r.Dmin, ncrit: r.ncrit, strict: Object.keys(dirs).length === 5 });
  }
}
all.sort((a, b) => b.score - a.score);
console.log('\nVALID measure-combos:', comboValid, ' VALID plans (with districts):', all.length);
const scores = all.map(a => a.score);
const pct = q => scores[Math.floor((1 - q) * (scores.length - 1))];
console.log('score min', scores[scores.length-1].toFixed(3), 'p10', pct(0.1).toFixed(3), 'median', pct(0.5).toFixed(3), 'p90', pct(0.9).toFixed(3), 'p99', pct(0.99).toFixed(3), 'max', scores[0].toFixed(3));
console.log('plans scoring BELOW baseline 52.558:', all.filter(a => a.score < base.score).length);
console.log('example plan rank:', all.findIndex(a => fmt(a.plan) === fmt(ex)) + 1, 'of', all.length);

console.log('\nTOP 15 (rules as written):');
all.slice(0, 15).forEach((a, i) => console.log(`${i+1}. ${a.score.toFixed(3)} cost=${a.cost} Davg=${a.Davg.toFixed(2)} Dmin=${a.Dmin.toFixed(2)} ncrit=${a.ncrit}  ${fmt(a.plan)}`));

const strict = all.filter(a => a.strict);
console.log('\nSTRICT (one per direction) plans:', strict.length, ' best:', strict[0].score.toFixed(3), fmt(strict[0].plan), 'cost', strict[0].cost);
strict.slice(1, 5).forEach(a => console.log('   ', a.score.toFixed(3), fmt(a.plan), 'cost', a.cost));

// Pareto frontier cost vs score
console.log('\nPARETO (min cost for score):');
const byCost = [...all].sort((a, b) => a.cost - b.cost || b.score - a.score);
let best = -1e9; for (const a of byCost) if (a.score > best + 1e-9) { best = a.score; console.log(`  cost ${a.cost}: ${a.score.toFixed(3)}  ${fmt(a.plan)}`); }

// How often each measure appears in top 1% plans
const top = all.slice(0, Math.ceil(all.length * 0.01));
const freq = {}; for (const a of top) for (const p of a.plan) freq[p.id] = (freq[p.id] || 0) + 1;
console.log('\nMeasure frequency in top 1% (' + top.length + ' plans):', Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + (100 * v / top.length).toFixed(0) + '%').join(' '));
const dfreq = {}; for (const a of top) for (const p of a.plan) if (p.d !== null) dfreq[DN[p.d]] = (dfreq[DN[p.d]] || 0) + 1;
console.log('District targeting in top 1%:', JSON.stringify(dfreq));

// Distinct top-level strategies: best plan per unique measure set
const seen = new Set(); const uniq = [];
for (const a of all) { const key = a.plan.map(p => p.id).sort().join(','); if (!seen.has(key)) { seen.add(key); uniq.push(a); } if (uniq.length >= 10) break; }
console.log('\nBEST 10 distinct measure-sets:'); uniq.forEach(a => console.log('  ', a.score.toFixed(3), 'cost', a.cost, fmt(a.plan)));

// Shapley attribution for the optimum and the example
function shapley(plan) {
  const n = plan.length; const fact = [1,1,2,6,24,120]; const phi = Array(n).fill(0);
  const val = mask => evaluate(plan.filter((_, i) => mask & (1 << i))).score;
  for (let mask = 0; mask < (1 << n); mask++) for (let i = 0; i < n; i++) if (!(mask & (1 << i))) {
    const s = [...Array(n).keys()].filter(j => mask & (1 << j)).length;
    phi[i] += fact[s] * fact[n - s - 1] / fact[n] * (val(mask | (1 << i)) - val(mask));
  }
  return plan.map((p, i) => `${p.id}${p.d === null ? '' : '@' + DN[p.d]}: ${phi[i] >= 0 ? '+' : ''}${phi[i].toFixed(3)}`).join(', ');
}
console.log('\nSHAPLEY optimum:', shapley(all[0].plan));
console.log('SHAPLEY example:', shapley(ex));

// Weight/values sensitivity: best plan if you only care about average (no fairness), or only about fairness
function bestUnder(fn) { let b = null, bs = -1e9; for (const a of all) { const r = evaluate(a.plan); const s = fn(r); if (s > bs) { bs = s; b = a; } } return [bs, b]; }
let [s1, b1] = bestUnder(r => r.Davg); console.log('\nBest for pure population-average D_avg:', s1.toFixed(3), fmt(b1.plan));
let [s2, b2] = bestUnder(r => r.Dmin); console.log('Best for pure fairness min(D):', s2.toFixed(3), fmt(b2.plan));

// Marginal value of a budget reserve: best plan by cost bucket
console.log('\nBEST SCORE BY BUDGET CAP:');
for (const cap of [61, 70, 75, 80, 85, 90, 95, 100]) { const b = all.find(a => a.cost <= cap); console.log(`  cap ${cap}: ${b.score.toFixed(3)} (cost ${b.cost}) ${fmt(b.plan)}`); }

// Extra facts
const exScore = exr.score;
console.log('\nEXAMPLE percentile: better than', (100 * all.filter(a => a.score < exScore).length / all.length).toFixed(2) + '% of valid plans; normalized potential =', (100*(exScore-base.score)/(all[0].score-base.score)).toFixed(1)+'%');
const worst = all.slice(-5); console.log('WORST plans:'); worst.forEach(a => console.log('  ', a.score.toFixed(3), 'ncrit', a.ncrit, fmt(a.plan)));
const trap = evaluate([{id:'M11',d:1}]); console.log('Single M11@Алматы => ncrit', trap.ncrit, 'score', trap.score.toFixed(3), '(T1 Алматы', trap.I[1][0], ')');
// Best plan that does NOT touch Нура at all (to show fairness lever)
const noNura = all.find(a => a.plan.every(p => p.d !== 4)); console.log('Best plan avoiding Нура:', noNura.score.toFixed(3), fmt(noNura.plan));
// Effect-per-cost of each measure alone (best district)
console.log('\nSOLO value of each measure (best district), score gain per 10 units:');
for (const id of IDS) { let b=-1e9, bd=null; for (const d of (M[id].city?[null]:[0,1,2,3,4])) { const s = evaluate([{id,d}]).score; if (s>b){b=s;bd=d;} } console.log(`  ${id} cost ${M[id].cost}: +${(b-base.score).toFixed(3)} @${bd===null?'город':DN[bd]}  -> ${(10*(b-base.score)/M[id].cost).toFixed(3)}/10u`); }
// Time-average interpretation check: lag fraction == share of 8 quarters active
console.log('\nLag factor (8-L)/8 == share of the 8 quarters during which measure is active: L=1 ->', 7/8, 'L=4 ->', 4/8);
