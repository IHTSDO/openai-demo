# SympTEMIST validation — results

Config: gpt-5-mini · Snowstorm X (International) · agent ON · translation nudge · 2026-07-26

Gold: SympTEMIST subtask-2 (Spanish clinical symptoms/signs → SNOMED CT). Code comparison via FHIR `$subsumes` against https://implementation-demo.snomedtools.org/fhir.

## Aggregate (10 docs, 57 gold annotations)

| Metric | Count | Rate (of gold) |
|---|---|---|
| **Detected** (span aligned) | 53 | 93% |
| Coded (non-∅ of detected) | 53 | 100% of detected |
| **Exact code** | 13 | 23% |
| More-general (ancestor — acceptable) | 8 | 14% |
| **Acceptable (exact + more-general)** | 21 | 37% |
| More-specific (over-specific ✗) | 4 | 7% |
| Other branch (wrong ✗) | 28 | 49% |
| ∅ code on detected (miss) | 0 | 0% |
| Not detected (span miss) | 4 | 7% |

- **Detection recall:** 93%
- **Code accuracy (exact, of detected):** 25%
- **Code accuracy (acceptable = exact + more-general, of detected):** 40%

## Per document

| Doc | Gold | Detected | Exact | +General | Over-spec | Other | ∅ |
|---|---|---|---|---|---|---|---|
| es-S0004-06142007000900013-1 | 7 | 6 | 0 | 2 | 0 | 4 | 0 |
| es-S0004-06142008000600013-1 | 7 | 7 | 1 | 1 | 1 | 4 | 0 |
| es-S0004-06142008000700015-2 | 5 | 5 | 0 | 0 | 0 | 5 | 0 |
| es-S0210-48062005000800014-1 | 5 | 5 | 2 | 0 | 0 | 3 | 0 |
| es-S0210-48062007000100004-1 | 8 | 8 | 3 | 3 | 0 | 2 | 0 |
| es-S0210-48062009000300013-5 | 5 | 4 | 2 | 0 | 2 | 0 | 0 |
| es-S0210-48062009000300013-6 | 6 | 5 | 1 | 0 | 1 | 3 | 0 |
| es-S0210-48062009000900015-3 | 4 | 4 | 0 | 0 | 0 | 4 | 0 |
| es-S0210-48062010000100019-3 | 5 | 5 | 3 | 1 | 0 | 1 | 0 |
| es-S0211-69952014000400020-1 | 5 | 4 | 1 | 1 | 0 | 2 | 0 |

## Discrepancies (not exact)

| Doc | Mention | Ours | Gold | Type |
|---|---|---|---|---|
| S0004-06142007000900013-1 | aumento del hemiescroto | (not detected) | 276331001 | miss-detect |
| S0004-06142007000900013-1 | llanto inconsolable | 304534000 "Crying" | 788918005 (EXACT) | more-general |
| S0004-06142007000900013-1 | fiebre | 386661006 "Fever" | 64882008 (EXACT) | other |
| S0004-06142007000900013-1 | hemiescroto izquierdo aumentado de tamaño, doloroso | 65124004 "Swelling" | 823012003 (EXACT) | more-general |
| S0004-06142007000900013-1 | teste derecho de características normales | 15598003 "Structure of right testis" | 300493001 (EXACT) | other |
| S0004-06142007000900013-1 | teste izquierdo se encuentra aumentado de tamaño | 93077001 "Congenital hypertrophy of testis" | 276412008 (EXACT) | other |
| S0004-06142007000900013-1 | teste derecho de tamaño y consistencia normal | 85437001 "Congenital hypoplasia of testis" | 300483008 (EXACT) | other |
| S0004-06142008000600013-1 | nódulo tiroideo | 237495005 "Thyroid nodule" | 76917005 (EXACT) | other |
| S0004-06142008000600013-1 | signos de compresión de vía aérea | 248555006 "Totally obstructed airway" | 79688008 (EXACT) | more-specific |
| S0004-06142008000600013-1 | bocio multinodular con presencia de un nódulo sólido | 237570007 "Multinodular goiter" | 76917005 (EXACT) | other |
| S0004-06142008000600013-1 | área fría | 248510004 "Iris nodule" | 129680003 (NARROW) | other |
| S0004-06142008000600013-1 | nodulo | 237495005 "Thyroid nodule" | 27925004 (EXACT) | other |
| S0004-06142008000600013-1 | imágenes ocupantes de espacio en seno piriforme izquierdo | 300848003 "Mass of body structure" | 16779801000119101 (NARROW) | more-general |
| S0004-06142008000700015-2 | induración peneana a nivel de la base | 34319007 "Induration of skin" | 33958003 (NARROW) | other |
| S0004-06142008000700015-2 | cordón longitudinal indurado en la base del pene | 34319007 "Induration of skin" | 249244000 (NARROW) | other |
| S0004-06142008000700015-2 | doloroso | 34319007 "Induration of skin" | 22253000 (EXACT) | other |
| S0004-06142008000700015-2 | Afebril | 386661006 "Fever" | 87273009 (EXACT) | other |
| S0004-06142008000700015-2 | coagulación normal | 15220000 "Laboratory test" | 165562007 (EXACT) | other |
| S0210-48062005000800014-1 | tumoración sólida | 369757002 "Solid tumor configuration" | 300848003 (NARROW) | other |
| S0210-48062005000800014-1 | tumoración | 369757002 "Solid tumor configuration" | 300848003 (EXACT) | other |
| S0210-48062005000800014-1 | tumoración | 369757002 "Solid tumor configuration" | 300848003 (EXACT) | other |
| S0210-48062007000100004-1 | vejiga hiperrefléxica | 786483005 "Neurogenic detrusor overactivity" | 5112009 (EXACT) | more-general |
| S0210-48062007000100004-1 | incontinencia urinaria total | 165232002 "Urinary incontinence" | 129853007 (EXACT) | more-general |
| S0210-48062007000100004-1 | vejiga de contorno festoneado | 249585009 "Urinary bladder finding" | 366265001 (NARROW) | more-general |
| S0210-48062007000100004-1 | reflujo pasivo derecho y activo | 197811007 "Vesicoureteric reflux" | 710779007 (NARROW) | other |
| S0210-48062007000100004-1 | reflujo activo | 197811007 "Vesicoureteric reflux" | 225587003 (EXACT) | other |
| S0210-48062009000300013-5 | dolor | 76948002 "Severe pain" | 22253000 (EXACT) | more-specific |
| S0210-48062009000300013-5 | Descenso de Hto | (not detected) | 165414004 | miss-detect |
| S0210-48062009000300013-5 | dolores | 76948002 "Severe pain" | 22253000 (EXACT) | more-specific |
| S0210-48062009000300013-6 | dolor lumboabdominal izquierdo | 162049009 "Left flank pain" | 1119218004 (EXACT) | other |
| S0210-48062009000300013-6 | retraso funcional de riñón | 81141003 "Normal renal function" | 76114004 (EXACT) | other |
| S0210-48062009000300013-6 | deficiente visualización de cálices e infundíbulos | 365853002 "Imaging finding" | 274536007 (NARROW) | other |
| S0210-48062009000300013-6 | uréter normal | 363458004 "Malignant neoplasm of ureter" | 300449001 (NARROW) | more-specific |
| S0210-48062009000300013-6 | buen estado general | (not detected) | 135815002 | miss-detect |
| S0210-48062009000900015-3 | glande hipocrómico, hipotérmico | 23006000 "Skin hypopigmented" | 249250005 (NARROW) | other |
| S0210-48062009000900015-3 | secreción purulenta transuretral | 300132001 "Ear discharge" | 9957009 (EXACT) | other |
| S0210-48062009000900015-3 | induración del tercio distal del cuerpo del pene | 34319007 "Induration of skin" | 33958003 (NARROW) | other |
| S0210-48062009000900015-3 | ausencia total de flujos al 100% del pene | 52674009 "Ischemia" | 366291000 (NARROW) | other |
| S0210-48062010000100019-3 | hematuria | 34436003 "Blood in urine" | 53298000 (EXACT) | more-general |
| S0210-48062010000100019-3 | sangrado en sábana de la pared | 74474003 "Gastrointestinal hemorrhage" | 73099002 (EXACT) | other |
| S0211-69952014000400020-1 | mala higiene personal | (not detected) | 410428008 | miss-detect |
| S0211-69952014000400020-1 | fiebre | 386661006 "Fever" | 64882008 (EXACT) | other |
| S0211-69952014000400020-1 | hemocultivos positivos a Staphylococcus (St.) aureus | 406602003 "Infection caused by Staphylococcus aureus" | 8730001000004107 (NARROW) | other |
| S0211-69952014000400020-1 | catéter, que se cultiva, creciendo AX, junto con St. aureus y Enterococcus faecalis | 40733004 "Infectious disease" | 429268001 (NARROW) | more-general |

## Comparison vs baseline (agent off, no translation nudge)

| Metric | Baseline | + nudge + agent | Δ |
|---|---|---|---|
| Detected | 50 | 53 | +3 |
| Exact | 10 | 13 | +3 |
| More-general | 6 | 8 | +2 |
| Acceptable (exact+more-general) | 16 (32%) | 21 (40%) | +5 |
| Over-specific | 2 | 4 | +2 |
| Other branch | 23 | 28 | +5 |
| ∅ (uncoded) | 9 | 0 | −9 |

Two changes: (1) `clinicalTerm` prompt now asks for the SNOMED preferred term, not a literal translation — fixed the class like `inflamación pancreática` → **Pancreatitis** (was "Anal inflammation"); (2) the auto-coding agent (on) resolved every ∅. Net: acceptable code rate 32% → 40% of detected. Trade-off: coding every detected mention also converts some should-be-∅ into wrong codes (over-specific 2→4, other 23→28).

## Caveats (still apply — the acceptable rate is a lower bound)

- `$subsumes` misses **sibling equivalents** (e.g. `fiebre` → ours "Fever" vs gold "Increased body temperature"; `hematuria` → "Blood in urine" vs "Hematuria syndrome"), so several "other" are really correct → true acceptable rate is higher.
- Gold uses the SNOMED CT **Spanish edition**; national-extension codes can't be related by the International server.
- Fixes for a trustworthy number: run `$subsumes` on a Spanish-edition server (Snowstorm MCP), and add a synonym-equivalence check.

## Residual genuine drift (Spanish)
- `secreción purulenta transuretral` → "Ear discharge" (should be urethral) — the agent didn't correct it (it was matched, not ∅, so out of the agent's ∅-only scope). A v2 that reviews low-confidence matches would catch it.
- `lesiones ampulosas en el glande` → "Lesion of eyelid" — anatomy drift on a multi-word specific phrase.
