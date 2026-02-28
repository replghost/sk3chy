# sk3tchy agent notes

## repo map
- `game-app/`: Nuxt 3 + Vue 3 frontend (WebRTC game, wallet/contract UI, SIWE).
- `contracts/`: Foundry Solidity contracts (Sk3chyGame) and deployment scripts.

## common commands (bun)
- install: `bun install`
- app dev: `bun dev` (game-app)
- build app: `bun build`
- preview app: `bun preview`

## contracts (foundry)
- build: `forge build`
- test: `forge test`
- deploy (asset hub testnet): see `contracts/README.md` / `contracts/DEPLOY_PASSET_HUB.md`

## environment variables (frontend)
- `NUXT_PUBLIC_STATEMENT_STORE_WS` (statement store WS endpoint)
- `NUXT_PUBLIC_STATEMENT_STORE_SIGNING` (`ephemeral`, `wallet`, or `mnemonic`)
- `NUXT_PUBLIC_TURN_USERNAME`, `NUXT_PUBLIC_TURN_CREDENTIAL`
- `NUXT_PUBLIC_CONTRACT_ADDRESS`
- `NUXT_PUBLIC_PINATA_JWT`, `NUXT_PUBLIC_PINATA_GATEWAY`
- `NUXT_PUBLIC_NFT_CONTRACT_ADDRESS`
See `game-app/.env.example` and `game-app/nuxt.config.ts`.

## current blockchain integration (EVM)
- EVM wallet stack: `@wagmi/vue` + `viem`
  - config: `game-app/wagmi.ts`, `game-app/plugins/wagmi.ts`
  - chain: `game-app/utils/chains.ts` (Passet Hub EVM RPC; deprecated/temporary)
- contract use: `game-app/composables/useGameContract.ts`
- SIWE: `game-app/composables/useSIWE.ts`, `game-app/pages/game-siwe/[id].vue`, `game-app/pages/siwe.vue`
- UI entrypoints: `game-app/pages/game-contract/[id].vue`, `game-app/components/WalletConnect.vue`

## WebRTC notes
- WebRTC P2P + Yjs; signaling exclusively via statement store (Substrate People chain).
- Statement store signaling uses `NUXT_PUBLIC_STATEMENT_STORE_WS`.
- Local testing works best in multiple tabs of the same browser.

## work conventions
- Keep changes scoped; this repo has no enforced lint/format step.
- Prefer updating docs alongside workflow changes (README + `game-app/CONTRACT_INTEGRATION.md`).
- Never store secrets or seed phrases in source control (env files, commits, docs).

## planned direction (user request)
- Target Paseo Asset Hub with contracts on `pallet-revive`:
  - allowed: Solidity or Rust on `pallet-revive`
  - do not use ink!
- Do not use Passet Hub (temporary/decommissioning); use Paseo Asset Hub.
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
