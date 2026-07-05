#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${APP_DOTNS_DOMAIN:-${1:-sk3chy.dot}}"
if [[ "$DOMAIN" != *.dot ]]; then
  DOMAIN="${DOMAIN}.dot"
fi

cd "$ROOT_DIR"

if [[ -f .env.deploy.local ]]; then
  set -a
  source .env.deploy.local
  set +a
fi

APP_DOTNS_DOMAIN="$DOMAIN" bash scripts/build-product.sh

if command -v bulletin-deploy >/dev/null 2>&1; then
  BULLETIN_DEPLOY=(bulletin-deploy)
else
  BULLETIN_DEPLOY=(npx -y bulletin-deploy@latest)
fi

PUBLISH_FLAG=()
if [[ "${PUBLISH:-}" == "1" ]]; then
  PUBLISH_FLAG=(--publish)
fi

BULLETIN_ENV="${BULLETIN_ENV:-paseo-next-v2}"

echo "==> Deploying ${DOMAIN} to Bulletin / DotNS"
if [[ ${#PUBLISH_FLAG[@]} -gt 0 ]]; then
  BULLETIN_DEPLOY_DOMAIN="$DOMAIN" "${BULLETIN_DEPLOY[@]}" "${PUBLISH_FLAG[@]}" --env "$BULLETIN_ENV" dist "$DOMAIN"
else
  BULLETIN_DEPLOY_DOMAIN="$DOMAIN" "${BULLETIN_DEPLOY[@]}" --env "$BULLETIN_ENV" dist "$DOMAIN"
fi

GATEWAY_BASE="${DOTNS_GATEWAY_BASE:-dot.li}"
LABEL="${DOMAIN%.dot}"
echo "==> Done. Live at https://${LABEL}.${GATEWAY_BASE}"
