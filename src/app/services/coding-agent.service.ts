import { Injectable } from '@angular/core';
import { OpenaiService } from './openai.service';
import { TerminologyService } from './terminology.service';

/** Decision the agent returns for one mention. */
export interface AgentDecision {
  code: string | null;
  display: string | null;
  rungReached?: number;
  confidence?: 'high' | 'medium' | 'low';
  rationale?: string;
  cost?: string;
  iterations?: number;
  toolTrace?: any[];
}

/**
 * Agentic fallback coder. For a single unresolved entity it drives the SNOMED CT
 * search itself — searching, judging semantic similarity, choosing a candidate,
 * rewording the term, or walking up the ECL ancestor hierarchy — via inline
 * function-calling over two tools (expand / lookup) backed by TerminologyService.
 * No MCP, no separate server: the loop runs in OpenaiService.chatWithTools.
 *
 * It follows the monotonic generalization ladder (search equivalent-first, then
 * progressively more general, never more specific), the same policy documented in
 * skills/snomed-coder/SKILL.md and docs/coding-agent-design.md.
 */
@Injectable({ providedIn: 'root' })
export class CodingAgentService {
  constructor(private openai: OpenaiService, private terminology: TerminologyService) {}

  private readonly tools = [
    {
      type: 'function',
      function: {
        name: 'expand',
        description: 'Search SNOMED CT via ValueSet/$expand within an ECL constraint. '
          + 'Returns concepts {rank, code, display} in the server\'s relevance order. '
          + 'Pass the type root ECL (given to you) plus a `filter` term; OR pass "> <conceptId>" '
          + '(no filter) to list a concept\'s ANCESTORS (to generalize); OR "< <conceptId>" with a '
          + '`filter` of the original mention to list DESCENDANTS (to find a more precise match).',
        parameters: {
          type: 'object',
          properties: {
            ecl: { type: 'string', description: 'ECL constraint, e.g. "<< 404684003", "> 38341003" (ancestors), or "< 38341003" (descendants).' },
            filter: { type: 'string', description: 'Free-text term to search for.' },
            count: { type: 'integer', description: 'Max concepts (default 12).' }
          },
          required: ['ecl']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'lookup',
        description: 'Look up a SNOMED CT concept by code; returns its terms/synonyms so you can '
          + 'confirm a differently-worded concept is equivalent (e.g. that "Eruption" carries "Rash").',
        parameters: {
          type: 'object',
          properties: { code: { type: 'string', description: 'SNOMED CT concept id.' } },
          required: ['code']
        }
      }
    }
  ];

  private readonly policy = `You are a clinical coder. Bind ONE clinical mention to a SNOMED CT concept using the expand and lookup tools. The code feeds analytics and clinical decision support, so a wrong code is worse than no code.

GOLDEN RULE (subsumption): code a concept EQUIVALENT to the mention or MORE GENERAL, NEVER one that is MORE SPECIFIC (that would invent an unstated site, cause, severity, subtype, or larger syndrome).

STRATEGY — climb for recall, then descend for precision. Judge specificity against the ORIGINAL mention (the full text), NOT the reworded/simplified term. The IDEAL code is EQUIVALENT to the original mention; accept a more-general one only if no equivalent exists.
1. Rung 0 — same meaning: reword the mention to its standard clinical term (fix spelling, expand abbreviations, brand→ingredient, US→international, lay→clinical, e.g. "low platelet count"→"thrombocytopenia", "Plavix"→"clopidogrel"). Call expand(ecl=<the type root you were given>, filter=<reworded term>).
2. Rung 1 — if nothing faithful, drop ONE qualifier (laterality/severity/site/cause) and search again; if still nothing, generalize further, or use expand(ecl="> <seedId>") to walk ANCESTORS and pick the most specific ancestor still faithful.
3. DESCEND for precision — when your best hit so far is MORE GENERAL than the original mention (you reached it by generalizing/simplifying, e.g. mention "calcium calyceal stone of left kidney" but you only have "Urolithiasis"), call expand(ecl="< <seedId>", filter=<the ORIGINAL mention words>) to list DESCENDANTS, and pick the most specific descendant that is STILL FAITHFUL to the original mention — i.e. it does not add any site/cause/severity/subtype the original text does not state. Never descend past what the original mention says.

REJECT a candidate that is MORE SPECIFIC than the ORIGINAL mention (adds unstated site/cause/severity/subtype/larger syndrome), a different concept that merely shares words ("low platelet count" ≠ "HELLP syndrome"; "Abdomen: benign" ≠ "Adenoma"), the opposite meaning, or a risk/status concept for an actual finding. Wording differences are fine: "high blood pressure" ≡ "Hypertensive disorder"; "shortness of breath" ≡ "Dyspnea".

Ignore negation: the context field records absence separately — always code the POSITIVE concept ("no fever" → Fever).

Budget: at most ~5 tool calls. If no faithful concept exists, return null — that is correct.

When done, reply with ONLY a JSON object (no prose): {"code": "<id or null>", "display": "<preferred term or null>", "rungReached": <0..n>, "confidence": "high|medium|low", "rationale": "<one line>"}. code/display MUST come from a tool result, never invented.`;

  private async exec(name: string, args: any): Promise<any> {
    if (name === 'expand') {
      const count = Math.min(Math.max(Number(args?.count) || 12, 1), 25);
      const res: any = await this.terminology.expandValueSet(args?.ecl, args?.filter ?? '', 0, count).toPromise();
      const concepts = (res?.expansion?.contains || []).map((c: any, i: number) => ({ rank: i, code: c.code, display: c.display }));
      return { total: res?.expansion?.total ?? concepts.length, concepts };
    }
    if (name === 'lookup') {
      const terms: string[] = (await this.terminology.conceptTerms(args?.code).toPromise()) || [];
      return { code: args?.code, terms: [...new Set(terms)].slice(0, 12) };
    }
    return { error: `unknown tool ${name}` };
  }

  /**
   * Resolve one entity agentically. Returns the decision (code null if none).
   * `onAction` fires just before each tool runs, so the caller can surface what
   * the agent is doing (which term it is searching / looking up) live.
   */
  async codeEntity(entity: any, onAction?: (a: { name: string; args: any }) => void): Promise<AgentDecision> {
    const { ecl, label } = this.terminology.eclForType(entity.type);
    const messages = [
      { role: 'system', content: this.policy },
      { role: 'user', content: JSON.stringify({
          mention: entity.text,
          type: label,
          ecl,
          context: entity.context,
          clinicalTerm: entity.clinicalTerm,
          generalTerm: entity.generalTerm
        }) }
    ];
    const run = (n: string, a: any) => { try { onAction?.({ name: n, args: a }); } catch { /* ignore */ } return this.exec(n, a); };
    const { content, toolTrace, cost, iterations } =
      await this.openai.chatWithTools(messages, this.tools, run, { maxIters: 6, maxCompletionTokens: 4000 });
    const decision = this.parseDecision(content);
    return { ...decision, cost, iterations, toolTrace };
  }

  private parseDecision(text: string): AgentDecision {
    try {
      const match = (text || '').match(/\{[\s\S]*\}/);
      if (!match) { return { code: null, display: null, rationale: 'no decision returned' }; }
      const d = JSON.parse(match[0]);
      const code = d.code === null || d.code === undefined || d.code === '' || d.code === 'null' ? null : String(d.code);
      return {
        code,
        display: code ? (d.display ?? null) : null,
        rungReached: d.rungReached,
        confidence: d.confidence,
        rationale: d.rationale
      };
    } catch {
      return { code: null, display: null, rationale: 'unparseable decision' };
    }
  }
}
