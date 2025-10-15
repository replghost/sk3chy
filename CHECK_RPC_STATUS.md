# RPC Status Check

## Quick Diagnostics

### 1. Check if RPC is responding at all

```bash
curl -X POST https://testnet-passet-hub-eth-rpc.polkadot.io \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Expected:** Should return latest block number
**If fails:** RPC is completely down

### 2. Check if your contract exists

```bash
curl -X POST https://testnet-passet-hub-eth-rpc.polkadot.io \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0xd8Ceb2B3dCdC96F903a4A8927C8ed6B6265293d6","latest"],"id":1}'
```

**Expected:** Should return contract bytecode (long hex string)
**If "0x":** Contract doesn't exist or was destroyed

### 3. Try reading from your contract

```bash
curl -X POST https://testnet-passet-hub-eth-rpc.polkadot.io \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0xd8Ceb2B3dCdC96F903a4A8927C8ed6B6265293d6",
      "data":"0xd5f39488"
    },"latest"],
    "id":1
  }'
```

**Note:** `0xd5f39488` is the function selector for `nextGameId()`
**Expected:** Should return a number
**If fails:** Contract can't be read

### 4. Check network status

```bash
# Get latest block
curl -X POST https://testnet-passet-hub-eth-rpc.polkadot.io \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}'
```

**Look for:** 
- `timestamp` - Is it recent? (within last few minutes)
- `number` - Is it incrementing?

### 5. Try a simple transaction simulation

```bash
curl -X POST https://testnet-passet-hub-eth-rpc.polkadot.io \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_estimateGas",
    "params":[{
      "from":"0xa2F70Cc9798171d3ef8fF7dAE91a76e8A1964438",
      "to":"0xd8Ceb2B3dCdC96F903a4A8927C8ed6B6265293d6",
      "data":"0x7b1a4909"
    }],
    "id":1
  }'
```

**Note:** `0x7b1a4909` is the function selector for `createGame()`
**Expected:** Should return estimated gas
**If "circuit breaker" error:** This is where the block is happening

## Interpretation

### Scenario A: All checks pass except #5
**Diagnosis:** The RPC node is blocking write operations (transactions)
**Cause:** Rate limiting, maintenance mode, or protective circuit breaker
**Solution:** Wait, use different RPC, or deploy new contract elsewhere

### Scenario B: Check #2 returns "0x"
**Diagnosis:** Your contract doesn't exist at that address
**Cause:** Wrong network, contract not deployed, or chain was reset
**Solution:** Redeploy the contract

### Scenario C: Check #1 fails
**Diagnosis:** RPC endpoint is completely down
**Cause:** Node offline, network issues, or endpoint changed
**Solution:** Find alternative RPC endpoint

### Scenario D: Check #4 shows old timestamp
**Diagnosis:** Blockchain stopped producing blocks
**Cause:** Network halt, validator issues, or testnet reset
**Solution:** Wait for network recovery or use different network

## What "Circuit Breaker" Actually Means

In distributed systems, a circuit breaker pattern works like this:

```
CLOSED (Normal) → [Too many errors] → OPEN (Blocking)
                                         ↓
                                    [Wait timeout]
                                         ↓
                                    HALF-OPEN (Testing)
                                         ↓
                                [Success] → CLOSED
                                [Failure] → OPEN
```

When OPEN:
- All requests are immediately rejected
- No actual calls are made to the backend
- Error: "circuit breaker is open"

This protects the system from cascading failures.

## Next Steps

1. **Run the diagnostic commands above**
2. **Share the results** - This will tell us exactly what's wrong
3. **Based on results:**
   - If RPC is blocking: Deploy new contract or wait
   - If contract missing: Redeploy
   - If network down: Wait or switch networks
