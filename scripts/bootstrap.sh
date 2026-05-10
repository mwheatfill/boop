#!/usr/bin/env bash
# template-cf-fullstack bootstrap
#
# Run once after `pnpm install`. Sets up the local environment so
# `pnpm dev` works, and offers to provision the Cloudflare resources
# you'll need before your first deploy.
#
# Idempotent: re-running skips work that's already done.

set -euo pipefail

trap 'echo ""; echo "✗ Bootstrap interrupted."; exit 130' INT TERM

WRANGLER=(pnpm exec wrangler)
DEFAULT_NAME="template-cf-fullstack"

echo "▶ template-cf-fullstack bootstrap"
echo ""

# 1. App rename — find/replace the template name across configs and docs.
#
# The template ships hardcoded as "template-cf-fullstack". Forks that
# stay on this name skip the rename. Forks that pick a new name run the
# substitution across every file we know hardcodes it.

read -r -p "▶ App name (alphanumeric + dashes) [${DEFAULT_NAME}]: " app_name
app_name="${app_name:-$DEFAULT_NAME}"

if [[ ! "$app_name" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  echo "  ✗ Name must be lowercase alphanumeric + dashes (Cloudflare Worker naming rule)."
  exit 1
fi

if [[ "$app_name" != "$DEFAULT_NAME" ]]; then
  echo ""
  echo "▶ Renaming $DEFAULT_NAME -> $app_name across the repo..."

  # macOS sed needs '' after -i; GNU sed does not. Detect and adapt.
  if sed --version >/dev/null 2>&1; then
    SED_INPLACE=(sed -i)
  else
    SED_INPLACE=(sed -i '')
  fi

  files_to_rename=(
    "wrangler.jsonc"
    "package.json"
    "README.md"
    "AGENTS.md"
    "docs/adr/README.md"
    "scripts/openapi-document.ts"
    "src/routes/index.tsx"
    "src/routes/__root.tsx"
  )

  for f in "${files_to_rename[@]}"; do
    if [[ -f "$f" ]]; then
      "${SED_INPLACE[@]}" "s/${DEFAULT_NAME}/${app_name}/g" "$f"
      echo "  ~ $f"
    fi
  done

  # Also bootstrap.sh's own DEFAULT_NAME (so subsequent runs match)
  "${SED_INPLACE[@]}" "s/^DEFAULT_NAME=\"${DEFAULT_NAME}\"/DEFAULT_NAME=\"${app_name}\"/" \
    "scripts/bootstrap.sh" || true
  echo "  ~ scripts/bootstrap.sh (DEFAULT_NAME)"

  # And openapi:generate output
  pnpm openapi:generate >/dev/null 2>&1 || true
  echo "  ~ public/openapi.json (regenerated)"

  echo "  ✓ Rename complete. Review changes with: git diff"
else
  echo "  Keeping default name (${DEFAULT_NAME})."
fi

# 2. .dev.vars from example
echo ""
if [[ ! -f .dev.vars ]]; then
  echo "▶ Generating .dev.vars from .dev.vars.example..."
  cp .dev.vars.example .dev.vars
  echo "  + .dev.vars (edit to fill in env values for any recipes you install)"
else
  echo "▶ .dev.vars already exists; leaving as-is"
fi

# 3. TanStack Intent skill bindings
echo ""
echo "▶ Installing TanStack Intent skill bindings..."
npx @tanstack/intent install || echo "  (intent install reported issues; continuing)"

# 4. Verify openapi.json is in sync
echo ""
echo "▶ Checking openapi.json is in sync..."
pnpm openapi:check || {
  echo "  ⚠ openapi.json drifted. Run 'pnpm openapi:generate' and commit the result."
}

# 5. Optional: create your own Cloudflare D1 databases
echo ""
echo "▶ wrangler.jsonc currently points at the D1 databases on the template"
echo "  author's Cloudflare account (one for dev at the top level, one for"
echo "  production under env.production). To use your own (typical for a"
echo "  fresh fork), create them now."
echo "  (You'll need 'wrangler login' completed first.)"
echo ""
read -r -p "  Create your own D1 databases? [y/N] " create_d1

case "${create_d1:-N}" in
  [Yy]*)
    echo ""
    echo "▶ Creating dev D1..."
    if "${WRANGLER[@]}" d1 create "${app_name}-dev"; then
      echo "  ✓ Created (or existing). Copy the database_id printed above."
    else
      cmd_status=$?
      echo "  ✗ Failed (exit $cmd_status). Common causes: not logged in, name taken, quota."
      echo "    Run 'pnpm exec wrangler login' and retry."
      exit "$cmd_status"
    fi

    echo ""
    echo "▶ Creating production D1..."
    if "${WRANGLER[@]}" d1 create "${app_name}-prod"; then
      echo "  ✓ Created (or existing)."
    else
      cmd_status=$?
      echo "  ✗ Failed (exit $cmd_status)."
      exit "$cmd_status"
    fi

    echo ""
    echo "  ⚠ Patch the two database_id fields in wrangler.jsonc with the IDs"
    echo "    printed above:"
    echo "    - top-level d1_databases[0].database_id          (dev DB)"
    echo "    - env.production.d1_databases[0].database_id     (prod DB)"
    ;;
  *)
    echo ""
    echo "  Skipped. The template's existing D1 IDs stay in place. To create"
    echo "  your own later:"
    echo "    pnpm exec wrangler d1 create ${app_name}-dev"
    echo "    pnpm exec wrangler d1 create ${app_name}-prod"
    echo "  Then update both database_id fields in wrangler.jsonc."
    ;;
esac

# 6. Apply local migrations if there are any
if compgen -G "drizzle/*.sql" > /dev/null; then
  echo ""
  echo "▶ Applying migrations to local D1..."
  pnpm db:migrate:local || echo "  (migrate reported issues; check manually)"
else
  echo ""
  echo "▶ No migrations yet; skipping db:migrate:local"
  echo "  Recipes that add tables (e.g. auth/better-auth) ship migrations"
  echo "  on install. After that, run: pnpm db:generate && pnpm db:migrate:local"
fi

echo ""
echo "✅ Bootstrap complete."
echo ""
echo "Next steps:"
echo "  1. Edit .dev.vars with values for any recipes you plan to install."
echo "  2. Configure GitHub Secrets for CI/CD:"
echo "     - CLOUDFLARE_API_TOKEN"
echo "     - CLOUDFLARE_ACCOUNT_ID"
echo "     (See README → CI/CD for what these need.)"
echo "  3. Install capabilities from https://github.com/mwheatfill/app-platform-recipes"
echo "     For example:"
echo "       curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh \\"
echo "         | bash -s -- auth/better-auth"
echo "  4. Run 'pnpm dev' to start the dev server."
echo ""
