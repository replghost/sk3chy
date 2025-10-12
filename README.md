# GameTime Phack Monorepo

A peer-to-peer multiplayer game platform built on Polkadot with WebRTC for real-time gameplay.

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
- Render
- DigitalOcean App Platform
- Fly.io
- Any Docker-compatible hosting

See `signaling-server/README.md` for detailed deployment instructions.

## Workspaces

This monorepo uses Bun workspaces to manage multiple packages.
