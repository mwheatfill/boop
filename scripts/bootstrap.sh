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

# 1a. GitHub owner/repo rewrite. The template self-refs to
# "mwheatfill/template-cf-fullstack" in the homepage cards and a few
# README links. Auto-detect from git remote; prompt to override.

default_gh_repo=""
if git_remote=$(git remote get-url origin 2>/dev/null); then
  default_gh_repo=$(echo "$git_remote" | sed -E 's|^.*github\.com[:/]([^/]+/[^/.]+)(\.git)?$|\1|')
fi

prompt_default="${default_gh_repo:-skip}"
if [[ -n "${BOOTSTRAP_GH_REPO:-}" ]]; then
  gh_repo="$BOOTSTRAP_GH_REPO"
  echo "▶ GitHub repo for self-refs: $gh_repo (from BOOTSTRAP_GH_REPO)"
else
  read -r -p "▶ GitHub repo for self-refs (OWNER/REPO) [${prompt_default}]: " gh_repo
fi
gh_repo="${gh_repo:-$prompt_default}"

if [[ "$gh_repo" != "skip" && "$gh_repo" != "mwheatfill/template-cf-fullstack" ]]; then
  if [[ ! "$gh_repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo "  ✗ Expected OWNER/REPO format."
    exit 1
  fi
  echo "▶ Rewriting mwheatfill/template-cf-fullstack -> ${gh_repo}..."
  for f in "${files_to_rename[@]}"; do
    if [[ -f "$f" ]]; then
      "${SED_INPLACE[@]}" "s|mwheatfill/template-cf-fullstack|${gh_repo}|g" "$f"
    fi
  done
  echo "  ✓ Self-refs rewritten. The recipes repo (mwheatfill/app-platform-recipes) is unchanged."
fi

# 1b. App rename: find/replace the template name across configs and docs.

if [[ -n "${BOOTSTRAP_APP_NAME:-}" ]]; then
  app_name="$BOOTSTRAP_APP_NAME"
  echo "▶ App name: $app_name (from BOOTSTRAP_APP_NAME)"
else
  read -r -p "▶ App name (alphanumeric + dashes) [${DEFAULT_NAME}]: " app_name
fi
app_name="${app_name:-$DEFAULT_NAME}"

if [[ ! "$app_name" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  echo "  ✗ Name must be lowercase alphanumeric + dashes (Cloudflare Worker naming rule)."
  exit 1
fi

if [[ "$app_name" != "$DEFAULT_NAME" ]]; then
  echo ""
  echo "▶ Renaming $DEFAULT_NAME -> $app_name across the repo..."

  for f in "${files_to_rename[@]}"; do
    if [[ -f "$f" ]]; then
      "${SED_INPLACE[@]}" "s/${DEFAULT_NAME}/${app_name}/g" "$f"
      echo "  ~ $f"
    fi
  done

  "${SED_INPLACE[@]}" "s/^DEFAULT_NAME=\"${DEFAULT_NAME}\"/DEFAULT_NAME=\"${app_name}\"/" \
    "scripts/bootstrap.sh" || true
  echo "  ~ scripts/bootstrap.sh (DEFAULT_NAME)"

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
  "${SED_INPLACE[@]}" "s/${DEFAULT_NAME}/${app_name}/g" .dev.vars
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
if [[ -n "${BOOTSTRAP_CREATE_D1:-}" ]]; then
  create_d1="$BOOTSTRAP_CREATE_D1"
  echo "  Create your own D1 databases? $create_d1 (from BOOTSTRAP_CREATE_D1)"
else
  read -r -p "  Create your own D1 databases? [y/N] " create_d1
fi

create_d1_and_patch() {
  local label="$1"
  local db_name="$2"
  local existing_id="$3"

  echo ""
  echo "▶ Creating ${label} D1 (${db_name})..."
  local output
  if ! output=$("${WRANGLER[@]}" d1 create "$db_name" 2>&1); then
    echo "$output"
    echo "  ✗ Failed to create ${db_name}. Common causes: not logged in, name taken, quota."
    exit 1
  fi
  echo "$output"

  local new_id
  new_id=$(echo "$output" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  if [[ -z "$new_id" ]]; then
    echo "  ✗ Could not parse new database_id from wrangler output."
    exit 1
  fi
  "${SED_INPLACE[@]}" "s/${existing_id}/${new_id}/" wrangler.jsonc
  echo "  ✓ Patched ${label} database_id in wrangler.jsonc: ${new_id}"
}

case "${create_d1:-N}" in
  [Yy]*)
    existing_dev_id=$(grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' wrangler.jsonc | sed -n '1p')
    existing_prod_id=$(grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' wrangler.jsonc | sed -n '2p')
    if [[ -z "$existing_dev_id" || -z "$existing_prod_id" ]]; then
      echo "  ✗ Could not locate the two database_id values in wrangler.jsonc."
      exit 1
    fi
    create_d1_and_patch "dev" "${app_name}-dev" "$existing_dev_id"
    create_d1_and_patch "production" "${app_name}-prod" "$existing_prod_id"
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
echo "     (See README, CI/CD section, for what these need.)"
echo "  3. Install capabilities from https://github.com/mwheatfill/app-platform-recipes"
echo "     For example:"
echo "       curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh \\"
echo "         | bash -s -- auth/better-auth"
echo "  4. Run 'pnpm dev' to start the dev server."
echo ""
