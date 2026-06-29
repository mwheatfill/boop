# Email channel: Microsoft Graph shared mailbox

boop's email Channel sends through the `email/send-pipeline` recipe. The transport is
Microsoft Graph `sendMail` with app-only (client-credentials) auth, sending as a shared
mailbox. Code: `src/lib/email-recipe/graph.ts` (transport) wired by `src/lib/email-recipe/index.ts`
(the `mailer`), called by the `email` channel adapter `src/lib/channel-adapters/email.ts`.

Until the four `GRAPH_*` values are set, an email Channel saves and validates but delivery
reports "Microsoft Graph email is not configured" (it never silently drops).

## What you provision (Microsoft 365 admin)

1. **Entra app registration.** Entra admin center → App registrations → New registration
   (single tenant). Note the **Application (client) ID** and **Directory (tenant) ID**.
2. **Application permission `Mail.Send`.** API permissions → Microsoft Graph → Application
   permissions → `Mail.Send` → add → **Grant admin consent**. (Application, not Delegated.)
3. **Client secret.** Certificates & secrets → New client secret → copy the value once.
4. **Shared mailbox.** Use or create one (e.g. `alerts@stelglobal.com`).
5. **Scope the app to that one mailbox.** `Mail.Send` otherwise lets the app send as *any*
   mailbox. Restrict it with Exchange App RBAC (preferred; Application Access Policies are the
   legacy path and are deprecating):
   - Create a mail-enabled security group containing only the shared mailbox.
   - Grant the app the `Mail.Send` scope limited to that group via a management-scope RBAC
     assignment (`New-ManagementRoleAssignment` with a recipient-restricted scope), or the
     legacy `New-ApplicationAccessPolicy -AccessRight RestrictAccess -AppId <client-id>
     -PolicyScopeGroupId <group>`.

## What you set in boop

Non-secret (vars in `wrangler.jsonc`, per env):

- `GRAPH_TENANT_ID` — Directory (tenant) ID
- `GRAPH_CLIENT_ID` — Application (client) ID
- `GRAPH_MAIL_SENDER` — the shared mailbox address

Secret:

- `GRAPH_CLIENT_SECRET` — the client secret value
  - prod: `wrangler secret put GRAPH_CLIENT_SECRET --env production`
  - dev: `wrangler secret put GRAPH_CLIENT_SECRET`, or in local `.dev.vars`

## Verify

Create an email Channel (Channels → New → kind `email`, recipients + subject/body templates),
attach it to an AlertRule, and trigger a failing Run. A success is Graph `202 Accepted`; the
adapter retries transient `5xx`/`429` and treats `4xx` (bad creds / permission / unscoped
mailbox) as permanent.
