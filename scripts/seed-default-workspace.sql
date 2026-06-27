-- ADR-027: a single default Workspace is seeded; the app resolves every surface
-- to it in _authenticated.beforeLoad. Without one, getDefaultWorkspace throws and
-- the whole authenticated app renders an error boundary. Idempotent on the slug.
INSERT OR IGNORE INTO workspaces (id, name, slug, timezone)
VALUES ('cust_default', 'SwitchThink', 'switchthink', 'America/Phoenix');
