#!/usr/bin/env node
/**
 * mcp-fhir-terminology — a minimal MCP server that exposes two SNOMED CT
 * terminology operations over a FHIR endpoint, for use by the `snomed-coder`
 * skill (or any MCP-capable agent):
 *
 *   - expand({ ecl, filter?, count? })  -> ranked concepts (ValueSet/$expand)
 *   - lookup({ code })                  -> preferred term + synonyms (CodeSystem/$lookup)
 *
 * It is a thin proxy: all terminology work is done by the FHIR server. Configure
 * the endpoint with the FHIR_BASE environment variable (default below).
 *
 * Run:  FHIR_BASE=https://implementation-demo.snomedtools.org/fhir node index.mjs
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const FHIR_BASE = (process.env.FHIR_BASE || 'https://implementation-demo.snomedtools.org/fhir').replace(/\/+$/, '');
const SYSTEM = 'http://snomed.info/sct';
const LANG = process.env.FHIR_LANGUAGE || 'en';

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/fhir+json, application/json' } });
  if (!res.ok) {
    throw new Error(`FHIR ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

function ok(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] };
}
function fail(message) {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
}

const server = new McpServer({ name: 'fhir-terminology', version: '0.1.0' });

server.tool(
  'expand',
  'Search SNOMED CT via ValueSet/$expand. Returns concepts (code + display) matching a term within an ECL constraint, in the server\'s relevance order. Use the type root ECL (e.g. "<< 404684003" for Clinical finding) plus a `filter` term; use "> <conceptId>" to list a concept\'s ancestors for structural generalization.',
  {
    ecl: z.string().describe('ECL constraint, e.g. "<< 404684003 |Clinical finding|" or "> 38341003" for ancestors.'),
    filter: z.string().optional().describe('Free-text term to search for within the ECL constraint.'),
    count: z.number().int().min(1).max(50).optional().describe('Max concepts to return (default 15).'),
  },
  async ({ ecl, filter, count }) => {
    try {
      const n = count ?? 15;
      let url = `${FHIR_BASE}/ValueSet/$expand?url=${SYSTEM}?fhir_vs=ecl/${encodeURIComponent(ecl)}`
        + `&count=${n}&offset=0&language=${LANG}`;
      if (filter && filter.trim()) { url += `&filter=${encodeURIComponent(filter.trim())}`; }
      const body = await getJson(url);
      const concepts = (body?.expansion?.contains || []).map((c, i) => ({
        rank: i,
        code: c.code,
        display: c.display,
      }));
      return ok({ total: body?.expansion?.total ?? concepts.length, concepts });
    } catch (err) {
      return fail(err?.message || 'expand failed');
    }
  }
);

server.tool(
  'lookup',
  'Look up a SNOMED CT concept by code via CodeSystem/$lookup. Returns its preferred term and all synonyms/designations — use it to confirm that a differently-worded concept really is equivalent to a mention (e.g. that "Eruption" carries the synonym "Rash").',
  {
    code: z.string().describe('SNOMED CT concept id, e.g. "38341003".'),
  },
  async ({ code }) => {
    try {
      const url = `${FHIR_BASE}/CodeSystem/$lookup?system=${SYSTEM}&code=${encodeURIComponent(code)}`;
      const body = await getJson(url);
      const params = body?.parameter || [];
      const display = params.find((p) => p.name === 'display')?.valueString ?? null;
      const synonyms = params
        .filter((p) => p.name === 'designation')
        .map((p) => (p.part || []).find((x) => x.name === 'value')?.valueString)
        .filter(Boolean);
      return ok({ code, display, synonyms: [...new Set(synonyms)] });
    } catch (err) {
      return fail(err?.message || 'lookup failed');
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
// eslint-disable-next-line no-console
console.error(`mcp-fhir-terminology ready (FHIR_BASE=${FHIR_BASE})`);
