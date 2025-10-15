# Debugging Transaction Reverts

## Your Current Issue

**Transaction Hash:** `0x3c9bcbc8afb6309f7834242d2a0b1ea3e049baf1979041f4ad9a3a14aa0fa3f6`

**Symptoms:**
- Transaction reverted (status: failed)
- No event logs emitted (logs: 0)
- High gas used: 2.8 trillion units
- Error: "Transaction reverted"

## What Was Enhanced

The code now includes:

### 1. **Automatic Revert Reason Detection**
When a transaction reverts, the system will:
- Detect the failure automatically
- Attempt to decode the revert reason
- Log the specific error message
- Display it in the transaction history

### 2. **Pre-Transaction Validation**
Before committing a word, the system now checks:
- ✅ Is the game active?
- ✅ Are you the host?
- ✅ Has a word already been committed?
- ✅ Does the game exist?

### 3. **Detailed Logging**
You'll now see in the console:
```javascript
[Contract] Game state: {
  gameId: 123,
  host: "0x...",
  wordCommitment: "0x...",
  createdAt: "...",
  isActive: true
}
[Contract] Game host: 0x...
[Contract] Your address: 0x...
[Contract] Is host? true/false
[Contract] Existing commitment: 0x...
[Contract] Is active? true/false
```

## Common Causes of Reverts

### 1. **Game Doesn't Exist**
The `gameId` you're using doesn't exist on-chain.

**Solution:** 
- Make sure you called `createGame()` first
- Check that `onChainGameId` is set correctly
- Verify the game exists by checking game state

### 2. **Not the Host**
You're trying to commit a word but you're not the game host.

**Solution:**
- Only the address that created the game can commit words
- Verify your wallet address matches the game host

### 3. **Word Already Committed**
The word has already been committed for this game.

**Solution:**
- You can only commit once per game
- Check if `wordCommitment` is not `0x0000...`
- Create a new game if needed

### 4. **Game Not Active**
The game has been completed or cancelled.

**Solution:**
- Check `isActive` status
- Create a new game

### 5. **Wrong Network**
You're on the wrong blockchain network.

**Solution:**
- Ensure you're on PAsset Hub Testnet
- Chain ID: 420420421 (0x190f1b46)

## How to Debug Your Specific Issue

### Step 1: Check the Console
Open DevTools (F12) and look for these logs:
```
[Contract] Game state: ...
[Contract] Is host? ...
[Contract] Revert reason: ...
```

### Step 2: Verify Game State
In the browser console, run:
```javascript
// Get the composable (if exposed globally or via Vue DevTools)
const { checkGameState } = useGameContract()
await checkGameState(YOUR_GAME_ID)
```

### Step 3: Check on BlockScout
Visit: https://blockscout-passet-hub.parity-testnet.parity.io/tx/0x3c9bcbc8afb6309f7834242d2a0b1ea3e049baf1979041f4ad9a3a14aa0fa3f6

Look for:
- **Status**: Should show "Failed" or "Reverted"
- **Revert Reason**: May show the specific error
- **Input Data**: Verify the function call parameters

### Step 4: Manual RPC Check
```bash
# Get transaction receipt
curl -s -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0x3c9bcbc8afb6309f7834242d2a0b1ea3e049baf1979041f4ad9a3a14aa0fa3f6"]}' \
  https://testnet-passet-hub-eth-rpc.polkadot.io | jq

# Get transaction details
curl -s -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionByHash","params":["0x3c9bcbc8afb6309f7834242d2a0b1ea3e049baf1979041f4ad9a3a14aa0fa3f6"]}' \
  https://testnet-passet-hub-eth-rpc.polkadot.io | jq
```

## Next Steps

1. **Try Again**: The enhanced logging will now show you exactly why it's reverting
2. **Check Game ID**: Verify `onChainGameId` is correct
3. **Verify Host**: Make sure you're the one who created the game
4. **Create New Game**: If the game is in a bad state, create a new one

## Testing the Fix

When you try to commit a word again, you should now see:

```
[Contract] Committing word for game: 123
[Contract] Current address: 0x...
[Contract] Game state: { ... }
[Contract] Game host: 0x...
[Contract] Your address: 0x...
[Contract] Is host? true
[Contract] Existing commitment: 0x0000...
[Contract] Is active? true
```

If any of these checks fail, you'll get a clear error message before the transaction is even sent!

## Manual Debugging Functions

You can now call these functions manually in the console:

```javascript
// Check game state
await checkGameState(gameId)

// Get revert reason for a failed transaction
await getRevertReason('0x...')

// View transaction history
console.log(transactionHistory.value)
```
