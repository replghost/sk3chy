# Game ID Fix: Using Proper On-Chain Game IDs

## The Problem

**Original Code:**
```javascript
// TODO: Parse gameId from transaction receipt
// For now, use room ID as placeholder
onChainGameId.value = parseInt(String(route.params.id))
```

The code was incorrectly using the **room ID** (from the URL) as the **on-chain game ID**. This is wrong because:

1. **Room IDs are local** - They're just URL parameters for the Y.js collaboration room
2. **Game IDs are unique on-chain** - The smart contract generates sequential unique IDs
3. **They don't match** - Room "game-contract-123" has nothing to do with on-chain game ID 5

## Why This Caused Issues

When you tried to commit a word:
- You used `onChainGameId = 123` (from room ID)
- But the actual on-chain game ID was probably `1`, `2`, `3`, etc.
- The contract rejected it because game `123` doesn't exist
- **Result**: Transaction reverted with "Game not found" or similar error

## The Fix

### 1. Parse Game ID from Transaction Receipt

The `createGame()` function now:
1. Waits for the transaction to be confirmed
2. Parses the `GameCreated` event from the transaction logs
3. Extracts the actual `gameId` emitted by the contract
4. Returns both the transaction hash and game ID

```javascript
// New return type
return { hash, gameId }  // gameId is the actual on-chain ID
```

### 2. Event Parsing

The contract emits a `GameCreated` event:
```solidity
event GameCreated(uint256 indexed gameId, address indexed host, uint256 timestamp)
```

We decode this event to get the real game ID:
```javascript
const decoded = decodeEventLog({
  abi: [gameCreatedEvent],
  data: log.data,
  topics: log.topics
})
gameId = Number(decoded.args.gameId)
```

### 3. Updated Game Page

The game page now properly extracts and uses the returned game ID:
```javascript
const result = await createGameOnChain()
if (result.gameId !== null) {
  onChainGameId.value = result.gameId  // Use actual on-chain ID
  console.log('[Contract] On-chain game ID set to:', result.gameId)
}
```

## How It Works Now

### Flow:
1. **Host clicks "Create Game On-Chain"**
2. **Transaction submitted** → `createGame()` called
3. **Wait for confirmation** → Transaction mined in a block
4. **Parse GameCreated event** → Extract actual game ID (e.g., `5`)
5. **Set onChainGameId** → `onChainGameId.value = 5`
6. **Commit word** → Uses correct game ID `5`
7. **Success!** ✅

### Example Console Output:
```
[Contract] Creating game...
[Contract] Game creation tx submitted: 0x...
[Contract] Waiting for transaction confirmation to get game ID...
[Contract] Game created with ID: 5
[Contract] On-chain game ID set to: 5
```

## Benefits

1. **Correct Game IDs** - Always uses the actual on-chain game ID
2. **No More Reverts** - Transactions won't fail due to wrong game ID
3. **Multiple Rooms** - Different rooms can create different on-chain games
4. **Proper Tracking** - Transaction history shows the game ID in details

## Testing

To verify the fix works:

1. **Create a game on-chain**
2. **Check console logs** - Should show: `Game created with ID: X`
3. **Check transaction history** - Details should show `gameId: X`
4. **Commit a word** - Should succeed with the correct game ID
5. **Check BlockScout** - Verify the GameCreated event shows the same ID

## What Changed

### Files Modified:

1. **`composables/useGameContract.ts`**
   - `createGame()` now waits for confirmation
   - Parses `GameCreated` event from logs
   - Returns `{ hash, gameId }` instead of just `hash`
   - Added `decodeEventLog` import from viem

2. **`pages/game-contract/[id].vue`**
   - `handleCreateGameOnChain()` now extracts game ID from result
   - Sets `onChainGameId` to the actual on-chain ID
   - Removed TODO comment about parsing game ID

## Important Notes

- **Room ID ≠ Game ID** - They are completely separate concepts
- **Sequential IDs** - On-chain game IDs are sequential (1, 2, 3, ...)
- **One Game Per Room** - Each room should only create one on-chain game
- **Game ID Required** - You must create a game before committing words

## Troubleshooting

### If game ID is null:
- Check if the transaction succeeded
- Verify the `GameCreated` event was emitted
- Check BlockScout for the transaction logs

### If commit still fails:
- Verify `onChainGameId` is set correctly
- Check you're the host of that game ID
- Use `checkGameState(gameId)` to verify game exists
