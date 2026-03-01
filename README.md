# sk3chy

A peer-to-peer multiplayer drawing game with WebRTC for real-time gameplay and blockchain integration. Players compete to guess what the host is drawing, with cryptographic commitments ensuring fair play. Features BIP-39 word lists and optional on-chain game recording.

## Tech Stack

- **Nuxt 3** + **Vue 3** — Game UI with Composition API and Nuxt UI
- **Yjs** — CRDT for real-time collaborative state (game state, drawing strokes, presence)
- **WebRTC** — Peer-to-peer connections for low-latency gameplay
- **Statement Store** — Substrate People chain for decentralized WebRTC signaling (no server needed)
- **Polkadot Asset Hub** — On-chain NFT minting and game recording
- **Canvas API** — HTML5 canvas for drawing and rendering

### Game Mechanics
- **BIP-39 Word Lists** — ~800+ drawable words organized by difficulty
- **Cryptographic Commitments** — keccak256 hash with random salt prevents cheating
- **8-Player Limit with Spectator Mode**
- **Word Length Hints** — Players see underlines representing letter count
- **Timer System** — Configurable game duration (30s to 5min)
- **PNG Export** — Canvas snapshots with game metadata

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

Copy `.env.example` to `.env` and configure:

- `NUXT_PUBLIC_STATEMENT_STORE_WS` — Statement store WebSocket endpoint (default: PreviewNet)
- `NUXT_PUBLIC_STATEMENT_STORE_SIGNING` — Signing mode (`mnemonic`, `ephemeral`, or `wallet`)
- `NUXT_PUBLIC_TURN_USERNAME` / `NUXT_PUBLIC_TURN_CREDENTIAL` — Optional TURN relay credentials

### Game Pages

- **`/play/[id]`** — Main game (statement store signaling, on-chain registration)
- **`/game-subs/[id]`** — Hybrid substrate game (statement store, ephemeral signing)
- **`/test-ss-signaling`** — Statement store connection test page

### Testing

```bash
bun test
```

Runs Playwright E2E tests across Chromium and Firefox with 3 participants using the real PreviewNet Statement Store.

Manual testing:
1. Open `http://localhost:3000/play/test1` in two browser tabs
2. Complete on-chain username registration if prompted
3. Both tabs should discover each other via statement store signaling

### Production

```bash
bun build
```

Deploy to any Nuxt-compatible hosting platform (Vercel, Netlify, etc.)
