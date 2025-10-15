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
- **y-webrtc** - WebRTC provider for Yjs, enables P2P data synchronization
- **Wagmi + Viem** - Ethereum wallet connection and blockchain interactions
- **Canvas API** - HTML5 canvas for drawing and rendering
- **SIWE (Sign-In With Ethereum)** - Cryptographic player authentication with signatures (optional)

### Backend (`signaling-server/`)
- **Bun** - Fast JavaScript runtime for the signaling server
- **WebSocket** - Real-time signaling for WebRTC peer discovery
- **Room-based architecture** - Isolated game sessions with peer management

### WebRTC & Networking
- **WebRTC** - Peer-to-peer connections for low-latency gameplay
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
  - First 8 players can actively participate
  - Additional players become spectators (view-only mode)
  - Spectators see game but cannot guess or affect results
- **Word Length Hints** - Players see underlines representing letter count
- **Real-time Guessing** - Chat-based guessing with instant feedback
- **Timer System** - Configurable game duration (30s to 5min)
- **PNG Export** - Canvas snapshots with game metadata
- **Blockchain Integration** (Optional)
  - Create games on-chain with verifiable commitments
  - Record results and scores permanently
  - Track player wins across all games
  - Query game history via event logs

## Structure

- **`game-app/`** - Main Nuxt application for the game interface
  - Built with Nuxt 3, Vue 3, and Nuxt UI
  - WebRTC-based peer-to-peer multiplayer
  - Wallet integration with Wagmi
  - BIP-39 word dictionaries
  - SIWE authentication support
  
- **`signaling-server/`** - WebSocket signaling server for WebRTC coordination
  - Room-based peer management
  - Signal relay for WebRTC connections
  - Docker-ready for easy deployment

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

**Game Versions:**

The app includes three different versions of the game with progressive features:

- **`/game/[id]`** - Basic P2P game with no blockchain features
  - Pure WebRTC multiplayer
  - Local cryptographic commitments only
  - Example: `http://localhost:3000/game/1`

- **`/game-siwe/[id]`** - Adds SIWE (Sign-In With Ethereum) authentication
  - Optional wallet connection
  - Cryptographic signature-based identity verification
  - No on-chain transactions
  - Example: `http://localhost:3000/game-siwe/2`

- **`/game-contract/[id]`** - Full blockchain integration (recommended)
  - SIWE authentication support
  - Optional on-chain game creation and result recording
  - Smart contract commit-reveal mechanics
  - Track wins and game history on-chain
  - Example: `http://localhost:3000/game-contract/3`

**Testing the connection:**
- Visit `http://localhost:3000/test-signaling` to test the signaling server connection
- Open multiple browser tabs/windows to test peer-to-peer connections
- Join the same room ID in different tabs to see peers connect
- Try different game versions by changing the URL path

> **⚠️ Local Testing Limitations:**
> - WebRTC connections work between **multiple tabs in the same browser** locally
> - Cross-browser connections (e.g., Chrome ↔ Firefox) typically **don't work on localhost**
> - For cross-browser or cross-device testing, you need to:
>   1. Deploy the app to a public URL (HTTPS required)
>   2. Configure TURN servers for NAT traversal (already configured in the app)
> - This is a WebRTC limitation, not a bug in the app

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

## Features

### ✅ Implemented
- **P2P Multiplayer** - WebRTC-based real-time gameplay with no central server
- **BIP-39 Word Lists** - Curated, difficulty-based word selection from Bitcoin's BIP-39 standard
- **Smart Contract Integration** - Optional on-chain game creation and result recording
- **Commit-Reveal Mechanics** - Cryptographic commitments prevent host cheating
- **SIWE Authentication** - Sign-in with Ethereum for verified player identities
- **8-Player Limit + Spectators** - Active player cap with unlimited spectator viewing
- **Real-time Drawing & Guessing** - Low-latency canvas synchronization and chat
- **PNG Export** - Save and share game drawings with metadata

### 🚧 Future Development Ideas

#### NFT & Marketplace Features
- **Mint Drawings as NFTs** - Convert game art to collectible NFTs
  - Store images on IPFS with on-chain metadata
  - Auto-mint for winners or manual minting by host
  - ERC-721 standard with ERC-2981 royalties
- **NFT Gallery** - Browse all minted game drawings
  - Query past games via blockchain events
  - Filter by artist, word, date, difficulty
  - OpenSea/Rarible marketplace integration
- **Royalty System** - Automatic artist compensation on secondary sales
  - Split royalties between artist and platform
  - ERC-2981 standard for marketplace compatibility

#### Enhanced Blockchain Features
- **Game History** - Query and display past games from on-chain events
  - Event-based indexing (eth_getLogs)
  - The Graph subgraph for advanced queries
  - Leaderboards and player statistics
- **ENS Integration** - Display ENS names instead of wallet addresses
- **Token Rewards** - ERC-20 tokens for winners and achievements
- **Tournament System** - Bracket-style competitions with prize pools
- **DAO Governance** - Community-driven word lists and game rules

#### Decentralization
- **Decentralized Signaling** - Replace WebSocket server with:
  - IPFS PubSub for peer discovery
  - libp2p for P2P networking
  - Statement protocol for WebRTC signaling
- **IPFS Storage** - Store drawings and metadata on IPFS
  - Pinning via Pinata, NFT.Storage, or Web3.Storage
  - Content-addressed, immutable storage

#### Additional Features
- **Replay System** - Record and replay drawing sessions
- **Cross-chain Support** - Deploy on multiple L2s (Base, Arbitrum, Optimism)
- **Achievement System** - NFT badges for milestones
- **AI Judge** - ML-based drawing quality validation
- **Staking Mechanics** - Bet on game outcomes
