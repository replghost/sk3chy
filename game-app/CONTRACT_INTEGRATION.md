# Smart Contract Integration Complete! 🎉

Your Sk3chyGame contract is now deployed and integrated with the frontend.

## Contract Details

- **Network**: Polkadot Asset Hub Testnet
- **Contract Address**: `0xd8Ceb2B3dCdC96F903a4A8927C8ed6B6265293d6`
- **Deployer**: `0xa2F70Cc9798171d3ef8fF7dAE91a76e8A1964438`
- **Transaction**: `0x5a3174ab19f76a6959b87620133d33910dd7212be4110e6eb0189cc6294fcbd7`
- **Block Explorer**: https://blockscout-passet-hub.parity-testnet.parity.io/address/0xd8Ceb2B3dCdC96F903a4A8927C8ed6B6265293d6

## Files Created/Updated

### New Files:
1. **`utils/chains.ts`** - PAsset Hub chain configuration
2. **`composables/useGameContract.ts`** - Contract interaction composable
3. **`utils/abi/Sk3chyGame.json`** - Contract ABI

### Updated Files:
1. **`wagmi.ts`** - Added PAsset Hub to supported chains

## How to Use in game-contract/[id].vue

### Import the composable:
```typescript
import { useGameContract } from '~/composables/useGameContract'

const {
  createGame,
  joinGame,
  commitWord,
  revealAndScore,
  useGameData,
  usePlayerWins,
  contractAddress,
  isPending,
} = useGameContract()
```

### Available Functions:

#### 1. Create Game (Host)
```typescript
const txHash = await createGame()
// Returns transaction hash
```

#### 2. Join Game (Players)
```typescript
const txHash = await joinGame(gameId)
// gameId: number
```

#### 3. Commit Word (Host, before game starts)
```typescript
const txHash = await commitWord(gameId, word, salt)
// word: string (e.g., "cat")
// salt: string (random string for security)
// Creates hash to prevent cheating
```

#### 4. Reveal and Score (Host, after game ends)
```typescript
const txHash = await revealAndScore(
  gameId,
  word,
  salt,
  winners,  // Array of winner addresses
  scores    // Array of scores
)
```

#### 5. Read Game Data
```typescript
const { data: gameData } = useGameData(gameId)
// Returns: { host, wordCommitment, createdAt, isActive }
```

#### 6. Read Player Wins
```typescript
const { data: wins } = usePlayerWins(playerAddress)
// Returns: number of total wins
```

## Integration Flow

### Game Start:
1. Host connects wallet
2. Host calls `createGame()` → Get on-chain gameId
3. Players call `joinGame(gameId)`
4. Host calls `commitWord(gameId, word, salt)` → Word is committed on-chain

### During Game:
- All gameplay happens off-chain (WebRTC/Yjs)
- Drawing, guessing, scoring tracked locally

### Game End:
1. Determine winners from local game state
2. Host calls `revealAndScore(gameId, word, salt, winners, scores)`
3. Contract verifies commitment matches reveal
4. Winners' total wins are incremented on-chain
5. Game marked as completed

## Network Switching

Users need to switch to PAsset Hub network in MetaMask:

**Network Details:**
- Network Name: Polkadot Asset Hub Testnet
- RPC URL: https://testnet-passet-hub-eth-rpc.polkadot.io
- Chain ID: 420420421
- Currency Symbol: DOT
- Block Explorer: https://blockscout-passet-hub.parity-testnet.parity.io

## Next Steps

1. **Update game-contract/[id].vue** to call contract functions
2. **Add UI for contract interactions**:
   - "Create Game" button (host)
   - "Join Game" button (players)
   - "Commit Word" (host, before game)
   - "Submit Results" (host, after game)
3. **Display on-chain data**:
   - Show total wins for each player
   - Show game status from contract
4. **Handle transaction states**:
   - Loading states while tx is pending
   - Success/error messages
   - Wait for confirmations

## Example Integration

```vue
<script setup lang="ts">
import { useGameContract } from '~/composables/useGameContract'
import { useAccount } from '@wagmi/vue'

const { address, isConnected } = useAccount()
const {
  createGame,
  joinGame,
  commitWord,
  revealAndScore,
  isPending,
} = useGameContract()

// When host starts game
async function handleCreateGame() {
  if (!isConnected.value) {
    alert('Please connect wallet')
    return
  }
  
  try {
    const txHash = await createGame()
    console.log('Game created!', txHash)
    // Wait for confirmation, then proceed
  } catch (error) {
    console.error('Failed to create game:', error)
  }
}

// When game ends
async function handleGameEnd() {
  const word = gameState.value.currentWord
  const salt = generateRandomSalt() // You need to implement this
  const winners = getWinners() // Get from game state
  const scores = getScores() // Get from game state
  
  try {
    const txHash = await revealAndScore(
      onChainGameId,
      word,
      salt,
      winners,
      scores
    )
    console.log('Results submitted!', txHash)
  } catch (error) {
    console.error('Failed to submit results:', error)
  }
}
</script>
```

## Testing

1. Connect MetaMask to PAsset Hub testnet
2. Get testnet DOT from faucet: https://faucet.polkadot.io/
3. Test each function in order:
   - Create game
   - Join game
   - Commit word
   - Play game (off-chain)
   - Reveal and score

## Resources

- Contract on BlockScout: https://blockscout-passet-hub.parity-testnet.parity.io/address/0xd8Ceb2B3dCdC96F903a4A8927C8ed6B6265293d6
- PAsset Hub Faucet: https://faucet.polkadot.io/
- Wagmi Docs: https://wagmi.sh/
- Viem Docs: https://viem.sh/
