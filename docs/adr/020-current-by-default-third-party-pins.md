# ADR-020: Current-by-default for third-party version pins

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--12-blue)

## Context

Agents authoring code reach for whichever version their training memorized, often a major behind. ADR-011 captured this for library API syntax and pointed agents at Intent skills + MCP + `llms.txt`. The principle did not extend to version pins themselves: GitHub Actions YAML pins, `wrangler.jsonc` action pins, MCP server pins in `.mcp.json`, shadcn registry style names, and npm `^/~` ranges all sit outside ADR-011's "library API" framing. PR #27 fixed the visible instance (workflow actions pinned to `@v4` while v6 had been current for months) but did not generalize the rule.

The risk if left undecided: the next pin authored from training memory ages out the same way, the workaround flag pattern (e.g., `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`) reappears to silence the deprecation signal, and the staleness recurs.

## Decision

Every third-party version pin is current-by-default. The rule applies to GitHub Actions YAML, `wrangler.jsonc` action pins, MCP server pins, `package.json` deps, the shadcn registry style, and any other surface that names an external version. Enforcement is layered:

| Concern | Choice | Over |
|---|---|---|
| Authoring-time prevention | **Agent-side meta-rule in AGENTS.md "Things to avoid".** Pinning a stale major is forbidden; resolving current latest (via `gh api repos/<owner>/<repo>/releases/latest`, the package manager, or the vendor's release feed) precedes any pin. | A passive convention. Rules without visibility get skipped; AGENTS.md is read every session. |
| Automated bumping | **Renovate with `helpers:pinGitHubActionDigests` + `minimumReleaseAge: "14 days"`.** SHA-pins GitHub Actions for security per the CNCF "Securing GitHub Actions CI dependencies" recipe card (2026-05-04), keeps every dep class covered via Renovate's 90+ managers, and avoids the malicious-dependency window flagged by GitGuardian. | Dependabot (GitHub-only, 30 managers); manual bumps; no automation. The Renovate App must be installed against the repo for the existing `renovate.json` to activate. |
| CI-side detection | **`scripts/audit-patterns/workflows.ts`** module that errors when a GitHub Action pin is behind latest major and warns on moving branch refs or unrecognized shapes. Runs in the existing `pnpm audit:patterns` step (per ADR-009). | Trusting the agent-side rule alone (rots; see PR #27's archaeology). Manual audits. |
| Workaround flags | **Forbidden when a current-major action removes the need.** The research-first protocol re-anchored every turn already prohibits "workaround flags or hand-rolled patterns when a framework guide documents a canonical alternative." This ADR cites that clause as load-bearing for pin currency too. | Silencing a deprecation warning with a flag instead of bumping (the failure mode that produced the v4 pins). |
| SHA-pinned actions | **Trusted to Renovate's digest preset; audit skips major comparison.** The preset keeps the SHA fresh against the named tag. | Failing the audit on SHA-pinned actions (would defeat the security-first pinning convention). |

The three layers reinforce one another. Layer 1 (AGENTS.md) catches new authoring; Layer 2 (Renovate) catches drift over time; Layer 3 (`audit-patterns/workflows.ts`) catches both when the others are bypassed.

## Consequences

**Positive:**

- Authoring-time, drift-time, and CI-time gates exist for the same rule, so a miss in one layer is caught by the next.
- The audit module produces structured findings with file, line, current pin, latest major, and a release-page URL. Agents and humans see the same signal.
- Renovate's `helpers:pinGitHubActionDigests` gives forward-compat to SHA-pinning when SwitchThink's supply-chain posture tightens; the audit module already trusts SHAs.
- The rule explicitly subsumes the cases where ADR-011 was silent (YAML pins, MCP server pins, wrangler action pins).

**Negative:**

- The audit module calls `api.github.com` per unique action `(owner, repo)`. Unauthenticated CI runners get 60 req/hour per IP; the audit uses `GITHUB_TOKEN` when present (5000 req/hour) to stay well under the cap. Local `pnpm audit:patterns` runs without a token can rate-limit if invoked repeatedly within an hour.
- Renovate's `minimumReleaseAge: "14 days"` slows the bump cadence by two weeks. For most deps this is the correct trade-off; for security patches Renovate's vulnerability flow bypasses the delay.
- The audit fails CI on stale majors. If Renovate is uninstalled and PRs land manually for a while, the audit will redden until pins are current. That is the intended behavior; the friction is the lever that gets pins fresh.

**Neutral / trade-off:**

- ADR-011 remains scoped to library API syntax; this ADR sits next to it covering version pins. No rewrite of ADR-011 is needed.
- The audit module does not enforce SHA-pinning yet (just allows it). When SwitchThink's posture requires SHA-pinning, a future change flips the audit from "any tag-pinned current major is fine" to "tag-pins are warnings, SHA-pins are required." Today's tag-pinned `@v6` posture stays valid.
- Renovate's `helpers:pinGitHubActionDigestsToSemver` preset (the variant that adds a semver comment next to the SHA) is intentionally not included; the SHA + named tag in the action's GitHub UI is enough. Switch in a future ADR if comment-style SHA-pinning becomes preferred.
