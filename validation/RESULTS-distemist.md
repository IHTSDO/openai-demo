# SympTEMIST validation — results

Config: DisTEMIST (Spanish diseases) · gpt-5-mini · Snowstorm X · agent ON · nudge · 2026-07-26

Gold: SympTEMIST subtask-2 (Spanish clinical symptoms/signs → SNOMED CT). Code comparison via FHIR `$subsumes` against https://implementation-demo.snomedtools.org/fhir.

## Aggregate (10 docs, 56 gold annotations)

| Metric | Count | Rate (of gold) |
|---|---|---|
| **Detected** (span aligned) | 51 | 91% |
| Coded (non-∅ of detected) | 51 | 100% of detected |
| **Exact code** | 16 | 29% |
| More-general (ancestor — acceptable) | 10 | 18% |
| **Acceptable (exact + more-general)** | 26 | 46% |
| More-specific (over-specific ✗) | 6 | 11% |
| Other branch (wrong ✗) | 19 | 34% |
| ∅ code on detected (miss) | 0 | 0% |
| Not detected (span miss) | 5 | 9% |

- **Detection recall:** 91%
- **Code accuracy (exact, of detected):** 31%
- **Code accuracy (acceptable = exact + more-general, of detected):** 51%

## Per document

| Doc | Gold | Detected | Exact | +General | Over-spec | Other | ∅ |
|---|---|---|---|---|---|---|---|
| S0004-06142006000900006-1 | 5 | 5 | 0 | 0 | 0 | 5 | 0 |
| S0004-06142007000300013-1 | 5 | 3 | 1 | 0 | 0 | 2 | 0 |
| es-S0004-06142007000700014-1 | 8 | 8 | 4 | 0 | 1 | 3 | 0 |
| es-S0004-06142007000700015-1 | 8 | 7 | 1 | 2 | 3 | 1 | 0 |
| es-S0004-06142008000300015-1 | 4 | 4 | 1 | 0 | 2 | 1 | 0 |
| es-S0004-06142008000600013-1 | 5 | 4 | 2 | 1 | 0 | 1 | 0 |
| es-S0004-06142008000700015-2 | 4 | 4 | 1 | 3 | 0 | 0 | 0 |
| es-S0210-48062005000700010-1 | 4 | 4 | 1 | 0 | 0 | 3 | 0 |
| es-S0210-48062005000700013-1 | 6 | 6 | 3 | 2 | 0 | 1 | 0 |
| es-S0210-48062006000100012-1 | 7 | 6 | 2 | 2 | 0 | 2 | 0 |

## Discrepancies (not exact)

| Doc | Mention | Ours | Gold | Type |
|---|---|---|---|---|
| S0004-06142006000900006-1 | patología litiásica compleja | 95566004 "Urolithiasis" | 66058000 (NARROW) | other |
| S0004-06142006000900006-1 | litiasis renales | 95570007 "Kidney stone" | 386103008 (EXACT) | other |
| S0004-06142006000900006-1 | moderada dilatación pielocalicial y ureteral | 82608003 "Atrial dilatation" | 95576001+371011007 (COMPOSITE) | other |
| S0004-06142006000900006-1 | litiasis ureteral | 31054009 "Ureteric stone" | 386104002 (EXACT) | other |
| S0004-06142006000900006-1 | litiasis de 1 cm en polo inferior | 95570007 "Kidney stone" | 386103008 (NARROW) | other |
| S0004-06142007000300013-1 | lesión | (not detected) | 417163006 | miss-detect |
| S0004-06142007000300013-1 | traumatismo | (not detected) | 417746004 | miss-detect |
| S0004-06142007000300013-1 | enfermedades venéreas | 412690006 "Malaria serology" | 187367009 (EXACT) | other |
| S0004-06142007000300013-1 | abstinencia sexual | 710709008 "Education about sexual behavior" | 47037006 (EXACT) | other |
| S0004-06142007000700014-1 | glande, que deformaba meato, con áreas ulceradas | 417893002 "Deformity" | 33495006 (NARROW) | other |
| S0004-06142007000700014-1 | adenopatías pulmonares e inguinales | 127101005 "Pulmonary lymphadenopathy" | 127101005+127199000 (COMPOSITE) | other |
| S0004-06142007000700014-1 | neoplasia de pene | 363516004 "Malignant neoplasm of penis" | 126896003 (EXACT) | more-specific |
| S0004-06142007000700014-1 | insuficiencia renal aguda | 14669001 "Acute kidney injury" | 723189000 (EXACT) | other |
| S0004-06142007000700015-1 | quísticas parapiélicas | 441457006 "Cyst" | 253883006 (NARROW) | more-general |
| S0004-06142007000700015-1 | lesiones | 300457003 "Lesion of urinary bladder" | 157670007 (EXACT) | other |
| S0004-06142007000700015-1 | quistes | (not detected) | 441457006 | miss-detect |
| S0004-06142007000700015-1 | quiste parapiélico en riñón derecho | 441457006 "Cyst" | 722223000 (NARROW) | more-general |
| S0004-06142007000700015-1 | lesión quística | 236011003 "Retroperitoneal cyst" | 441457006 (EXACT) | more-specific |
| S0004-06142007000700015-1 | celda renal izquierda existía una lesión | 722223000 "Cyst of kidney" | 79131000119100 (NARROW) | more-specific |
| S0004-06142007000700015-1 | lesión renal | 722223000 "Cyst of kidney" | 79131000119100 (EXACT) | more-specific |
| S0004-06142008000300015-1 | cuadro inflamatorio | 301779004 "Anal inflammation" | 128139000 (EXACT) | more-specific |
| S0004-06142008000300015-1 | maldescenso testicular | 204878001 "Undescended testicle" | 249240009 (EXACT) | other |
| S0004-06142008000300015-1 | hidrocele | 32561000119105 "Adult hydrocele" | 26614003 (EXACT) | more-specific |
| S0004-06142008000600013-1 | carcinoma renal | 702391001 "Renal cell carcinoma" | 254915003 (EXACT) | more-general |
| S0004-06142008000600013-1 | imágenes ocupantes de espacio en seno piriforme izquierdo | 300848003 "Mass of body structure" | 7393007 (NARROW) | other |
| S0004-06142008000600013-1 | lesiones | (not detected) | 157670007 | miss-detect |
| S0004-06142008000700015-2 | fumador | 365981007 "Tobacco smoking behavior - finding" | 77176002 (EXACT) | more-general |
| S0004-06142008000700015-2 | trombosis segmentaria de la vena dorsal superficial del pene | 439127006 "Thrombosis" | 76598006 (NARROW) | more-general |
| S0004-06142008000700015-2 | Enfermedad de Mondor | 439127006 "Thrombosis" | 69954004 (EXACT) | more-general |
| S0210-48062005000700010-1 | varicocele | 36439007 "Excision of varicocele" | 51070004 (EXACT) | other |
| S0210-48062005000700010-1 | patología sexual | 56925008 "Abnormal sexual function" | 231532002 (EXACT) | other |
| S0210-48062005000700010-1 | duplicidad uretral incompleta | 7601009 "Double urinary meatus" | 717757004 (EXACT) | other |
| S0210-48062005000700013-1 | fístula arterio-cavernosa en la porción proximal del cuerpo cavernoso | 428794004 "Fistula" | 33958003 (NARROW) | other |
| S0210-48062005000700013-1 | fístula arteriocavernosa | 428794004 "Fistula" | 300514006 (NARROW) | more-general |
| S0210-48062005000700013-1 | priapismo arterial de alto flujo | 6273006 "Priapism" | 441545004 (EXACT) | more-general |
| S0210-48062006000100012-1 | fumador | 110483000 "Tobacco user" | 77176002 (EXACT) | more-general |
| S0210-48062006000100012-1 | quistes en ambas mamas | 41180005 "Excision of cyst of breast" | 449836005 (NARROW) | other |
| S0210-48062006000100012-1 | trombosis segmentaria de la vena dorsal superficial del pene | 439127006 "Thrombosis" | 76598006 (NARROW) | more-general |
| S0210-48062006000100012-1 | lesión | (not detected) | 417163006 | miss-detect |
| S0210-48062006000100012-1 | patología en la localización de la vena dorsal de pene | 55433007 "Entire deep dorsal vein of penis" | 76598006 (EXACT) | other |

## Headline & comparison

DisTEMIST = Spanish clinical **diseases** → SNOMED CT (BioCreative). Same harness as SympTEMIST.

| Metric | SympTEMIST (symptoms) | **DisTEMIST (diseases)** |
|---|---|---|
| Detection recall | 88% | **91%** |
| Acceptable code (exact + more-general) of detected | 40% | **51%** |
| ∅ | 0 | 0 |

Diseases map more cleanly to SNOMED than symptoms/signs, hence the higher acceptable rate. Both runs use the SNOMED-preferred-term nudge + agent on.

## Caveats (still apply — acceptable rate is a lower bound)

- `$subsumes` misses **sibling equivalents** (same concept, different code) → some "other" are really correct.
- Gold uses the SNOMED CT **Spanish edition**; national-extension codes can't be related by the International server used here.
- A trustworthy absolute number needs a Spanish-edition `$subsumes` (Snowstorm MCP) + a synonym-equivalence check.

## Residual genuine drift (Spanish, diseases)
- `sin signos inflamatorios` → "Anal inflammation" (wrong anatomy on "inflammation"); `cuadro inflamatorio` → "Anal inflammation" — the same too-broad "inflammation" landing seen before, now on disease context.
- `formación excrecente en glande` → "Lesion of eyelid" — anatomy drift on a descriptive phrase.
- Over-coding: the agent codes every detected mention (0 ∅), turning some vague phrases into specific-but-wrong codes (over-spec 6). A v2 low-confidence review would temper this.
