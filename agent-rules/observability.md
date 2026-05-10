# Observability

The template ships zero observability SaaS by default. Workers Logs (built-in via `observability: { enabled: true }` in `wrangler.jsonc`) is the baseline; recipes overlay Sentry / Application Insights / OTel for apps that need them.

## Logging

All app code logs via `logInfo` / `logWarn` / `logError` from `@/lib/log`. Never call `console.*` directly in `src/`; the audit blocks it.

```ts
import { logError, logInfo } from '@/lib/log'

logInfo('auth.session.created', { userId, source })

try {
  await doWork()
} catch (err) {
  logError('queue.job.failed', err, { jobId, attempt })
  throw err  // let the worker boundary catch + report
}
```

### Event-name convention

`domain.action.outcome`, dotted, lowercase. Examples:

- `auth.session.created`
- `audit.write.failed`
- `email.send.failed`
- `cron.snapshot.error`
- `http.request.complete`

Pick names by skimming existing call sites; reuse before inventing. The dotted shape lets Workers Logs filter on prefix (`auth.*`, `audit.*`).

### Structured fields

Always pass an object as the second arg. Workers Logs auto-extracts and indexes JSON fields, so `logInfo('auth.session.created', { userId })` makes `userId` queryable in the dashboard.

Reserved fields the wrapper writes itself:

- `error` — set by `logError` when an error is provided. Normalized via `err instanceof Error ? err.message : String(err)`.

Don't log secrets. Don't log raw request bodies for endpoints that handle PII. Hash identifiers before logging if downstream tooling will keep them.

## Errors

Three layers, all wired:

1. **Server-side uncaught** → bubble out of the server fn / route handler. The worker runtime sends them to Workers Logs and (if a monitoring recipe is installed) to Sentry / Application Insights.
2. **React render errors** → TanStack Router's `defaultErrorComponent` (the template's `DefaultCatchBoundary`) catches and shows a recovery UI.
3. **Expected failures** → `logError(event, err, fields)` at the call site, then either rethrow (if upstream should know) or return an error result.

Don't `try { ... } catch { /* swallow */ }`. If you genuinely want to ignore an error, log it at `warn` level with a one-line reason.

## Analytics

Cloudflare Web Analytics is the default for page-load metrics on user-facing apps (free, privacy-respecting, no third-party script). Add the beacon in `__root.tsx` when you need it.

For product analytics (button clicks, feature usage, funnels), install the planned `monitoring/posthog` recipe. PostHog covers analytics + feature flags + session replay in one. Don't reach for a separate analytics library.

## What recipes layer on

When a recipe is installed, it overlays `src/lib/log.ts` (or adds a sibling) so call sites don't change:

- `monitoring/sentry` — `logError` also calls `Sentry.captureException`; `logInfo` adds a Sentry breadcrumb.
- `monitoring/azure-app-insights` — same shape, App Insights `trackTrace` / `trackException` instead.
- `monitoring/otel-export` — wraps each call as an OTel span event.

The audit's `no-direct-console` rule is what makes this swap mechanical: if every log call goes through the wrapper, replacing the wrapper replaces the whole observability surface.
