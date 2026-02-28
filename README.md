# sk3chy

A peer-to-peer multiplayer drawing game with WebRTC for real-time gameplay and blockchain integration. Players compete to guess what the host is drawing, with cryptographic commitments ensuring fair play. Features BIP-39 word lists and optional on-chain game recording.

## Tech Stack

### Frontend (`game-app/`)
- **Nuxt 3** - Vue.js framework for the game interface
- **Vue 3** - Reactive UI components with Composition API
- **Nuxt UI** - Pre-built UI components built on Tailwind CSS
- **Yjs** - CRDT (Conflict-free Replicated Data Type) for real-time collaborative state
  - Syncs game state, player positions, and drawing strokes across all peers
  - Provides awareness API for presence (cursors, colors, names)
- **Statement Store** - Substrate People chain for decentralized WebRTC signaling (no server needed)
- **Wagmi + Viem** - Ethereum wallet connection and blockchain interactions
- **Canvas API** - HTML5 canvas for drawing and rendering

### WebRTC & Networking
- **WebRTC** - Peer-to-peer connections for low-latency gameplay
- **Statement Store Signaling** - Decentralized peer discovery via Substrate People chain
- **STUN servers** - NAT traversal for direct P2P connections (Google STUN)
- **TURN servers** - Relay fallback for restrictive networks (Metered.ca)
- **ICE (Interactive Connectivity Establishment)** - Connection negotiation

### Smart Contracts (`contracts/`)
- **Foundry** - Ethereum development framework for smart contracts
- **Solidity 0.8.20** - Smart contract language
- **Sk3chyGame.sol** - Main game contract with commit-reveal mechanics
  - On-chain game creation and tracking
  - Cryptographic word commitments (keccak256)
  - Score recording and winner tracking
  - Event-based architecture for gas efficiency
- **Polkadot Asset Hub** - Deployment target (EVM-compatible parachain)

### Game Mechanics
- **BIP-39 Word Lists** - Curated word dictionaries from Bitcoin's BIP-39 standard
  - ~800+ drawable words organized by difficulty (Easy/Medium/Hard)
  - Categorized by type (Animals, Nature, Objects, Food, Actions, etc.)
  - Ensures fair, recognizable words for all players
- **Cryptographic Commitments** - Host commits to word choice before game starts
  - Uses keccak256 hash with random salt
  - Prevents cheating by revealing word only after game ends
  - All peers verify commitment matches revealed word
  - Optional on-chain recording via smart contract
- **8-Player Limit with Spectator Mode** - Active player cap with overflow spectating
- **Word Length Hints** - Players see underlines representing letter count
- **Real-time Guessing** - Chat-based guessing with instant feedback
- **Timer System** - Configurable game duration (30s to 5min)
- **PNG Export** - Canvas snapshots with game metadata

## Structure

- **`game-app/`** - Main Nuxt application for the game interface
  - Built with Nuxt 3, Vue 3, and Nuxt UI
  - WebRTC-based peer-to-peer multiplayer
  - Statement store signaling (fully decentralized, no server)
  - Wallet integration with Wagmi
  - BIP-39 word dictionaries

- **`contracts/`** - Solidity smart contracts for on-chain game tracking
  - Foundry-based development environment
  - Sk3chyGame.sol with commit-reveal mechanics
  - Deployment scripts for Polkadot Asset Hub
  - See `contracts/README.md` for deployment instructions

## Getting Started

### Install Dependencies

```bash
bun install
```

### Development

```bash
bun dev
```

The game app will be available at `http://localhost:3000`.

### Environment

Copy `game-app/.env.example` to `game-app/.env` and configure:

- `NUXT_PUBLIC_STATEMENT_STORE_WS` — Statement store WebSocket endpoint (default: PoP People testnet)
- `NUXT_PUBLIC_STATEMENT_STORE_SIGNING` — Signing mode (`mnemonic`, `ephemeral`, or `wallet`)
- `NUXT_PUBLIC_TURN_USERNAME` / `NUXT_PUBLIC_TURN_CREDENTIAL` — Optional TURN relay credentials

### Game Pages

- **`/play/[id]`** — Main game (statement store signaling, mnemonic/external signing, registration gate)
- **`/game-subs/[id]`** — Hybrid substrate game (statement store, ephemeral signing)
- **`/test-ss-signaling`** — Statement store connection test page

### Testing

1. Open `http://localhost:3000/play/test1` in two browser tabs
2. Complete on-chain username registration if prompted
3. Both tabs should discover each other via statement store signaling

> **Note:** WebRTC connections work between multiple tabs in the same browser locally.
> Cross-browser or cross-device testing requires HTTPS and optionally TURN servers.

### Production

```bash
bun build
```

## Deployment

### Game App
Deploy the `game-app` directory to any Nuxt-compatible hosting platform (Vercel, Netlify, etc.)

## Workspaces

This monorepo uses Bun workspaces to manage packages.
