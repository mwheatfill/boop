# Conventions

Voice, naming, formatting, error handling. Short rules.

## File naming

- **kebab-case** for filenames: `get-current-user.ts`, `app-shell.tsx`.
- **PascalCase** for React component files when the file is the component: `Button.tsx`, `DefaultCatchBoundary.tsx`. (TanStack Start route files are kebab-case because the URL path matches the file path.)
- **camelCase** for variables, functions, hooks (`useFoo`).
- **CONSTANT_CASE** for env vars and runtime constants.

## Voice

- **Active voice.** "The handler validates input" not "input is validated by the handler."
- **Conversational, not corporate.** Doc files are read by humans and AI agents; both prefer plain language.
- **Oxford comma.** "auth, sessions, and rate limiting."
- **Sentence-style headings.** Capitalize the first word and proper nouns only. Not Title Case.
- **No em dashes.** Use commas, parens, or split sentences.

## Comments

- **Default to no comments.** Names explain what the code does. Code says what; you don't.
- **One-line comments where the *why* is non-obvious.** Hidden constraints, subtle invariants, workarounds for specific bugs, behaviors that would surprise a reader.
- **No multi-paragraph docstrings.** A one-line comment max. If you need more, write a doc.
- **No "ticket reference" comments.** "Added for issue #123" rots; commit messages and PR descriptions are the right place.
- **No "what" comments.** `// fetch the user` above `const user = await fetchUser()` is noise.

Examples of good comments:

```ts
// Workers SSE compression buffers chunks; identity disables it.
res.headers.set('Content-Encoding', 'identity')

// next-themes despite the prefix; framework-agnostic, shadcn-canonical.
import { ThemeProvider } from 'next-themes'
```

## Product names

Always write in full:

- **"Microsoft 365"** — never "M365" or "MS365".
- **"Microsoft Foundry"** — never "Azure AI Foundry" alone, never "Azure OpenAI" alone.
- **"Cloudflare Workers"** — not "CF Workers" in user-facing text or docs (in code/config it's fine to use abbreviations).
- **"TanStack Start"** — not "TSS" outside of throwaway commit messages.

In code identifiers, abbreviations are acceptable (`getCfAccessJwt`, `tssRoot`).

## Error handling

- **Throw, don't return errors.** Server functions throw; TanStack Start catches and returns HTTP responses.
- **Throw concrete error types** when the caller needs to discriminate. `class UnauthorizedError extends Error {}`. The catch handler maps to HTTP status codes.
- **No silent fallbacks.** If a request can't be fulfilled, throw. Don't return a default value that masks the failure.
- **Log structured.** Pino is the logger. Use `logger.error({ err, context }, 'message')`, not `console.error(err.stack)`.

## Don't

- Don't add features beyond what the task requires. Bug fixes don't need surrounding cleanup.
- Don't introduce abstractions for hypothetical future needs. Three similar lines beats a premature interface.
- Don't add error handling for scenarios that can't happen. Trust internal code and framework guarantees. Validate at boundaries (user input, external APIs).
- Don't add backwards-compatibility shims when you can change the code. No feature flags for "old behavior" unless requested.
- Don't write half-finished implementations. Land a smaller working slice instead of a larger broken one.

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Configured in `tsconfig.json`.
- **Prefer `type` over `interface`** for app types. Use `interface` only for things meant to be extended (rare in app code).
- **Prefer `unknown` over `any`.** When you need `any`, comment why.
- **No `as` casts** except at boundaries (parsing JSON, reading env). Use Zod for boundaries.
- **`import type`** for type-only imports. Biome enforces.

## Imports

- Path alias: `@/...` for `src/...`. Don't use deep relative paths (`../../../../foo`).
- Group order (Biome handles): node built-ins → external → `@/...` → relative.
- Side-effect imports (e.g., `import 'zod-openapi'`) at the top of the import block.
