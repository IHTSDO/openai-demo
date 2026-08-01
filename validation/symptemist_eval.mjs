#!/usr/bin/env node
// SympTEMIST validation harness — compares our pipeline output to the gold
// annotations (span alignment + subsumption-aware code comparison via FHIR
// $subsumes) and writes a results markdown.
//
// Usage: node symptemist_eval.mjs <gold.json> <ours.json> <out.md> [config-note]
//   gold.json : [{docId, text, gold:[{span_ini,span_end,text,code,sem_rel}]}]
//   ours.json : [{docId, entities:[{text, code, display, context, type}]}]
import fs from 'fs';

const FHIR = process.env.FHIR_BASE || 'https://implementation-demo.snomedtools.org/fhir';
const [goldPath, oursPath, outPath, note = ''] = process.argv.slice(2);
const gold = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
const ours = JSON.parse(fs.readFileSync(oursPath, 'utf8'));
const ourByDoc = Object.fromEntries(ours.map(d => [d.docId, d.entities || []]));

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9áéíóúñ ]/gi, ' ').replace(/\s+/g, ' ').trim();
const toks = s => new Set(norm(s).split(' ').filter(w => w.length > 2));
function overlap(a, b) { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let n = 0; for (const t of A) if (B.has(t)) n++; return n / Math.min(A.size, B.size); }

const subsCache = new Map();
async function subsumes(a, b) {
  if (!a || !b) return 'none';
  if (a === b) return 'equivalent';
  const key = a + '|' + b; if (subsCache.has(key)) return subsCache.get(key);
  try {
    const url = `${FHIR}/CodeSystem/$subsumes?system=http://snomed.info/sct&codeA=${a}&codeB=${b}`;
    const r = await fetch(url, { headers: { Accept: 'application/fhir+json' } });
    const j = await r.json();
    const p = (j.parameter || []).find(p => p.name === 'outcome');
    const out = p?.valueCode || p?.valueString || 'not-subsumed';
    subsCache.set(key, out); return out;
  } catch { return 'error'; }
}

// outcome of comparing OUR code (A) to GOLD code (B)
function classify(sub) {
  return sub === 'equivalent' ? 'exact'
    : sub === 'subsumes' ? 'more-general'      // ours is an ancestor of gold (acceptable per policy)
    : sub === 'subsumed-by' ? 'more-specific'  // ours is a descendant of gold (over-specific — dangerous)
    : 'other';                                  // different branch / not-subsumed
}

const rows = [];
const agg = { gold: 0, detected: 0, exact: 0, mg: 0, ms: 0, other: 0, empty: 0 };
const drift = [];

for (const doc of gold) {
  const entities = ourByDoc[doc.docId] || [];
  const r = { docId: doc.docId, gold: doc.gold.length, detected: 0, exact: 0, mg: 0, ms: 0, other: 0, empty: 0 };
  for (const g of doc.gold) {
    agg.gold++;
    // align: best-overlapping extracted entity
    let best = null, bestScore = 0;
    for (const e of entities) { const s = overlap(g.text, e.text); if (s > bestScore) { bestScore = s; best = e; } }
    if (!best || bestScore < 0.34) { drift.push({ doc: doc.docId, mention: g.text, ours: '(not detected)', gold: `${g.code}`, kind: 'miss-detect' }); continue; }
    r.detected++; agg.detected++;
    const ourCode = best.code || null;
    if (!ourCode) { r.empty++; agg.empty++; drift.push({ doc: doc.docId, mention: g.text, ours: '∅', gold: g.code, kind: 'miss-code' }); continue; }
    const sub = await subsumes(ourCode, g.code);
    const k = classify(sub);
    r[k === 'exact' ? 'exact' : k === 'more-general' ? 'mg' : k === 'more-specific' ? 'ms' : 'other']++;
    agg[k === 'exact' ? 'exact' : k === 'more-general' ? 'mg' : k === 'more-specific' ? 'ms' : 'other']++;
    if (k !== 'exact') drift.push({ doc: doc.docId, mention: g.text, ours: `${ourCode} "${best.display || ''}"`, gold: `${g.code} (${g.sem_rel})`, kind: k });
  }
  rows.push(r);
}

const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '—';
const detected = agg.detected, coded = agg.exact + agg.mg + agg.ms + agg.other;
const acceptable = agg.exact + agg.mg; // exact or safely-more-general
let md = `# SympTEMIST validation — results

${note ? note + '\n\n' : ''}Gold: SympTEMIST subtask-2 (Spanish clinical symptoms/signs → SNOMED CT). Code comparison via FHIR \`$subsumes\` against ${FHIR}.

## Aggregate (${gold.length} docs, ${agg.gold} gold annotations)

| Metric | Count | Rate (of gold) |
|---|---|---|
| **Detected** (span aligned) | ${detected} | ${pct(detected, agg.gold)} |
| Coded (non-∅ of detected) | ${coded} | ${pct(coded, detected)} of detected |
| **Exact code** | ${agg.exact} | ${pct(agg.exact, agg.gold)} |
| More-general (ancestor — acceptable) | ${agg.mg} | ${pct(agg.mg, agg.gold)} |
| **Acceptable (exact + more-general)** | ${acceptable} | ${pct(acceptable, agg.gold)} |
| More-specific (over-specific ✗) | ${agg.ms} | ${pct(agg.ms, agg.gold)} |
| Other branch (wrong ✗) | ${agg.other} | ${pct(agg.other, agg.gold)} |
| ∅ code on detected (miss) | ${agg.empty} | ${pct(agg.empty, agg.gold)} |
| Not detected (span miss) | ${agg.gold - detected} | ${pct(agg.gold - detected, agg.gold)} |

- **Detection recall:** ${pct(detected, agg.gold)}
- **Code accuracy (exact, of detected):** ${pct(agg.exact, detected)}
- **Code accuracy (acceptable = exact + more-general, of detected):** ${pct(acceptable, detected)}

## Per document

| Doc | Gold | Detected | Exact | +General | Over-spec | Other | ∅ |
|---|---|---|---|---|---|---|---|
${rows.map(r => `| ${r.docId} | ${r.gold} | ${r.detected} | ${r.exact} | ${r.mg} | ${r.ms} | ${r.other} | ${r.empty} |`).join('\n')}

## Discrepancies (not exact)

| Doc | Mention | Ours | Gold | Type |
|---|---|---|---|---|
${drift.map(d => `| ${d.doc.replace('es-', '')} | ${d.mention} | ${d.ours} | ${d.gold} | ${d.kind} |`).join('\n')}
`;

fs.writeFileSync(outPath, md);
console.log('wrote', outPath, '·', agg.gold, 'gold ·', detected, 'detected ·', agg.exact, 'exact ·', agg.mg, 'more-general ·', agg.ms, 'over-spec ·', agg.other, 'other ·', agg.empty, 'empty');
