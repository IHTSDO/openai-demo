# mcp-fhir-terminology

A minimal [MCP](https://modelcontextprotocol.io) server that exposes two SNOMED CT
terminology operations over a FHIR endpoint, so any MCP-capable agent (e.g. the
[`snomed-coder`](../../skills/snomed-coder/SKILL.md) skill) can search and confirm
concepts without a custom backend. It is a thin proxy — all terminology work is
done by the FHIR server.

## Tools

| Tool | Input | Returns | FHIR call |
|---|---|---|---|
| `expand` | `{ ecl, filter?, count? }` | `{ total, concepts: [{ rank, code, display }] }` | `ValueSet/$expand` (ECL value set + term filter) |
| `lookup` | `{ code }` | `{ code, display, synonyms[] }` | `CodeSystem/$lookup` (designations) |

`expand` supports structural generalization: pass `ecl: "> <conceptId>"` to list a
concept's ancestors and walk up the `is a` hierarchy.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `FHIR_BASE` | `https://implementation-demo.snomedtools.org/fhir` | Any SNOMED CT FHIR terminology server. |
| `FHIR_LANGUAGE` | `en` | Display language. |

Other endpoints you can point at: a public Snowstorm
(`https://snowstorm.ihtsdotools.org/fhir`), a national extension server, or your
own Snowstorm. The default is the demo server this project already uses.

## Run

```bash
cd tools/mcp-fhir-terminology
npm install
FHIR_BASE=https://implementation-demo.snomedtools.org/fhir node index.mjs
```

The server speaks MCP over **stdio**.

## Wire into an MCP client

Add it to your client's MCP config (e.g. Claude Desktop / Claude Code
`mcpServers`):

```json
{
  "mcpServers": {
    "fhir-terminology": {
      "command": "node",
      "args": ["/absolute/path/to/tools/mcp-fhir-terminology/index.mjs"],
      "env": { "FHIR_BASE": "https://implementation-demo.snomedtools.org/fhir" }
    }
  }
}
```

Then load the `snomed-coder` skill and ask it to code a note — it will call
`expand`/`lookup` on this server, following the generalization ladder.

## Status

Reference implementation authored alongside the design note
[`docs/coding-agent-design.md`](../../docs/coding-agent-design.md); it has not been
run end-to-end in an MCP client yet. It requires `npm install`
(`@modelcontextprotocol/sdk`, `zod`) and Node 18+ (for global `fetch`). Treat it
as a starting point: verify tool output shapes against your chosen FHIR server.
