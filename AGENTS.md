# sk3chy agent notes

## repo map
- Root is a Nuxt 3 + Vue 3 app packaged as a Polkadot Host product SPA
- `pages/` — Game pages (`play/[id]`, `game-subs/[id]`, etc.)
- `composables/` — Vue composables (game logic, blockchain, auth)
- `lib/` — Framework-agnostic modules (host CRDT, Statement Store CRDT fallback, blockchain client)
- `utils/` — Pure utilities (word dictionaries, chain config, ABIs)
- `tests/` — Playwright E2E tests
- `docs/` — Development decision logs and screenshots
- `bundle/manifest.toml` — Product manifest template copied into `dist/`
- `scripts/` — Product build/deploy scripts

## common commands (bun)
- install: `bun install`
- dev: `bun dev`
- build: `bun build`
- product build: `APP_DOTNS_DOMAIN=sk3chy.dot bun run build:product`
- product deploy: `APP_DOTNS_DOMAIN=sk3chy.dot bun run deploy:product`
- preview: `bun preview`
- test: `bun test` (Playwright E2E across Chromium + Firefox)
- unit tests: `bun run test:unit`
- deterministic CRDT smoke: `bun run test:crdt`
- live Statement Store CRDT smoke:
  - `LIVE_STATEMENT_STORE_WS=wss://previewnet.substrate.dev/people LIVE_STATEMENT_STORE_MNEMONIC="..." bun run test:crdt:live`
  - use only disposable credentials with Statement Store allowance

## environment variables
- `NUXT_PUBLIC_STATEMENT_STORE_WS` (statement store WS endpoint, default: PreviewNet)
- `NUXT_PUBLIC_STATEMENT_STORE_SIGNING` (`ephemeral`, `wallet`, or `mnemonic`)
- `NUXT_PUBLIC_TURN_USERNAME`, `NUXT_PUBLIC_TURN_CREDENTIAL`
- `NUXT_PUBLIC_CONTRACT_ADDRESS`
- `NUXT_PUBLIC_PINATA_JWT`, `NUXT_PUBLIC_PINATA_GATEWAY`
- `NUXT_PUBLIC_NFT_CONTRACT_ADDRESS`
- `NUXT_PUBLIC_PRODUCT_DOTNS` (usually `sk3chy.dot` for product builds)
- `NUXT_PUBLIC_SUBSTRATE_RPC_HTTP`, `NUXT_PUBLIC_SUBSTRATE_RPC_WS`
- `NUXT_PUBLIC_SUBSTRATE_GENESIS_HASH`
See `.env.example` and `nuxt.config.ts`.
- `.env.deploy.local` may contain deploy credentials and must stay untracked.

## blockchain integration
- Legacy EVM wallet stack: `@wagmi/vue` + `viem`
  - config: `wagmi.ts`, `plugins/wagmi.ts`
  - chain: `utils/chains.ts` (Paseo Asset Hub)
- contract use: `composables/useGameContract.ts`
- Product host integration uses `@parity/product-sdk-host`.
- Product-host account/signing lives in `composables/useProductHost.ts`.
- PAPI client should prefer the host provider inside a product container, falling back to WS RPC outside the host.

## CRDT notes
- The app creates Yjs rooms in `plugins/yjs.client.ts`.
- Preferred runtime path inside a host:
  - `window.host.ext.crdt` via `HostCrdtProvider` when the host provides it.
  - Statement Store fallback via `StatementStoreCrdtProvider` when host CRDT is absent.
- `StatementStoreCrdtProvider` uses `@parity/product-sdk-host` Statement Store first and direct `@polkadot-api/sdk-statement` RPC as a fallback.
- The deterministic Playwright CRDT test uses `tests/mock-statement-store.ts`.
- The live CRDT test writes real statements under `sk3chy:crdt:*` room topics.

## product/deploy notes
- Target DotNS domain is `sk3chy.dot`.
- Target deploy environment is `paseo-next-v2`.
- Product runtime defaults to Paseo Next v2 Asset Hub:
  - WS: `wss://paseo-asset-hub-next-rpc.polkadot.io`
  - genesis: `0xbf0488dbe9daa1de1c08c5f743e26fdc2a4ecd74cf87dd1b4b1eeb99ae4ef19f`
- `bulletin-deploy.config.ts` publishes product metadata where possible.
- `app.sk3chy.dot` may be owned by a different address; root contenthash deploy can still succeed while manifest subname publish fails.
- `dothost.org` sandbox can block `localStorage`; startup code must tolerate storage exceptions and use product-host identity/bridges where available.
- `dist/`, `.output/`, `.nuxt/`, and test artifacts are ignored build outputs and should not be committed.

## work conventions
- Keep changes scoped; this repo has no enforced lint/format step.
- Prefer updating docs alongside workflow changes.
- Never store secrets or seed phrases in source control (env files, commits, docs).

## planned direction (user request)
- Target Paseo Asset Hub with contracts on `pallet-revive`:
  - allowed: Solidity or Rust on `pallet-revive`
  - do not use ink!
- Migrate from EVM wallets to Substrate wallets; target common wallets
  - Polkadot{.js} extension, Talisman, Subwallet
- Use `mapAddress` to interact with `pallet-revive` contracts.
- Mapping details (pallet-revive):
  - H160 is derived from SS58 pubkey: `keccak256(pubkey)[12..32]`
  - Required before contract calls (else `OriginMustBeMapped`)
  - Extrinsics: `Revive.map_account()` (map), `Revive.unmap_account()` (unmap)
- RPCs: keep current HTTP RPCs; add WS endpoints when available.
- Auth: use Substrate-native sign-in (sign bytes) + map to EVM address; no SIWE.
- Preferred wallet UI/SDK: DOTConnect (Reactive DOT), without WalletConnect.
- Preferred chain API: PAPI (polkadot-api).
- Paseo Asset Hub defaults:
  - Substrate WS: `wss://sys.ibp.network/asset-hub-paseo`
  - EVM RPC: `https://services.polkadothub-rpc.com/testnet`
  - EVM chain id: `420420417`
