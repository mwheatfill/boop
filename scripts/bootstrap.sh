#!/usr/bin/env bash
# template-cf-fullstack bootstrap
#
# Run once after cloning. Sets up the local environment so `pnpm dev`
# works, and offers to provision the Cloudflare resources you'll need
# before your first deploy.
#
# Idempotent: re-running skips work that's already done.

set -euo pipefail

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
if command -v npx >/dev/null 2>&1; then
  npx @tanstack/intent install || echo "  (intent install reported issues; continuing)"
else
  echo "  npx not found; skipping. Run 'npx @tanstack/intent install' manually."
fi

# 3. Generate openapi.json (in case it's stale)
echo ""
echo "▶ Generating openapi.json..."
pnpm openapi:generate

# 4. Optional: create Cloudflare D1 databases
echo ""
echo "▶ The template's wrangler.jsonc has placeholder D1 database IDs."
echo "  Real IDs are required before deploy. Want to create them now?"
echo "  (You'll need 'wrangler login' completed first.)"
echo ""
read -r -p "  Create D1 databases? [y/N] " create_d1

case "${create_d1:-N}" in
  [Yy]*)
    if ! command -v wrangler >/dev/null 2>&1 && ! pnpm exec wrangler --version >/dev/null 2>&1; then
      echo "  ✗ wrangler not found. Install Cloudflare's wrangler CLI and re-run."
      exit 1
    fi

    WRANGLER="pnpm exec wrangler"

    echo ""
    echo "▶ Creating dev D1..."
    $WRANGLER d1 create template-cf-fullstack-dev || echo "  (already exists or creation failed; check manually)"

    echo ""
    echo "▶ Creating production D1..."
    $WRANGLER d1 create template-cf-fullstack-prod || echo "  (already exists or creation failed; check manually)"

    echo ""
    echo "  ⚠ Copy the database_id from each 'wrangler d1 create' output above"
    echo "    and replace the REPLACE_WITH_DEV_D1_ID and REPLACE_WITH_PROD_D1_ID"
    echo "    placeholders in wrangler.jsonc."
    ;;
  *)
    echo ""
    echo "  Skipped. To create D1 databases later:"
    echo "    pnpm exec wrangler d1 create template-cf-fullstack-dev"
    echo "    pnpm exec wrangler d1 create template-cf-fullstack-prod"
    echo "    Then patch wrangler.jsonc with the printed IDs."
    ;;
esac

# 5. Run cf-typegen so DB binding shows up in worker-configuration.d.ts
echo ""
echo "▶ Regenerating Cloudflare worker types..."
pnpm cf-typegen >/dev/null 2>&1 || echo "  (cf-typegen reported issues; continuing)"

# 6. Apply local migrations if there are any
if compgen -G "drizzle/*.sql" > /dev/null; then
  echo ""
  echo "▶ Applying migrations to local D1..."
  pnpm db:migrate:local || echo "  (migrate reported issues; check manually)"
else
  echo ""
  echo "▶ No migrations yet; skipping db:migrate:local"
  echo "  Recipes that add tables (e.g. auth/better-auth) ship a migration"
  echo "  on install. Then run: pnpm db:generate && pnpm db:migrate:local"
fi

echo ""
echo "✅ Bootstrap complete."
echo ""
echo "Next steps:"
echo "  1. Edit .dev.vars with values for any recipes you plan to install."
echo "  2. Install capabilities from https://github.com/mwheatfill/app-platform-recipes"
echo "     For example: curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh \\"
echo "                    | bash -s -- auth/better-auth"
echo "  3. Run 'pnpm dev' to start the dev server."
echo ""
