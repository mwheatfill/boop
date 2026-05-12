# ADR-024: Auth surfaces — API tokens for CLI/SDK, OAuth 2.1 (recipe-handled) for MCP

![Status](https://img.shields.io/badge/status-Proposed-yellow) ![Date](https://img.shields.io/badge/date-2026--05--12-blue)

## Context

boop has three groups of non-browser callers that need to authenticate, each with materially different ergonomics: (a) CLI / SDK / GitHub Action / Terraform provider use, which expects raw bearer tokens an operator pastes into an env var; (b) MCP clients (Claude Code, Cursor, MCP-spec agents), which the [MCP authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) requires use OAuth 2.1 with PKCE and Resource Indicators when running over HTTP; (c) hypothetical future third-party apps that want delegated permissions to act on behalf of an operator. [ADR-016](016-operator-authz.md) decided browser identity (Cloudflare Access JWT + Entra) and the double-bound AI authz model but explicitly deferred the non-browser auth question.

Without a clear split between these surfaces, two failure modes are likely: (1) unifying everything under OAuth makes the CLI experience needlessly heavy (operator generates a token by clicking "New API token" in the UI — adding PKCE + refresh-token rotation + a CLI-side OAuth dance is over-engineering for that flow); (2) extending raw bearer tokens to MCP violates the MCP spec, which says HTTP transport SHOULD conform to its OAuth 2.1 profile, breaking interoperability with off-the-shelf MCP clients.

## Decision

Two parallel auth surfaces, each fit for purpose. Browser identity remains Cloudflare Access JWT per [ADR-016](016-operator-authz.md).

| Surface | Mechanism | Implemented in | Used by |
|---|---|---|---|
| Browser sessions | Cloudflare Access JWT (`CF-Access-Jwt-Assertion`) | boop core; `getCurrentUser(request)` per [ADR-005](005-auth-provider-abstraction.md) | Operators in the UI |
| CLI / SDK / GitHub Action / Terraform / headless integrations | **Raw bearer API tokens.** Stripe-style format `boop_<env>_<random>` (e.g., `boop_live_3K9...`, `boop_test_aB...`). Hash-stored in an `api_tokens` D1 table (SHA-256 of the random portion). Scoped (`read`, `write`, `admin`; future per-Customer scopes). | A future foundation PRD (DEV-1 in the developer-surfaces vision, issue #46) | The CLI (`boop login` stores a token), SDK consumers, GitHub Actions workflows, Terraform provider |
| MCP transport | **OAuth 2.1 with PKCE + RFC 8707 Resource Indicators.** boop's MCP endpoint is an OAuth Protected Resource per RFC 9728. Token issuance and validation are owned by the `mcp/expose-app-as-mcp-server` recipe ([ADR-015](015-ai-authoring-stack.md)). | The MCP recipe; boop validates inbound access tokens via recipe-provided helpers | MCP-spec clients: Claude Code, Cursor, custom agents using the MCP SDK |
| Future: third-party app delegation | **OAuth 2.1 authorization server with Dynamic Client Registration (RFC 7591) or Client ID Metadata Documents.** Deferred to a future PRD; not implemented in v1. | Future PRD, scope TBD | Hypothetical third-party apps offering "Sign in with boop" |

A unified `getAuthIdentity(request)` helper sits at the request boundary and inspects in order: (1) Access JWT header (browser), (2) `Authorization: Bearer boop_*` header (API token), (3) `Authorization: Bearer <opaque>` validated via MCP recipe (OAuth). All three resolve to the same `Operator` shape `{ id, email, role: 'admin' | 'operator', authMethod: 'access' | 'api_token' | 'oauth' }`. Downstream code reads role uniformly; only authn middleware cares about the underlying mechanism.

`api_tokens` table shape (deferred to DEV-1 PRD):

```
api_tokens(
  id TEXT PK,                        -- ULID
  operator_id TEXT NOT NULL FK,
  name TEXT NOT NULL,                -- operator-supplied label
  prefix TEXT NOT NULL,              -- first 8 chars of plaintext, indexed for fast lookup
  hashed_secret TEXT NOT NULL,       -- SHA-256(plaintext.random_portion)
  scopes TEXT NOT NULL,              -- JSON array
  created_at INT NOT NULL,
  last_used_at INT,
  revoked_at INT
)
```

The plaintext is displayed exactly once at creation (mirrors the webhook secret rotation pattern from PR #41 and the Cloudflare Access Service Token pattern documented in [PRD #50](https://github.com/mwheatfill/boop/issues/50)).

## Consequences

**Positive:**

- Each auth surface is fit for purpose. CLI users paste a token; MCP clients perform an OAuth dance; browser sessions stay zero-effort.
- MCP spec compliance comes for free via the recipe. boop's code never implements OAuth flows, PKCE, Dynamic Client Registration, or Resource Indicators — those concerns live in `mcp/expose-app-as-mcp-server` and are upgradeable as the spec evolves.
- The `getAuthIdentity` helper centralizes the mechanism dispatch, so downstream code reads `role` uniformly. Adding a fourth surface in the future (e.g., third-party OAuth AS for delegated apps) is one branch in `getAuthIdentity`, not a rewrite.
- Token rotation, scopes, and per-Customer scoping (future) all attach to `api_tokens` rows without affecting OAuth or browser flows.

**Negative:**

- Two auth subsystems to maintain. The cognitive load of "which auth is this caller using?" is real, mitigated by the unified `getAuthIdentity` boundary and the rule that mechanism is set once at request-ingress.
- Token discovery surfaces are different per mechanism: an `api_tokens` admin page in boop's UI; a recipe-managed OAuth discovery endpoint at `/.well-known/oauth-protected-resource`. Operators editing one don't see the other.
- A future "Sign in with boop" use case would require building a full OAuth authorization server in-tree (Dynamic Client Registration, JWKS, refresh-token rotation, consent UI). The work is real but deferred; the v1 surface area doesn't pre-pay for it.

**Neutral / trade-off:**

- Unifying everything under OAuth (CLI uses client-credentials grant) was considered and rejected: client-credentials adds PKCE-less plaintext-secret semantics to CLI auth without ergonomic benefit, and refresh-token rotation for a long-lived CLI token is meaningless — the operator just regenerates the token in the UI. Raw bearer tokens are the canonical pattern for that audience (GitHub, Stripe, Cloudflare itself).
- The opposite simplification — only raw bearer tokens, no OAuth — would force MCP clients to manage pasted tokens manually, breaking compatibility with the MCP-client UX (which expects an OAuth `/.well-known` discovery flow and an authorization code redirect). Off-the-shelf MCP clients would not work with boop.
- This ADR composes with [ADR-005](005-auth-provider-abstraction.md) (auth provider abstraction), [ADR-015](015-ai-authoring-stack.md) (MCP is recipe-installed), and [ADR-016](016-operator-authz.md) (browser auth + double-bound AI authz). The double-bound AI authz check applies uniformly across all three surfaces because `getAuthIdentity` resolves to the same `Operator` shape regardless of mechanism.
