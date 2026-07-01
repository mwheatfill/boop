// Contract-drift guard for the server-function surface. openapi.json is
// generated from the named schemas in src/shared/schemas/** (see
// scripts/openapi-document.ts). If a server fn passes an *inline* Zod schema to
// .inputValidator(), that input never enters the contract, so ADR-013's
// "validated input drift blocks deploys" quietly stops holding. This audit
// fails when a validated input is anything other than a named schema, so a new
// input can no longer silently escape. See ADR-009 (audit rationale) + ADR-013.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { REPO_ROOT, repoPath, walkTs } from './_fs'
import type { AuditResult, Finding } from './types'

const AUDIT = 'openapi-contract' as const
const SOURCE = 'ADR-013: validated server-fn inputs are named schemas in src/shared/schemas/**'

// Reads the substring inside the parentheses that open at `openParenIdx`
// (which must point at the "(" char), tracking depth while skipping string
// literals so parens inside strings do not unbalance the scan.
function readBalanced(src: string, openParenIdx: number): { body: string; end: number } {
  let depth = 0
  let quote: string | null = null
  let i = openParenIdx
  for (; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (ch === '(') depth++
    else if (ch === ')' && --depth === 0) break
  }
  return { body: src.slice(openParenIdx + 1, i), end: i }
}

// Nearest preceding `const <name> =`, i.e. the server fn the inputValidator
// hangs off, for a locatable error message.
function enclosingServerFnName(src: string, idx: number): string {
  const decls = [...src.slice(0, idx).matchAll(/(?:export\s+)?const\s+(\w+)\s*=/g)]
  return decls.at(-1)?.[1] ?? '(unknown)'
}

// Fails when the schema handed to .inputValidator() is built inline with `z.`
// rather than referenced as a named schema (e.g. `Schema.parse(data)` or
// `Base.extend(Other.shape).parse(data)`).
function inlineSchemaFindings(rel: string, src: string): Finding[] {
  const findings: Finding[] = []
  const marker = '.inputValidator('
  for (let at = src.indexOf(marker); at !== -1; at = src.indexOf(marker, at + 1)) {
    const { body } = readBalanced(src, at + marker.length - 1)
    // Validators read `(params) => <schema-expr>.parse(data)`. Inspect only the
    // schema expression (after `=>`, up to the terminal `.parse`) so a
    // `z.infer<...>` type annotation in the params never trips the check.
    const arrow = body.indexOf('=>')
    const afterArrow = arrow === -1 ? body : body.slice(arrow + 2)
    const parseIdx = afterArrow.lastIndexOf('.parse(')
    const schemaExpr = parseIdx === -1 ? afterArrow : afterArrow.slice(0, parseIdx)
    if (/\bz\s*\./.test(schemaExpr)) {
      findings.push({
        audit: AUDIT,
        severity: 'error',
        file: rel,
        line: src.slice(0, at).split('\n').length,
        message: `Server function \`${enclosingServerFnName(src, at)}\` passes an inline Zod schema to .inputValidator(). Move it to src/shared/schemas/** with .meta({ id }), register it in scripts/openapi-document.ts, and reference it by name so the input enters the OpenAPI contract.`,
        source: SOURCE,
      })
    }
  }
  return findings
}

const LOCAL_SCHEMA_DECL =
  /^\s*const\s+(\w+)\s*=\s*z\s*\.\s*(?:object|union|array|enum|record|tuple|discriminatedUnion|intersection|literal|string|number|int|boolean)\b/

// Fails when a server-fn file declares a Zod schema locally. Even when
// referenced by name (so inlineSchemaFindings passes), a locally-defined schema
// never reaches scripts/openapi-document.ts, so it stays out of the contract.
function localSchemaFindings(rel: string, src: string): Finding[] {
  const findings: Finding[] = []
  src.split('\n').forEach((line, idx) => {
    const m = LOCAL_SCHEMA_DECL.exec(line)
    if (m) {
      findings.push({
        audit: AUDIT,
        severity: 'error',
        file: rel,
        line: idx + 1,
        message: `Server-fn file declares a local Zod schema \`${m[1]}\`. Move it to src/shared/schemas/** so it enters the OpenAPI contract, then import it here.`,
        source: SOURCE,
      })
    }
  })
  return findings
}

export function runOpenapiContractAudit(): AuditResult {
  const findings: Finding[] = []
  for (const abs of walkTs(repoPath('src'))) {
    const rel = relative(REPO_ROOT, abs)
    const src = readFileSync(abs, 'utf8')
    if (src.includes('.inputValidator(')) findings.push(...inlineSchemaFindings(rel, src))
    if (rel.endsWith('server-fns.ts')) findings.push(...localSchemaFindings(rel, src))
  }
  return { audit: AUDIT, findings, ok: true }
}
