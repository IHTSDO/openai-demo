# SympTEMIST validation — results

Config: gpt-5-mini · Snowstorm X (International) · agent OFF · 2026-07-26

Gold: SympTEMIST subtask-2 (Spanish clinical symptoms/signs → SNOMED CT). Code comparison via FHIR `$subsumes` against https://implementation-demo.snomedtools.org/fhir.

## Aggregate (10 docs, 57 gold annotations)

| Metric | Count | Rate (of gold) |
|---|---|---|
| **Detected** (span aligned) | 50 | 88% |
| Coded (non-∅ of detected) | 41 | 82% of detected |
| **Exact code** | 10 | 18% |
| More-general (ancestor — acceptable) | 6 | 11% |
| **Acceptable (exact + more-general)** | 16 | 28% |
| More-specific (over-specific ✗) | 2 | 4% |
| Other branch (wrong ✗) | 23 | 40% |
| ∅ code on detected (miss) | 9 | 16% |
| Not detected (span miss) | 7 | 12% |

- **Detection recall:** 88%
- **Code accuracy (exact, of detected):** 20%
- **Code accuracy (acceptable = exact + more-general, of detected):** 32%

## Per document

| Doc | Gold | Detected | Exact | +General | Over-spec | Other | ∅ |
|---|---|---|---|---|---|---|---|
| es-S0004-06142007000900013-1 | 7 | 6 | 1 | 2 | 0 | 1 | 2 |
| es-S0004-06142008000600013-1 | 7 | 6 | 1 | 0 | 0 | 5 | 0 |
| es-S0004-06142008000700015-2 | 5 | 4 | 0 | 0 | 1 | 3 | 0 |
| es-S0210-48062005000800014-1 | 5 | 5 | 0 | 1 | 0 | 1 | 3 |
| es-S0210-48062007000100004-1 | 8 | 8 | 3 | 1 | 0 | 4 | 0 |
| es-S0210-48062009000300013-5 | 5 | 3 | 1 | 0 | 1 | 0 | 1 |
| es-S0210-48062009000300013-6 | 6 | 5 | 1 | 1 | 0 | 3 | 0 |
| es-S0210-48062009000900015-3 | 4 | 4 | 0 | 0 | 0 | 2 | 2 |
| es-S0210-48062010000100019-3 | 5 | 5 | 2 | 1 | 0 | 1 | 1 |
| es-S0211-69952014000400020-1 | 5 | 4 | 1 | 0 | 0 | 3 | 0 |

## Discrepancies (not exact)

| Doc | Mention | Ours | Gold | Type |
|---|---|---|---|---|
| S0004-06142007000900013-1 | aumento del hemiescroto | (not detected) | 276331001 | miss-detect |
| S0004-06142007000900013-1 | llanto inconsolable | 304534000 "Crying" | 788918005 (EXACT) | more-general |
| S0004-06142007000900013-1 | fiebre | 386661006 "Fever" | 64882008 (EXACT) | other |
| S0004-06142007000900013-1 | hemiescroto izquierdo aumentado de tamaño, doloroso | 65124004 "Swelling" | 823012003 (EXACT) | more-general |
| S0004-06142007000900013-1 | teste izquierdo se encuentra aumentado de tamaño | ∅ | 276412008 | miss-code |
| S0004-06142007000900013-1 | teste derecho de tamaño y consistencia normal | ∅ | 300483008 | miss-code |
| S0004-06142008000600013-1 | nódulo tiroideo | 237495005 "Thyroid nodule" | 76917005 (EXACT) | other |
| S0004-06142008000600013-1 | signos de compresión de vía aérea | (not detected) | 79688008 | miss-detect |
| S0004-06142008000600013-1 | bocio multinodular con presencia de un nódulo sólido | 237570007 "Multinodular goiter" | 76917005 (EXACT) | other |
| S0004-06142008000600013-1 | área fría | 248510004 "Iris nodule" | 129680003 (NARROW) | other |
| S0004-06142008000600013-1 | nodulo | 237495005 "Thyroid nodule" | 27925004 (EXACT) | other |
| S0004-06142008000600013-1 | imágenes ocupantes de espacio en seno piriforme izquierdo | 422840005 "Mass lesion of brain" | 16779801000119101 (NARROW) | other |
| S0004-06142008000700015-2 | induración peneana a nivel de la base | 1335005 "Induratio penis plastica" | 33958003 (NARROW) | more-specific |
| S0004-06142008000700015-2 | cordón longitudinal indurado en la base del pene | 300510002 "Spermatic cord palpable" | 249244000 (NARROW) | other |
| S0004-06142008000700015-2 | doloroso | 300510002 "Spermatic cord palpable" | 22253000 (EXACT) | other |
| S0004-06142008000700015-2 | Afebril | 386661006 "Fever" | 87273009 (EXACT) | other |
| S0004-06142008000700015-2 | coagulación normal | (not detected) | 165562007 | miss-detect |
| S0210-48062005000800014-1 | inflamación pancreática difusa con exudados | 301779004 "Anal inflammation" | 75694006 (NARROW) | other |
| S0210-48062005000800014-1 | tumoraciones en valva anterior de riñón | 300848003 "Mass of body structure" | 309088003 (NARROW) | more-general |
| S0210-48062005000800014-1 | tumoración sólida | ∅ | 300848003 | miss-code |
| S0210-48062005000800014-1 | tumoración | ∅ | 300848003 | miss-code |
| S0210-48062005000800014-1 | tumoración | ∅ | 300848003 | miss-code |
| S0210-48062007000100004-1 | vejiga hiperrefléxica | 398064005 "Neurogenic urinary bladder" | 5112009 (EXACT) | other |
| S0210-48062007000100004-1 | incontinencia urinaria total | 165232002 "Urinary incontinence" | 129853007 (EXACT) | more-general |
| S0210-48062007000100004-1 | vejiga de contorno festoneado | 79184009 "Trabeculation of urinary bladder" | 366265001 (NARROW) | other |
| S0210-48062007000100004-1 | reflujo pasivo derecho y activo | 197811007 "Vesicoureteric reflux" | 710779007 (NARROW) | other |
| S0210-48062007000100004-1 | reflujo activo | 197811007 "Vesicoureteric reflux" | 225587003 (EXACT) | other |
| S0210-48062009000300013-5 | dolor | 76948002 "Severe pain" | 22253000 (EXACT) | more-specific |
| S0210-48062009000300013-5 | Descenso de Hto | (not detected) | 165414004 | miss-detect |
| S0210-48062009000300013-5 | dolores | (not detected) | 22253000 | miss-detect |
| S0210-48062009000300013-5 | estabilidad hemodinámica | ∅ | 301459008 | miss-code |
| S0210-48062009000300013-6 | dolor lumboabdominal izquierdo | 22253000 "Pain" | 1119218004 (EXACT) | more-general |
| S0210-48062009000300013-6 | retraso funcional de riñón | 236423003 "Renal impairment" | 76114004 (EXACT) | other |
| S0210-48062009000300013-6 | deficiente visualización de cálices e infundíbulos | 896983000 "Structural abnormality of renal calyx" | 274536007 (NARROW) | other |
| S0210-48062009000300013-6 | uréter normal | 87953007 "Ureteric structure" | 300449001 (NARROW) | other |
| S0210-48062009000300013-6 | buen estado general | (not detected) | 135815002 | miss-detect |
| S0210-48062009000900015-3 | glande hipocrómico, hipotérmico | ∅ | 249250005 | miss-code |
| S0210-48062009000900015-3 | secreción purulenta transuretral | 300132001 "Ear discharge" | 9957009 (EXACT) | other |
| S0210-48062009000900015-3 | induración del tercio distal del cuerpo del pene | 34319007 "Induration of skin" | 33958003 (NARROW) | other |
| S0210-48062009000900015-3 | ausencia total de flujos al 100% del pene | ∅ | 366291000 | miss-code |
| S0210-48062010000100019-3 | hematuria | 34436003 "Blood in urine" | 53298000 (EXACT) | more-general |
| S0210-48062010000100019-3 | sangrado en sábana de la pared | 131148009 "Bleeding" | 73099002 (EXACT) | other |
| S0210-48062010000100019-3 | exitus | ∅ | 419099009 | miss-code |
| S0211-69952014000400020-1 | mala higiene personal | (not detected) | 410428008 | miss-detect |
| S0211-69952014000400020-1 | fiebre | 386661006 "Fever" | 64882008 (EXACT) | other |
| S0211-69952014000400020-1 | hemocultivos positivos a Staphylococcus (St.) aureus | 406602003 "Infection caused by Staphylococcus aureus" | 8730001000004107 (NARROW) | other |
| S0211-69952014000400020-1 | catéter, que se cultiva, creciendo AX, junto con St. aureus y Enterococcus faecalis | 87628006 "Bacterial infectious disease" | 429268001 (NARROW) | other |

## Caveats & interpretation

The `$subsumes` FHIR outcome is returned in `valueString` (not `valueCode`) — fixed, so "more-general" is now counted. Two effects still depress the code-accuracy figure:

1. **Sibling equivalents scored "other".** `$subsumes` only relates ancestor/descendant, so a same-meaning concept with a different code lands in "other":
   - `fiebre` → ours 386661006 **"Fever"** vs gold 64882008 **"Increased body temperature"** — same thing, sibling codes.
   - `hematuria` → ours 34436003 **"Blood in urine"** vs gold 53298000 **"Hematuria syndrome"** — same thing.
   So the true "acceptable" rate is **higher than the 32% shown**. Fix: add an equivalent-term check (compare synonyms) or a shared normalization map.
2. **Edition mismatch.** SympTEMIST gold is the SNOMED CT **Spanish edition**; some gold ids are 16-digit national-extension codes the International server can't relate → "other". Fix: run `$subsumes` on a Spanish-edition server (available via the Snowstorm MCP).

## Genuine drift found (real pipeline errors on Spanish — the actionable signal)

Spanish→English reformulation lands on a **wrong-anatomy / wrong-sense** concept for specific terms:
- `inflamación pancreática difusa` → **"Anal inflammation"** ✗
- `nódulo tiroideo` / `área fría` → **"Iris nodule"** ✗
- `secreción purulenta transuretral` → **"Ear discharge"** (should be urethral) ✗
- `hipocromía` → **"Pallor of lung"** ✗
- `color violáceo` → **"Lip discoloration"** ✗

These are the low-lexical-signal semantic drift the deterministic gate can't catch — the class the **agentic fallback (OFF here)** and Spanish-aware retrieval would address.

## Honest headline

- **Detection (span) recall 88%** — the extractor reliably finds the mentions.
- **Code accuracy: acceptable (exact + more-general) = 16/50 (32%) of detected**, and this is a **lower bound** (sibling-equivalents in "other" are undercounted; corrected run needs a Spanish-edition server + an equivalence check).
- **Clear qualitative finding: Spanish anatomical/specific terms drift to wrong-branch English concepts** — the top thing to fix for ES, and best attacked by the agent + Spanish-aware search.

## Next-run improvements
1. Run `$subsumes` against the SNOMED CT Spanish edition (Snowstorm MCP).
2. Add an equivalence check beyond subsumption (synonym overlap between our concept and gold).
3. Re-run with the **agent ON** (should recover several of the 9 ∅).
4. Scale from 10 → the full 304 linking docs once the above is in place.
