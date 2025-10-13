# sk3tchy

A peer-to-peer multiplayer drawing game with WebRTC for real-time gameplay. Players compete to guess what the host is drawing, with cryptographic commitments ensuring fair play.

## Tech Stack

### Frontend (`game-app/`)
- **Nuxt 3** - Vue.js framework for the game interface
- **Vue 3** - Reactive UI components with Composition API
- **Nuxt UI** - Pre-built UI components built on Tailwind CSS
- **Yjs** - CRDT (Conflict-free Replicated Data Type) for real-time collaborative state
  - Syncs game state, player positions, and drawing strokes across all peers
  - Provides awareness API for presence (cursors, colors, names)
- **y-webrtc** - WebRTC provider for Yjs, enables P2P data synchronization
- **Wagmi + Viem** - Ethereum wallet connection and blockchain interactions
- **Canvas API** - HTML5 canvas for drawing and rendering
- **SIWE (Sign-In With Ethereum)** - Cryptographic player authentication (optional)

### Backend (`signaling-server/`)
- **Bun** - Fast JavaScript runtime for the signaling server
- **WebSocket** - Real-time signaling for WebRTC peer discovery
- **Room-based architecture** - Isolated game sessions with peer management

### WebRTC & Networking
- **WebRTC** - Peer-to-peer connections for low-latency gameplay
- **STUN servers** - NAT traversal for direct P2P connections (Google STUN)
- **TURN servers** - Relay fallback for restrictive networks (Metered.ca)
- **ICE (Interactive Connectivity Establishment)** - Connection negotiation

### Game Mechanics
- **Cryptographic Commitments** - Host commits to word choice before game starts
  - Uses SHA-256 hash with random salt
  - Prevents cheating by revealing word only after game ends
  - All peers verify commitment matches revealed word
- **Word Length Hints** - Players see underlines representing letter count
- **Real-time Guessing** - Chat-based guessing with instant feedback
- **Timer System** - Configurable game duration (30s to 5min)
- **PNG Export** - Canvas snapshots with game metadata

## Structure

- **`game-app/`** - Main Nuxt application for the game interface
  - Built with Nuxt 3, Vue 3, and Nuxt UI
  - WebRTC-based peer-to-peer multiplayer
  - Wallet integration with Wagmi
  
- **`signaling-server/`** - WebSocket signaling server for WebRTC coordination
  - Room-based peer management
  - Signal relay for WebRTC connections
  - Docker-ready for easy deployment

## Getting Started

### Install Dependencies

```bash
bun install
```

### Development

**Terminal 1 - Start the signaling server:**
```bash
cd signaling-server
bun install
bun run dev
```

**Terminal 2 - Start the game app:**
```bash
cd game-app
bun install
bun run dev
```

The game app will be available at `http://localhost:3000` and the signaling server at `ws://localhost:4444`.

**Testing the connection:**
- Visit `http://localhost:3000/test-signaling` to test the signaling server connection
- Open multiple browser tabs/windows to test peer-to-peer connections
- Join the same room ID in different tabs to see peers connect

### Production

```bash
# Build the game app
bun build

# Start the signaling server
bun start:signaling
```

## Deployment

### Game App
Deploy the `game-app` directory to any Nuxt-compatible hosting platform (Vercel, Netlify, etc.)

### Signaling Server
The signaling server can be deployed separately to:
- Railway
- Any Docker-compatible hosting

See `signaling-server/README.md` for detailed deployment instructions.

## Workspaces

This monorepo uses Bun workspaces to manage multiple packages.

## Future Development Ideas

### Full Decentralization
- **Remove custom signaling server** - Replace WebSocket signaling with decentralized alternatives:
  - **Statement** - Decentralized signaling protocol for WebRTC
  - **IPFS PubSub** - Use IPFS publish/subscribe for peer discovery and signaling
  - **libp2p** - Peer-to-peer networking stack with built-in discovery
- **Benefits**: No single point of failure, censorship-resistant, truly P2P

### On-Chain Registration
- **Smart contract-based game sessions** - Players execute transactions to join games
  - Prevents Sybil attacks (costs gas to join)
  - Verifiable player identity via wallet addresses
  - On-chain record of game participation
- **Room registry contract** - Track active games and players on-chain
- **ENS integration** - Display ENS names instead of addresses
- **Leaderboard contract** - Persistent stats and rankings

### NFT Generation
- **Mint drawings as NFTs** - Convert game drawings to on-chain collectibles
  - Store PNG on IPFS/Arweave
  - Metadata includes word, winner, timestamp, players
  - Collaborative artwork ownership
- **Achievement NFTs** - Reward players for milestones
  - First win, win streak, perfect guesses, etc.
- **Dynamic NFTs** - Update metadata based on game outcomes
- **Royalties** - Split between artist (drawer) and winner

### Decentralized Storage
- **IPFS** - Store game drawings and metadata on IPFS
  - Pin images via Pinata, NFT.Storage, or Web3.Storage
  - Content-addressed storage (immutable URLs)
- **Bulletin Chain Storage** - Alternative permanent storage solution
  - On-chain data availability for critical game state
  - Cheaper than storing full images on L1

### Additional Ideas
- **Token rewards** - ERC-20 tokens for winners
- **Staking mechanics** - Bet on game outcomes
- **DAO governance** - Community-driven word lists and game rules
- **Cross-chain support** - Deploy on multiple L2s (Base, Arbitrum, Optimism)
- **Replay system** - Store and replay drawing sessions
- **AI judge** - Use ML to validate drawing quality
