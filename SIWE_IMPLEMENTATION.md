# SIWE Authentication Implementation

## Overview
SIWE (Sign-In with Ethereum) authentication has been integrated into the `game-siwe` directory (`/game-app/pages/game-siwe/[id].vue`). The implementation is **optional** and shows which players are authenticated vs anonymous.

## Features Implemented

### 1. Wallet Connection
- Added `WalletConnect` component to the lobby
- Supports MetaMask, WalletConnect, Coinbase Wallet, and other injected wallets
- Displays connected wallet address with copy functionality

### 2. SIWE Authentication Flow
- **Optional authentication**: Players can play anonymously or authenticate with their wallet
- **Sign-In button**: After connecting wallet, players can sign a message to verify ownership
- **EIP-4361 compliant**: Uses standard SIWE message format
- **Peer verification**: All peers can verify each other's signatures using the existing `useSIWE` composable

### 3. Visual Indicators
Players with SIWE authentication are marked with:
- 🔐 Lock icon next to their name
- Truncated Ethereum address displayed (e.g., `0x1234...5678`) in monospace font
- Green text color for verified status
- Shows in all player lists:
  - Lobby waiting screen
  - Word selection waiting screen
  - Collapsible player list during gameplay

### 4. Technical Implementation

#### Modified Files:
1. **`/game-app/pages/game-siwe/[id].vue`**
   - Added wagmi hooks (`useAccount`, `useSignMessage`)
   - Integrated `useSIWE` composable
   - Added wallet connection UI in lobby
   - Updated all player lists to show authentication status
   - Added `isPeerAuthenticated()` function to check verification status
   - Added `getPeerAddress()` function to display truncated wallet addresses

2. **`/game-app/composables/useDrawingGame.ts`**
   - Added `setWalletAddress()` function to update awareness
   - Exposed `getYRoom()` to access yroom for SIWE initialization
   - Wallet addresses are now tracked in peer awareness state

#### Key Components:
- **`WalletConnect.vue`**: Handles wallet connection/disconnection
- **`useSIWE.ts`**: Existing composable for SIWE signature creation and verification

### 5. How It Works

1. **Player connects wallet** → Wallet address stored in awareness state
2. **Player clicks "Sign Message to Verify"** → SIWE message created with:
   - User's Ethereum address
   - Room-specific statement (prevents cross-room replay)
   - Unique nonce (prevents replay attacks)
   - Timestamp (signatures expire after 1 hour)
3. **Signature stored in Yjs** → All peers can verify the signature
4. **Visual indicators update** → 🔐 icon appears next to verified players

### 6. Security Features
- **Room binding**: Signatures are bound to specific rooms
- **Nonce tracking**: Prevents replay attacks
- **Timestamp validation**: Signatures expire after 1 hour
- **Peer verification**: All peers can independently verify signatures
- **No server required**: Fully decentralized verification using viem

## Usage

### For Players:
1. Navigate to `/game-siwe/[room-id]`
2. Enter your name (required)
3. **Optional**: Click "Connect Wallet" to connect your Ethereum wallet
4. **Optional**: Click "Sign Message to Verify" to authenticate
5. Start playing! Authenticated players will have a 🔐 icon

### For Developers:
```typescript
// Check if a peer is authenticated
const isAuthenticated = isPeerAuthenticated(peerId)

// The peer's wallet address is available in awareness
const peer = peers.value.find(p => p.id === peerId)
const walletAddress = peer?.address
```

## Future Enhancements
- Token-gated rooms (require specific NFT/token to join)
- On-chain leaderboards
- NFT rewards for winners
- Reputation system based on verified addresses
- Integration with ENS for display names
