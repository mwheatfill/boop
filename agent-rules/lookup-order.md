# Documentation lookup order

When you need to know how a library, API, or vendor service works, resolve in this order. Don't skip layers.

```
1. Project-local rules         → agent-rules/*.md, AGENTS.md, docs/adr/*.md
2. TanStack Intent skills      → npx @tanstack/intent load <package>#<skill>
3. Configured MCP servers      → Cloudflare Docs, Microsoft Learn, Context7
4. llms.txt at vendor domain   → curl https://<vendor>/llms.txt
5. Vendor official docs        → WebFetch on the canonical doc URL
6. Web search                  → only when (1)–(5) yield nothing
7. Training data               → last resort; must be verified against (2)–(5)
```

## Why this order

Each layer is more current and more authoritative than the one below it.

- **Project rules** describe *this* repo's specific decisions. They override anything else for this codebase.
- **Intent skills** ship inside npm packages and version-lock to what's actually installed. When you bump `@tanstack/react-start`, the routing skill bumps with it.
- **MCP servers** are vendor-maintained doc surfaces (Cloudflare publishes one at `docs.mcp.cloudflare.com`; Microsoft publishes Microsoft Learn MCP). They're as current as the docs themselves.
- **`llms.txt`** is a vendor-published agent-readable index of their canonical docs.
- **Official docs** are correct but slower for an agent to navigate than structured MCPs.
- **Web search** drags in unverified blog posts and Stack Overflow answers from arbitrary versions.
- **Training data** has a knowledge cutoff. Library APIs change. Trust it least.

## Practical recipes

**TanStack-area question** (Router, Start, Query, Form, Table, Virtual):

```bash
pnpm intent:list                            # see what's available for installed versions
npx @tanstack/intent load @tanstack/react-router#routing
```

**Cloudflare Workers / D1 / Hyperdrive / R2 / Queues / AI Gateway / Workers CI question:**

Use the `cloudflare-docs` MCP server preconfigured in `.mcp.json`. Search by topic; the MCP returns current docs. This includes CI/deploy questions — `wrangler-action@v3`, GitHub Actions patterns, framework deploy guides.

**Microsoft Graph / Entra / Foundry question:**

Use the `microsoft-learn` MCP server preconfigured in `.mcp.json`. The Microsoft Learn corpus covers Graph API, Entra ID, Microsoft Foundry, Teams.

**Generic library question** (Better Auth, Drizzle, AI SDK, React Email, etc.):

Use the `context7` MCP server. It indexes a wide range of npm packages with version awareness.

**Anything not covered above:**

Try `https://<vendor>/llms.txt` first. Fall back to vendor official docs via WebFetch. Only then web search.

## Failure handling

If a layer fails (MCP server down, Intent skill missing, etc.), fall through to the next. Note the failure in your response so the user knows you couldn't reach a higher-authority source.

## Don't

- Don't skip Intent for TanStack libraries. Skills are version-locked; training data is not.
- Don't quote training-data API shapes without verifying against (2)–(5). Library APIs change.
- Don't fall back to web search for vendors with MCP servers configured. The MCP is faster and more authoritative.
- Don't use the OpenAI deprecated `gpt-3.5-turbo` (or similar training-frozen examples) when current models are documented in the live docs.
- Don't ship workaround flags (e.g. `wrangler deploy --config X --env=""`, hand-rolled artifact passing) when a framework guide documents the canonical pattern. Signal: if you're writing multi-line comments to defend why a step needs unusual flags, you missed a higher layer in this list — re-resolve from the top before committing.
