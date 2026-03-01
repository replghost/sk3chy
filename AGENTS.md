# sk3tchy agent notes

## repo map
- Root is a Nuxt 3 + Vue 3 app (WebRTC game, wallet/contract UI)
- `pages/` — Game pages (`play/[id]`, `game-subs/[id]`, etc.)
- `composables/` — Vue composables (game logic, blockchain, auth)
- `lib/` — Framework-agnostic modules (ss-webrtc signaling, blockchain client)
- `utils/` — Pure utilities (word dictionaries, chain config, ABIs)
- `tests/` — Playwright E2E tests
- `docs/` — Development decision logs and screenshots

## common commands (bun)
- install: `bun install`
- dev: `bun dev`
- build: `bun build`
- preview: `bun preview`
- test: `bun test` (Playwright E2E across Chromium + Firefox)

## environment variables
- `NUXT_PUBLIC_STATEMENT_STORE_WS` (statement store WS endpoint, default: PreviewNet)
- `NUXT_PUBLIC_STATEMENT_STORE_SIGNING` (`ephemeral`, `wallet`, or `mnemonic`)
- `NUXT_PUBLIC_TURN_USERNAME`, `NUXT_PUBLIC_TURN_CREDENTIAL`
- `NUXT_PUBLIC_CONTRACT_ADDRESS`
- `NUXT_PUBLIC_PINATA_JWT`, `NUXT_PUBLIC_PINATA_GATEWAY`
- `NUXT_PUBLIC_NFT_CONTRACT_ADDRESS`
See `.env.example` and `nuxt.config.ts`.

## blockchain integration
- EVM wallet stack: `@wagmi/vue` + `viem`
  - config: `wagmi.ts`, `plugins/wagmi.ts`
  - chain: `utils/chains.ts` (Paseo Asset Hub)
- contract use: `composables/useGameContract.ts`

## WebRTC notes
- WebRTC P2P + Yjs; signaling exclusively via statement store (Substrate People chain).
- Default endpoint: PreviewNet (`wss://previewnet.substrate.dev/people`). PoP People also available.
- Local testing works best in multiple tabs of the same browser.

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
