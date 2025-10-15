# Transaction Debugging Guide

## Overview

The sk3tchy game now includes comprehensive transaction logging and debugging capabilities for all blockchain interactions.

## Features

### 1. **Automatic Transaction Logging**
All blockchain transactions are automatically logged with:
- Transaction hash
- Transaction type (createGame, joinGame, commitWord, revealAndScore)
- Status (pending, success, failed)
- Timestamp
- Block number (when confirmed)
- Gas used
- Error messages (if failed)
- Transaction details

### 2. **Console Logging**
Every transaction includes detailed console logs:

```javascript
// When submitting a transaction
[Contract] Creating game...
[Contract] Contract address: 0xd8Ceb2B3dCdC96F903a4A8927C8ed6B6265293d6
[Contract] Chain: Polkadot Asset Hub Testnet
[Contract] Game creation tx submitted: 0x...
[Contract] View on explorer: https://blockscout-passet-hub.parity-testnet.parity.io/tx/0x...

// When transaction is confirmed
[Contract] Transaction succeeded: {
  hash: '0x...',
  blockNumber: 12345,
  gasUsed: '123456',
  logs: 2
}
```

### 3. **Transaction History UI**
A visual transaction history component shows:
- All recent transactions
- Real-time status updates
- Quick links to block explorer
- Copy transaction hash button
- Detailed error messages
- Transaction metadata

### 4. **Explorer Integration**
Every transaction includes a direct link to the PAsset Hub block explorer:
```
https://blockscout-passet-hub.parity-testnet.parity.io/tx/[HASH]
```

## Usage

### Viewing Transaction History

The transaction history automatically appears in the game lobby when you have blockchain transactions. It shows:
- ⏳ Pending transactions (waiting for confirmation)
- ✓ Successful transactions (confirmed on-chain)
- ✗ Failed transactions (with error details)

### Debugging Failed Transactions

1. **Check Console Logs**: Open browser DevTools (F12) and look for `[Contract]` logs
2. **View Transaction History**: Scroll down in the game lobby to see the transaction list
3. **Click Explorer Link**: Click the external link icon to view the transaction on BlockScout
4. **Check Error Messages**: Failed transactions show error details in both console and UI

### Common Issues

#### "No Ethereum extrinsic found"
- The transaction hash doesn't exist on this network
- Verify you're on the correct network (PAsset Hub Testnet)
- Check if the transaction was actually submitted

#### Transaction Pending Forever
- Network congestion or RPC issues
- Check the block explorer to see if transaction is actually pending
- May need to wait longer or increase gas

#### "Transaction reverted"
- Smart contract rejected the transaction
- Check console logs for specific revert reason
- Verify all parameters are correct

## API Reference

### useGameContract Composable

```typescript
const {
  // Transaction tracking
  transactionHistory,        // Reactive array of all transactions
  clearTransactionHistory,   // Clear the history
  getExplorerUrl,           // Get explorer URL for a hash
  
  // Contract functions (all include automatic logging)
  createGame,
  joinGame,
  commitWord,
  revealAndScore,
} = useGameContract()
```

### Transaction Log Structure

```typescript
interface TransactionLog {
  hash: `0x${string}`
  type: 'createGame' | 'joinGame' | 'commitWord' | 'revealAndScore'
  timestamp: number
  status: 'pending' | 'success' | 'failed'
  error?: string
  blockNumber?: bigint
  gasUsed?: bigint
  explorerUrl: string
  details?: any
}
```

## Manual Transaction Inspection

You can manually inspect any transaction using curl:

```bash
# Get transaction receipt
curl -s -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0xYOUR_TX_HASH"]}' \
  https://testnet-passet-hub-eth-rpc.polkadot.io

# Get transaction details
curl -s -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionByHash","params":["0xYOUR_TX_HASH"]}' \
  https://testnet-passet-hub-eth-rpc.polkadot.io
```

## Tips

1. **Always check console logs first** - They contain the most detailed information
2. **Use the explorer** - BlockScout provides detailed transaction information
3. **Keep transaction history open** - It updates in real-time as transactions confirm
4. **Copy transaction hashes** - Use the copy button to easily share or debug transactions
5. **Check network status** - Verify you're connected to PAsset Hub Testnet

## Support

If you encounter issues:
1. Check the console logs for `[Contract]` messages
2. View the transaction on BlockScout
3. Share the transaction hash and error messages
4. Include the full console log output
