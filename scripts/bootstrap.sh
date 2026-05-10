#!/usr/bin/env bash
# template-cf-fullstack bootstrap
#
# Run once after `pnpm install`. Sets up the local environment so
# `pnpm dev` works, and offers to provision the Cloudflare resources
# you'll need before your first deploy.
#
# Idempotent: re-running skips work that's already done.

set -euo pipefail

WRANGLER=(pnpm exec wrangler)

echo "▶ template-cf-fullstack bootstrap"
echo ""

# 1. .dev.vars from example
if [[ ! -f .dev.vars ]]; then
  echo "▶ Generating .dev.vars from .dev.vars.example..."
  cp .dev.vars.example .dev.vars
  echo "  + .dev.vars (edit to fill in env values for any recipes you install)"
else
  echo "▶ .dev.vars already exists; leaving as-is"
fi

# 2. TanStack Intent skill bindings
echo ""
echo "▶ Installing TanStack Intent skill bindings..."
npx @tanstack/intent install || echo "  (intent install reported issues; continuing)"

# 3. Verify openapi.json is in sync (regen happens on schema changes)
echo ""
echo "▶ Checking openapi.json is in sync..."
pnpm openapi:check || {
  echo "  ⚠ openapi.json drifted. Run 'pnpm openapi:generate' and commit the result."
}

# 4. Optional: create Cloudflare D1 databases
echo ""
echo "▶ The template's wrangler.jsonc has placeholder D1 database IDs."
echo "  Real IDs are required before deploy. Want to create them now?"
echo "  (You'll need 'wrangler login' completed first.)"
echo ""
read -r -p "  Create D1 databases? [y/N] " create_d1

case "${create_d1:-N}" in
  [Yy]*)
    echo ""
    echo "▶ Creating dev D1..."
    if "${WRANGLER[@]}" d1 create template-cf-fullstack-dev; then
      echo "  ✓ Created (or existing). Copy the database_id printed above."
    else
      status=$?
      echo "  ✗ Failed (exit $status). Common causes: not logged in, name taken, quota."
      echo "    Run 'pnpm exec wrangler login' and retry."
      exit "$status"
    fi

    echo ""
    echo "▶ Creating production D1..."
    if "${WRANGLER[@]}" d1 create template-cf-fullstack-prod; then
      echo "  ✓ Created (or existing)."
    else
      status=$?
      echo "  ✗ Failed (exit $status)."
      exit "$status"
    fi

    echo ""
    echo "  ⚠ Now patch wrangler.jsonc:"
    echo "    Replace REPLACE_WITH_DEV_D1_ID with the dev database_id."
    echo "    Replace REPLACE_WITH_PROD_D1_ID with the production database_id."
    ;;
  *)
    echo ""
    echo "  Skipped. To create D1 databases later:"
    echo "    pnpm exec wrangler d1 create template-cf-fullstack-dev"
    echo "    pnpm exec wrangler d1 create template-cf-fullstack-prod"
    echo "    Then patch wrangler.jsonc with the printed IDs."
    ;;
esac

# 5. Apply local migrations if there are any
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
