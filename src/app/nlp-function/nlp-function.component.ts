import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TerminologyService } from '../services/terminology.service';
import { OpenaiService } from '../services/openai.service';
import { TraceCandidate } from './entity-trace.model';
import { EntityTraceDialogComponent } from '../entity-trace-dialog/entity-trace-dialog.component';

@Component({
    selector: 'app-nlp-function',
    templateUrl: './nlp-function.component.html',
    styleUrls: ['./nlp-function.component.css'],
    standalone: false
})
export class NlpFunctionComponent implements OnInit {
  @Input() apiKey: string = "";

  clinicalText = "An 80-year-old woman was admitted with pancytopenia. Five weeks earlier, nausea, vomiting, diarrhea, chills, and no fever had developed. CT revealed bilateral pelvic masses; examination of a peripheral-blood smear revealed schistocytes, anisocytosis, and a low platelet count. ";
  nlpResult = "";
  loadingNlp = false; 
  entities: any[] = [];
  displayedColumns: string[] = ['text', 'singularFsn', 'type', 'context', 'snomed', 'flow'];
  status = "";

  lateralities: any[] = [
    { code: '7771000', display: 'Left'},
    { code: '24028007', display: 'Right'},
    { code: '51440002', display: 'Bilateral'}
  ];

  severities: any[] = [
    { code: '255604002', display: 'Mild'},
    { code: '6736007', display: 'Moderate'},
    { code: '24484000', display: 'Severe'}
  ];

  constructor(private terminologyService: TerminologyService, private openaiService: OpenaiService, public dialog: MatDialog) { }

  ngOnInit(): void {
  }

  /** Open the per-entity flow diagram (works for matched and unmatched). */
  openTrace(entity: any): void {
    this.dialog.open(EntityTraceDialogComponent, {
      data: { entity },
      width: '640px',
      maxWidth: '92vw'
    });
  }

  async runNlp(): Promise<void> {
    const startTime = performance.now();
    try {
    this.status = 'Phase 1/3 · Extracting clinical entities from text…';
    this.loadingNlp = true;
    this.nlpResult = "";
    this.entities = [];
    const systemPrompt = {role: "system", content: `You are a nlp clinical entity extractor. Extract clinical terms from free text clinical notes and report back with SNOMED CT codes. The "text" field must be an exact verbatim substring copied from the input note (character-for-character, so it can be highlighted); never paraphrase or add words there. For each entity also provide its standard clinical term as used in SNOMED CT (clinicalTerm): map lay or descriptive phrasing to formal terminology and correct spelling (e.g. "low platelet count" -> "thrombocytopenia").`};
    // Strict JSON schema for Structured Outputs. In strict mode every property
    // must be listed in `required` and objects need additionalProperties:false;
    // optional fields (severity/laterality) are modelled as nullable unions.
    const schema = {
      name: "clinical_entities",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          terms: {
            type: "array",
            description: "List of clinical terms extracted from the text.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string", description: "The EXACT verbatim substring copied character-for-character from the input note (same words, same casing, same punctuation/hyphens). Must appear literally in the input so it can be highlighted. Do NOT paraphrase, normalize, add words, parentheses, or annotations here — put normalized/inferred wording in fsn and clinicalTerm instead." },
                type: { type: "string", enum: ["finding", "procedure", "medication", "morphology", "body structure"], description: "The type of clinical term" },
                context: { type: "string", enum: ["present", "absent", "unknown"], description: "Whether the term is present, absent or unknown" },
                fsn: { type: "string", description: "The fully specified name of the term. Spell out acronyms." },
                singularFsn: { type: "string", description: "The fsn, removing plurals" },
                clinicalTerm: { type: "string", description: "The standard clinical term used in SNOMED CT for this concept, mapping lay/descriptive phrasing to formal terminology and correcting spelling (e.g. 'low platelet count' -> 'thrombocytopenia', 'high blood pressure' -> 'hypertension'). If the text is already a standard clinical term, repeat it unchanged." },
                severity: { type: ["string", "null"], enum: ["mild", "moderate", "severe", null], description: "The severity contained in the term, or null if none" },
                laterality: { type: ["string", "null"], enum: ["left", "right", "bilateral", null], description: "The laterality contained in the term, or null if none" }
              },
              required: ["text", "type", "context", "fsn", "singularFsn", "clinicalTerm", "severity", "laterality"]
            }
          }
        },
        required: ["terms"]
      }
    };
    const message = `Extract clinical terms and assign SNOMED CT codes to this text: ${this.clinicalText}\n`;
    const completion = await this.openaiService.extract([systemPrompt, {role: "user", content: message}], schema, { maxCompletionTokens: 10000 });
    this.entities = completion.parsed?.terms ?? [];
    this.entities.forEach((entity: any) => {
      // Start the per-entity trace with what the LLM produced (raw type,
      // before we collapse it to a single-letter code).
      const rawType = entity.type;
      entity.matched = false;
      entity.trace = {
        term: entity.text,
        matched: false,
        steps: [{
          stage: 'extract',
          status: 'ok',
          title: 'Extracted by LLM',
          detail: `"${entity.text}" → ${rawType}, ${entity.context}`,
          data: {
            type: rawType,
            context: entity.context,
            fsn: entity.fsn,
            singularFsn: entity.singularFsn,
            severity: entity.severity ?? null,
            laterality: entity.laterality ?? null
          }
        }]
      };

      if (entity.type == "finding") {
        entity.type = "F";
      } else if (entity.type == "procedure") {
        entity.type = "P";
      } else if (entity.type == "medication") {
        entity.type = "M";
      } else if (entity.type == "morphology") {
        entity.type = "Mo";
      } else if (entity.type == "body structure") {
        entity.type = "B";
      }
      if (!entity.fsn?.length) { entity.fsn = entity.text; }
      if (!entity.singularFsn) { entity.singularFsn = entity.fsn; }
    });
    this.status = `Phase 2/3 · Found ${this.entities.length} entities — matching with SNOMED CT…`;
    await this.matchWithSnomed(this.entities);
    // Phase 3: post-process the matched entities.
    this.status = 'Phase 3/3 · Finalizing results…';
    // Keep unmatched entities too: entities the LLM detected but that could not
    // be resolved on the terminology server stay visible (dotted highlight),
    // so it is clear whether a term was missed at extraction or at matching.
    // remove duplicates with same text
    this.entities = this.entities.filter((entity: any, index: number, self: any[]) => self.findIndex((e: any) => e.text === entity.text) === index);
    const matchedCount = this.entities.filter((e: any) => e.matched).length;
    // Per-entity flow traces — inspect in devtools while we build the visual.
    console.log('Entity flow traces:', this.entities.map((e: any) => e.trace));
    this.nlpResult = JSON.stringify(this.entities, null, 2);
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    const costPart = completion.cached ? 'Using AI cache · $0.00' : `Cost: $${completion.cost}`;
    this.status = `Done in ${elapsed}s · ${matchedCount}/${this.entities.length} entities matched to SNOMED CT · ${costPart}`;
    // const functionPrompt = {role: "function", name: functionName, content: JSON.stringify(this.entities)};
    // const completion2 = await this.openaiService.completion(
    //   [
    //     systemPrompt,
    //     {role: "user", content: message},
    //     completion.data.choices[0].message,
    //     functionPrompt], 1000, 0);
    // console.log(completion2);
    } catch (err: any) {
      this.status = 'Error: ' + (err?.message || 'Could not extract entities.');
    } finally {
      this.loadingNlp = false;
    }
  }

  async asyncForEach(array: any[], callback: any) {
    for (let i = 0; i < array.length; i++) {
      await callback(array[i], i, array);
    }
  }
  
  async matchWithSnomed(entities: any[]) {
    let count = 0;
    await this.asyncForEach(entities, async (entity: any) => {
      count++;
      this.status = `Phase 2/3 · Matching with SNOMED CT (${count} of ${entities.length})…`;
      const { ecl, label } = this.terminologyService.eclForType(entity.type);
      const DISTANCE_THRESHOLD = 50;
      let bestCandidate: any = null;
      let bestDistance = Infinity;

      // Accept the top candidate of a pass when it is within the distance
      // threshold; always remember the closest candidate seen (for reporting).
      // Escalation is gated on "no accepted match yet" — NOT on "zero
      // candidates" — so junk results (returned but too far) still fall through
      // to the next, smarter pass.
      const consider = (cands: TraceCandidate[]): boolean => {
        if (!cands.length) return false;
        const top = cands[0];
        if (top.distance < bestDistance) {
          bestDistance = top.distance;
          bestCandidate = { code: top.code, display: top.display };
        }
        if (!entity.snomed && top.distance < DISTANCE_THRESHOLD) {
          entity.snomed = { code: top.code, display: top.display };
          top.chosen = true;
          return true;
        }
        return false;
      };
      const searchStatus = (cands: TraceCandidate[], accepted: boolean) =>
        accepted ? 'ok' : (cands.length ? 'warn' : 'fail');

      // Pass 1 — LITERAL search with the raw extracted text (highest precision).
      let queryTerm = entity.text;
      let candidates = await this.searchCandidates(queryTerm, entity.type);
      let accepted = consider(candidates);
      entity.trace.steps.push({
        stage: 'search',
        status: searchStatus(candidates, accepted),
        title: 'Literal search',
        detail: `${label} · literal "${queryTerm}" → ${candidates.length} candidate(s)`,
        data: { ecl, queryTerm, candidates }
      });

      // Pass 2 — NORMALIZE by *removing* modifiers (laterality/severity) and
      // parenthetical qualifiers/semantic tags, then search. Skipped when
      // there is nothing to strip.
      if (!entity.snomed) {
        const normalized = this.normalizeTerm(entity.text);
        const changed = normalized !== entity.text;
        entity.trace.steps.push({
          stage: 'normalize',
          status: changed ? 'ok' : 'warn',
          title: changed ? 'Normalized (stripped modifiers)' : 'Nothing to strip',
          detail: changed ? `"${entity.text}" → "${normalized}"` : `no modifiers to remove from "${entity.text}"`,
          data: { from: entity.text, to: normalized }
        });
        if (changed) {
          queryTerm = normalized;
          candidates = await this.searchCandidates(queryTerm, entity.type);
          accepted = consider(candidates);
          entity.trace.steps.push({
            stage: 'search',
            status: searchStatus(candidates, accepted),
            title: 'Normalized search',
            detail: `${label} · "${queryTerm}" → ${candidates.length} candidate(s)`,
            data: { ecl, queryTerm, candidates }
          });
        }
      }

      // Pass 3 — CLINICAL TERM from the extraction: the standard SNOMED-style
      // term the LLM already produced (e.g. "low platelet count" →
      // "thrombocytopenia", correcting spelling too). This is a *semantic*
      // reformulation, tried before the purely lexical fuzzy fallback. No extra
      // LLM call — it came for free with the initial extraction.
      if (!entity.snomed) {
        const clinical = (entity.clinicalTerm || '').trim();
        const usable = !!clinical
          && clinical.toLowerCase() !== queryTerm.toLowerCase()
          && clinical.toLowerCase() !== entity.text.toLowerCase();
        entity.trace.steps.push({
          stage: 'synonym',
          status: clinical ? 'ok' : 'warn',
          title: 'Clinical term (from extraction)',
          detail: clinical ? `"${entity.text}" → "${clinical}"` : `no clinical term provided`,
          data: { from: entity.text, to: clinical }
        });
        if (usable) {
          queryTerm = clinical;
          candidates = await this.searchCandidates(queryTerm, entity.type);
          accepted = consider(candidates);
          entity.trace.steps.push({
            stage: 'search',
            status: searchStatus(candidates, accepted),
            title: 'Clinical term search',
            detail: `${label} · "${queryTerm}" → ${candidates.length} candidate(s)`,
            data: { ecl, queryTerm, candidates }
          });
        }
      }

      // Pass 4 — FUZZY search (Snowstorm `~`): last resort for typos / spelling
      // variants, using the most reduced term we have.
      if (!entity.snomed) {
        candidates = await this.searchCandidates(queryTerm, entity.type, true);
        accepted = consider(candidates);
        entity.trace.steps.push({
          stage: 'search',
          status: searchStatus(candidates, accepted),
          title: 'Fuzzy search',
          detail: `${label} · fuzzy "${queryTerm}~" → ${candidates.length} candidate(s)`,
          data: { ecl, queryTerm: `${queryTerm}~`, candidates }
        });
      }

      entity.trace.steps.push({
        stage: 'score',
        status: entity.snomed ? 'ok' : (bestCandidate ? 'warn' : 'fail'),
        title: entity.snomed ? 'Candidate accepted' : (bestCandidate ? 'Candidate rejected' : 'No candidate to score'),
        detail: bestCandidate
          ? `closest "${bestCandidate.display}" · distance ${bestDistance} (threshold < ${DISTANCE_THRESHOLD})`
          : `nothing returned by the server for this term/hierarchy`,
        data: { distance: bestDistance === Infinity ? null : bestDistance, threshold: DISTANCE_THRESHOLD }
      });
      if (entity.snomed) {
        entity.matched = true;
        let ctuf = entity.snomed.code + " |" + entity.snomed.display + "|:\n";
        if (entity.type == "F" && entity.context == "absent") {
         ctuf = ctuf + `408729009 |Finding context| = 410516002 |Known absent|`;
        }
        if (entity.laterality) {
          let laterality = this.lateralities.find((l: any) => l.display.toLowerCase() == entity.laterality.toLowerCase());
          if (laterality) {
            if (!ctuf.endsWith(":\n")) {
              ctuf = ctuf + " ,\n";
            }
            ctuf = ctuf + `272741003 |Laterality| = ${laterality.code} |${laterality.display}|`;
          }
        }
        if (entity.severity) {
          let severity = this.severities.find((s: any) => s.display.toLowerCase() == entity.severity.toLowerCase());
          if (severity) {
            if (!ctuf.endsWith(":\n")) {
              ctuf = ctuf + " ,\n";
            }
            ctuf = ctuf + `246112005 |Severity| = ${severity.code} |${severity.display}|`;
          }
        }
        if (ctuf.endsWith(":\n")) {
          // remove last 2 characters of the form
          ctuf = ctuf.substring(0, ctuf.length - 2);
        }
        entity.snomed.expression = ctuf;
      } else {
        // Detected by the LLM but not resolved on the terminology server.
        entity.matched = false;
        if (!bestCandidate) {
          entity.snomed = { expression: 'No match found (server returned no candidates)' };
        } else {
          entity.snomed = { expression: `No match found (closest: "${bestCandidate.display}", distance ${bestDistance})` };
        }
      }

      entity.trace.matched = entity.matched;
      entity.trace.steps.push({
        stage: 'result',
        status: entity.matched ? 'ok' : 'fail',
        title: entity.matched ? 'Matched to SNOMED CT' : 'Unresolved',
        detail: entity.matched
          ? `${entity.snomed.code} | ${entity.snomed.display}`
          : entity.snomed.expression,
        data: entity.matched
          ? { code: entity.snomed.code, display: entity.snomed.display }
          : { reason: entity.snomed.expression }
      });
    });
  }

  /**
   * Query Snowstorm for a term and score every candidate for the trace.
   * With `fuzzy`, appends Snowstorm's `~` operator to tolerate typos/variants.
   */
  private async searchCandidates(term: string, type: string, fuzzy: boolean = false): Promise<TraceCandidate[]> {
    const filter = fuzzy ? `${term}~` : term;
    const response = await this.terminologyService.matchText(filter, type).toPromise();
    return (response?.expansion?.contains || []).map((c: any) => ({
      code: c.code,
      display: c.display,
      // Distance is measured against the clean term (without the fuzzy '~'),
      // case-insensitive so casing differences don't inflate it.
      distance: this.levenshteinDistance(term.toLowerCase(), this.removeSemtag(c.display).toLowerCase())
    }));
  }

  /**
   * Reduce a term for the fallback search: drop parenthetical qualifiers /
   * semantic tags and laterality/severity modifiers. Always *removes*, never
   * adds — the goal is a simpler, more matchable string than the literal.
   */
  private normalizeTerm(text: string): string {
    let t = (text || '').replace(/\([^)]*\)/g, ' ');                        // parentheticals & semtags
    t = t.replace(/\b(left|right|bilateral|mild|moderate|severe)\b/gi, ' '); // laterality / severity
    t = t.replace(/\s+/g, ' ').trim();
    return t || text;
  }

  removeSemtag(text: string): string {
    let index = text.lastIndexOf("(");
    if (index > 0) {
      return text.substring(0, index).trim();
    }
    return text;
  }

  levenshteinDistance(s: string, t: string): number {
    const m = s.length;
    const n = t.length;
  
    // If one of the strings is empty, the distance is the length of the other string
    if (m === 0) return n;
    if (n === 0) return m;
  
    // Create a matrix of distances
    const d: number[][] = [];
    for (let i = 0; i <= m; i++) {
      d[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
      d[0][j] = j;
    }
  
    // Calculate the distance
    for (let j = 1; j <= n; j++) {
      for (let i = 1; i <= m; i++) {
        if (s.charAt(i - 1) === t.charAt(j - 1)) {
          d[i][j] = d[i - 1][j - 1];
        } else {
          const substitutionCost = d[i - 1][j - 1] + 1;
          const insertionCost = d[i][j - 1] + 1;
          const deletionCost = d[i - 1][j] + 1;
          d[i][j] = Math.min(substitutionCost, insertionCost, deletionCost);
        }
      }
    }
  
    // Return the Levenshtein distance
    return d[m][n];
  }
  

  
}