# Dependencies

Two failure modes this rule prevents:

1. **Version drift downward.** Installing an older version because training data references an older version.
2. **Rogue introductions.** Reaching for a new dependency when the project already covers the concern, or when the spec already specified a tool.

Both fail loudly the first time. Quietly thereafter. So this rule is enforced by both behavior (this file) and harness gates (`.claude/settings.json` denies `pnpm add`, prompting the user every time).

## Choose the right approach, then the right version

Adding a dependency is two questions, in order. Skipping the first is how you install deprecated packages whose latest versions are still on npm.

**1. Is this the current recommended approach?**

For packages from major vendors (Cloudflare, Microsoft, Vercel, AWS, Anthropic, etc.), check the vendor's current setup docs *before* installing. The package may still be published but superseded by a different mechanism. For example, `wrangler types` superseded `@cloudflare/workers-types` for Cloudflare Workers TypeScript types.

Use the lookup order in [`lookup-order.md`](lookup-order.md). Configured MCP servers (step 3) are the fastest path to current vendor guidance:

- Cloudflare ecosystem → Cloudflare Docs MCP
- Microsoft ecosystem (Graph, Entra, Foundry, Teams) → Microsoft Learn MCP
- Anything else → Context7 MCP

Sample repos and starter templates lag. Use them for *structure* (file layout, plugin order, config shape), not for *which packages are current*. Don't copy `package.json` from an example and assume it is.

**2. What's the latest stable version?**

```bash
npm view <pkg> version       # current "latest" tag
npm view <pkg> dist-tags     # see all tags (latest, beta, next, etc.)
npm view <pkg> versions      # full history; useful when "latest" looks suspicious
```

Install the latest stable major. Don't pin to a remembered version. Don't pin to an older major without a documented compatibility reason recorded in the corresponding ADR or in `agent-rules/architecture.md`.

## Don't introduce dependencies on impulse

Before proposing a new dependency:

1. **Check what's already installed.** Run `pnpm ls --depth=0`. Is there an existing package that covers this concern?
2. **Check the architectural decisions.** Read `agent-rules/architecture.md` and the relevant ADR in `docs/adr/`. Is there an existing choice for this layer?
3. **Check the spec.** If a `SPEC.md` / `PRD.md` exists, search it for the concern. The spec may have already named the tool.

Only after those three checks, propose to the user:

```
Proposed addition: <package-name>@<version>
Why: <one sentence>
Alternatives considered: <other packages or in-tree options>
Maintenance signal: <weekly downloads, last release date, GitHub stars or issue activity>
```

Wait for explicit confirmation before running `pnpm add`. The harness will prompt the user anyway (Claude Code's `.claude/settings.json` denies `pnpm add` by default), but the proposal step gives the user the information needed to confirm intelligently.

## Pinning policy

| What | How | Why |
|---|---|---|
| Application dependencies | Caret (`^1.2.3`) | Auto-pick patch and minor on `pnpm install` |
| Tools that affect output (Biome, TypeScript, esbuild) | Exact (`1.2.3`) | Same output across machines and CI |
| Pre-1.0 packages | Caret with care | Caret on 0.x means same minor only; review breaking changes carefully |
| Cloudflare ecosystem (`wrangler`, `@cloudflare/*`) | Caret major | Cloudflare ships breaking changes infrequently and with migration notes |

Renovate handles bumps. Don't bypass it by manually upgrading deps unless there's a security advisory or a specific bug fix needed.

## Removal protocol

Before removing a dependency:

1. **Search for usages.**

   ```bash
   rg "from ['\"]<pkg>['\"]"             # ESM imports
   rg "require\(['\"]<pkg>['\"]\)"        # CJS requires
   rg "@<pkg>"                            # type imports, scoped packages
   ```

2. **Check tooling integration.** Is the package in `biome.json`, `vitest.config.ts`, `wrangler.jsonc`, or any script in `package.json`?

3. **Cite zero usages or a migration plan** before removing.

4. The harness will prompt on `pnpm remove`. Confirm with the user that the migration / cleanup is staged before pulling the trigger.

## Updating dependencies

- `pnpm update` is denied by default in the harness allow-list. Use Renovate's grouped PRs instead.
- For ad-hoc updates (security advisory, specific bug fix), propose to the user with the same shape as a new addition.
- After any version bump, re-run `npx @tanstack/intent install` to refresh skill bindings (see `agent-rules/intent.md`).

## Why this matters

Templates accumulate dependencies. Apps cloned from the template inherit them. Every dep is a maintenance liability and a security surface. Default to fewer.
