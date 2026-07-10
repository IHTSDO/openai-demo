/**
 * Per-entity execution trace for the entity-extraction pipeline.
 *
 * Every entity the LLM produces carries an `EntityTrace` recording what
 * happened at each stage (extraction → normalization → terminology search →
 * scoring → final result). This serves two purposes:
 *   1. Debugging — see exactly why an entity did or did not resolve to a
 *      SNOMED CT concept (e.g. wrong type hierarchy, phrasing the server
 *      filter could not match, candidate rejected by the distance threshold).
 *   2. Visualization — the ordered `steps` are designed to be rendered as a
 *      flow/timeline diagram for the user.
 */

export type TraceStatus = 'ok' | 'warn' | 'fail';

export type TraceStage = 'extract' | 'normalize' | 'synonym' | 'search' | 'score' | 'result';

/** One step in an entity's journey through the pipeline. */
export interface TraceStep {
  stage: TraceStage;
  status: TraceStatus;
  /** Short human-readable heading, e.g. "Terminology search". */
  title: string;
  /** One-line explanation of what happened at this step. */
  detail: string;
  /** Optional structured payload for richer rendering (candidates, ECL, …). */
  data?: any;
}

/** A candidate concept returned by the terminology server for an entity. */
export interface TraceCandidate {
  code: string;
  display: string;
  /** Levenshtein distance between the searched term and this candidate. */
  distance: number;
  /** True for the candidate that was ultimately chosen (if any). */
  chosen?: boolean;
}

export interface EntityTrace {
  /** Original text the entity was extracted from. */
  term: string;
  /** Whether the entity ended up matched to a SNOMED CT concept. */
  matched: boolean;
  /** Ordered steps, ready to render as a flow diagram. */
  steps: TraceStep[];
}
