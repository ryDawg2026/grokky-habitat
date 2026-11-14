// The Lab's sandboxed, deterministic simulation library and the action-tag parser.
// There is NO eval and no code from the minds is ever run: an experiment is only {kind, numbers, a few whitelisted words};
// every number is clamped, and the same spec always gives the same result (seeded PRNG).
export const KINDS = ['random_walk', 'cellular_automaton', 'predator_prey', 'prisoners_dilemma', 'number_pattern', 'logistic_map'];
const STRATS = ['tit_for_tat', 'always_defect', 'always_cooperate', 'grudger', 'random', 'pavlov', 'suspicious_tit_for_tat'];
const PATTERNS = ['collatz', 'primes', 'fibonacci_mod', 'digit_sum', 'squares_mod'];
export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const num = (v, d, lo, hi) => { v = Number(v); if (!isFinite(v)) v = d; return Math.min(hi, Math.max(lo, v)); };
const int = (v, d, lo, hi) => Math.round(num(v, d, lo, hi));
const r3 = (x) => Math.round(x * 1000) / 1000;
const sample = (arr, n) => { if (arr.length <= n) return arr.map(r3); const out = []; for (let i = 0; i < n; i++) out.push(r3(arr[Math.round(i * (arr.length - 1) / (n - 1))])); return out; };
const pickList = (v, allowed, dflt, min, max) => { let l = (Array.isArray(v) ? v : []).map(x => String(x).toLowerCase()).filter(x => allowed.includes(x)); l = [...new Set(l)]; if (l.length < min) l = dflt.slice(); return l.slice(0, max); };

const SIM = {
  random_walk(p, rand) {
    const walkers = int(p.walkers, 12, 1, 20), steps = int(p.steps, 400, 10, 2000), dims = int(p.dims, 2, 1, 2);
    const pos = Array.from({ length: walkers }, () => [0, 0]), rms = [0];
    for (let s = 1; s <= steps; s++) {
      let sum = 0;
      for (const w of pos) { if (dims === 1) w[0] += rand() < 0.5 ? -1 : 1; else { const d = Math.floor(rand() * 4); if (d === 0) w[0]++; else if (d === 1) w[0]--; else if (d === 2) w[1]++; else w[1]--; } sum += w[0] * w[0] + w[1] * w[1]; }
      rms.push(Math.sqrt(sum / walkers));
    }
    const end = rms[rms.length - 1], theory = Math.sqrt(steps);
    return { params: { walkers, steps, dims }, series: { 'typical distance from start': sample(rms, 48) }, stats: { final: r3(end), expected: r3(theory) },
      summary: `${walkers} walkers each took ${steps} random steps in ${dims}D. Their typical distance from the start ended at ${r3(end)}; plain theory (the square root of the steps) predicts about ${r3(theory)}.` };
  },
  cellular_automaton(p, rand) {
    const rule = int(p.rule, 30, 0, 255), width = int(p.width, 61, 11, 81), steps = int(p.steps, 40, 5, 60);
    let row = new Array(width).fill(0); row[Math.floor(width / 2)] = 1; const grid = [row.join('')], dens = [1 / width], seen = new Map(); seen.set(grid[0], 0);
    let period = 0;
    for (let s = 1; s <= steps; s++) {
      const nx = row.map((_, i) => { const l = row[(i - 1 + width) % width], c = row[i], r = row[(i + 1) % width]; return (rule >> (l * 4 + c * 2 + r)) & 1; });
      row = nx; const key = row.join(''); grid.push(key); dens.push(row.reduce((a, b) => a + b, 0) / width);
      if (!period && seen.has(key)) period = s - seen.get(key); seen.set(key, s);
    }
    const last = dens[dens.length - 1];
    return { params: { rule, width, steps }, series: { 'share of live cells': sample(dens, 48) }, grid, stats: { finalDensity: r3(last), repeatPeriod: period || null },
      summary: `Rule ${rule} on a ring of ${width} cells for ${steps} steps, starting from one live cell. ${period ? `The pattern fell into a repeat every ${period} steps` : 'No repeat appeared in that time'}, and ${Math.round(last * 100)}% of cells were alive at the end.` };
  },
  predator_prey(p) {
    let prey = num(p.prey, 100, 2, 800), pred = num(p.predators, 20, 1, 300);
    const birth = num(p.birth, 0.1, 0.01, 1), eat = num(p.eat, 0.005, 0.0005, 0.1), conv = num(p.convert, 0.002, 0.0005, 0.1), die = num(p.death, 0.1, 0.01, 1), steps = int(p.steps, 300, 20, 600), dt = 0.5;
    const a = [prey], b = [pred];
    for (let s = 0; s < steps; s++) {
      const dPrey = (birth * prey - eat * prey * pred) * dt, dPred = (conv * prey * pred - die * pred) * dt;
      prey = Math.min(1e5, Math.max(0, prey + dPrey)); pred = Math.min(1e5, Math.max(0, pred + dPred)); a.push(prey); b.push(pred);
    }
    let peaks = 0; for (let i = 1; i < a.length - 1; i++) if (a[i] > a[i - 1] && a[i] >= a[i + 1] && a[i] > 1) peaks++;
    const extinct = pred < 0.5 ? 'predators' : prey < 0.5 ? 'prey' : null;
    return { params: { prey: a[0], predators: b[0], birth, eat, convert: conv, death: die, steps }, series: { prey: sample(a, 60), predators: sample(b, 60) }, stats: { preyPeaks: peaks, preyEnd: r3(prey), predatorsEnd: r3(pred) },
      summary: `A predator-prey world of ${a[0]} prey and ${b[0]} predators ran ${steps} steps. The prey population rose and fell ${peaks} time${peaks === 1 ? '' : 's'}; it ended at ${Math.round(prey)} prey and ${Math.round(pred)} predators${extinct ? `, with the ${extinct} nearly gone` : ''}.` };
  },
  prisoners_dilemma(p, rand) {
    const strategies = pickList(p.strategies, STRATS, ['tit_for_tat', 'always_defect', 'always_cooperate', 'grudger'], 2, 6), rounds = int(p.rounds, 100, 10, 200);
    const PAY = { CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1] };
    const move = (s, mine, theirs, i) => {
      const last = theirs[theirs.length - 1], my = mine[mine.length - 1];
      switch (s) {
        case 'always_defect': return 'D'; case 'always_cooperate': return 'C'; case 'random': return rand() < 0.5 ? 'C' : 'D';
        case 'grudger': return theirs.includes('D') ? 'D' : 'C';
        case 'pavlov': return i === 0 ? 'C' : ((my === last) ? 'C' : 'D');
        case 'suspicious_tit_for_tat': return i === 0 ? 'D' : last;
        default: return i === 0 ? 'C' : last;
      }
    };
    const score = Object.fromEntries(strategies.map(s => [s, 0]));
    for (let x = 0; x < strategies.length; x++) for (let y = x; y < strategies.length; y++) {
      const A = [], B = []; let sa = 0, sb = 0;
      for (let i = 0; i < rounds; i++) { const ma = move(strategies[x], A, B, i), mb = move(strategies[y], B, A, i); A.push(ma); B.push(mb); const [pa, pb] = PAY[ma + mb]; sa += pa; sb += pb; }
      if (x === y) score[strategies[x]] += sa; else { score[strategies[x]] += sa; score[strategies[y]] += sb; }
    }
    const order = strategies.slice().sort((u, v) => score[v] - score[u]);
    return { params: { strategies, rounds }, series: { 'total score': order.map(s => score[s]) }, labels: order, stats: { winner: order[0], scores: score },
      summary: `A round-robin of the repeated prisoner's dilemma (${rounds} rounds per pairing) between ${strategies.join(', ')}. ${order[0]} scored highest (${score[order[0]]}) and ${order[order.length - 1]} lowest (${score[order[order.length - 1]]}).` };
  },
  number_pattern(p) {
    const pattern = PATTERNS.includes(String(p.pattern).toLowerCase()) ? String(p.pattern).toLowerCase() : 'collatz', n = int(p.n, 1000, 10, 5000), m = int(p.mod, 10, 2, 50), start = int(p.start, 27, 2, 100000);
    if (pattern === 'primes') {
      const sieve = new Uint8Array(n + 1).fill(1); sieve[0] = sieve[1] = 0; for (let i = 2; i * i <= n; i++) if (sieve[i]) for (let j = i * i; j <= n; j += i) sieve[j] = 0;
      const cum = []; let c = 0; for (let i = 0; i <= n; i++) { c += sieve[i]; cum.push(c); }
      return { params: { pattern, n }, series: { 'primes up to k': sample(cum, 48) }, stats: { count: c, estimate: r3(n / Math.log(n)) }, summary: `There are ${c} primes up to ${n}. The simple estimate n/ln(n) gives about ${Math.round(n / Math.log(n))}, so primes thin out slowly as numbers grow.` };
    }
    if (pattern === 'fibonacci_mod') {
      const seq = [0, 1]; let period = 0; for (let i = 2; i < Math.min(n, 3000); i++) { seq.push((seq[i - 1] + seq[i - 2]) % m); if (!period && seq[i] === 1 && seq[i - 1] === 0) period = i - 1; }
      return { params: { pattern, n: seq.length, mod: m }, series: { [`Fibonacci mod ${m}`]: sample(seq, 60) }, stats: { period: period || null }, summary: `Fibonacci numbers taken modulo ${m}${period ? ` repeat with period ${period}` : ` did not repeat within ${seq.length} terms`}.` };
    }
    if (pattern === 'digit_sum') {
      const roots = new Array(9).fill(0); for (let i = 1; i <= n; i++) roots[(i - 1) % 9]++; const dr = (x) => 1 + ((x - 1) % 9);
      const ser = []; for (let i = 1; i <= Math.min(n, 60); i++) ser.push(dr(i * i)); return { params: { pattern, n }, series: { 'digital root of k squared': ser }, stats: { distinct: [...new Set(ser)].sort((a, b) => a - b) }, summary: `The digital roots of the first ${ser.length} square numbers only ever use the values ${[...new Set(ser)].sort((a, b) => a - b).join(', ')}.` };
    }
    if (pattern === 'squares_mod') {
      const res = new Set(); const ser = []; for (let i = 0; i < Math.min(n, 3000); i++) { res.add((i * i) % m); } for (let i = 0; i < Math.min(n, 60); i++) ser.push((i * i) % m);
      return { params: { pattern, n, mod: m }, series: { [`k squared mod ${m}`]: ser }, stats: { residues: res.size }, summary: `Squares modulo ${m} reach only ${res.size} of the ${m} possible remainders.` };
    }
    let x = start, steps = 0, peak = x; const ser = [x]; while (x !== 1 && steps < 2000) { x = x % 2 ? 3 * x + 1 : x / 2; steps++; peak = Math.max(peak, x); ser.push(x); }
    return { params: { pattern: 'collatz', start }, series: { 'Collatz value': sample(ser, 60) }, stats: { steps, peak }, summary: `Starting from ${start}, the Collatz rule (halve if even, else triple and add one) reached 1 after ${steps} steps, climbing as high as ${peak} on the way.` };
  },
  logistic_map(p) {
    const r = num(p.r, 3.7, 2.5, 4), x0 = num(p.x0, 0.2, 0.01, 0.99), steps = int(p.steps, 200, 20, 400); let x = x0; const xs = [x];
    for (let i = 0; i < steps; i++) { x = r * x * (1 - x); xs.push(x); }
    const tail = xs.slice(-60), distinct = new Set(tail.map(v => Math.round(v * 1000))).size, kind = distinct <= 1 ? 'settled to one steady value' : distinct <= 8 ? `settled into a cycle of about ${distinct} values` : 'kept wandering without settling (chaotic)';
    return { params: { r, x0, steps }, series: { x: sample(xs, 60) }, stats: { distinctLate: distinct }, summary: `The logistic map with growth rate r=${r} starting at ${x0}, run for ${steps} steps, ${kind}.` };
  }
};
// the only door into the sandbox: a spec of {kind, params}. Anything unknown is ignored; numbers are clamped.
export function runSim(spec) {
  const kind = KINDS.includes(spec && spec.kind) ? spec.kind : null; if (!kind) return null;
  const params = (spec.params && typeof spec.params === 'object') ? spec.params : {};
  const seed = hash(kind + '|' + JSON.stringify(Object.keys(params).sort().map(k => [k, params[k]])) + '|' + (spec.seed || ''));
  const out = SIM[kind](params, rng(seed)); out.kind = kind; out.seed = seed; return out;
}
// "settings" text from a tag -> params object. Lists are written with + , or /
export function parseSettings(text) {
  const p = {}; String(text || '').split(/[;\s]+/).forEach(tok => { const m = /^([a-z_0-9]{1,16})=([^=]{1,80})$/i.exec(tok); if (!m) return; const k = m[1].toLowerCase(), v = m[2];
    p[k] = /[+,/]/.test(v) ? v.split(/[+,/]/).filter(Boolean) : (isFinite(Number(v)) && v !== '' ? Number(v) : v); });
  if (p.strategies && !Array.isArray(p.strategies)) p.strategies = [p.strategies];
  return p;
}
// A message may end with lines like [[draw: a quiet pond]] . Tags are parsed out of the raw reply before anything is shown.
const TAG = /\[\[\s*(study|experiment|draw|react|browse|build|remix|interface)\s*:\s*([^\]]{1,800})\]\]/gi;
export function parseActions(raw) {
  const actions = []; const text = String(raw || '').replace(TAG, (_, t, body) => { if (actions.length < 3) actions.push({ type: t.toLowerCase(), args: body.split('|').map(x => x.trim()) }); return ' '; }).replace(/\s+/g, ' ').trim();
  return { text, actions };
}
