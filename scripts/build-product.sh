#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${APP_DOTNS_DOMAIN:-sk3chy.dot}"
if [[ "$DOMAIN" != *.dot ]]; then
  DOMAIN="${DOMAIN}.dot"
fi

cd "$ROOT_DIR"

echo "==> Building sk3chy product for ${DOMAIN}"
NUXT_APP_BASE_URL="${NUXT_APP_BASE_URL:-./}" \
NUXT_PUBLIC_PRODUCT_DOTNS="${NUXT_PUBLIC_PRODUCT_DOTNS:-$DOMAIN}" \
bun generate

rm -rf dist
mkdir -p dist
cp -R .output/public/. dist/
sed "s/^id = .*/id = \"${DOMAIN}\"/" bundle/manifest.toml > dist/manifest.toml

echo "==> Product archive staged in dist/"
