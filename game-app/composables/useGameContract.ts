import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, useClient } from '@wagmi/vue'
import { keccak256, encodePacked, type Address, parseAbiItem, createPublicClient, http, type TransactionReceipt, decodeEventLog } from 'viem'
import { computed, ref } from 'vue'
import contractABI from '~/utils/abi/Sk3chyGame.json'
import { passetHub } from '~/utils/chains'

// Transaction history storage
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

const transactionHistory = ref<TransactionLog[]>([])

export function useGameContract() {
  const config = useRuntimeConfig()
  const CONTRACT_ADDRESS = config.public.contractAddress as `0x${string}`
 
    // Extract ABI from the JSON
  const ABI = contractABI.abi

  const { writeContractAsync, data: hash, isPending } = useWriteContract()
  const { address } = useAccount()
  
  // Helper to log transactions
  function logTransaction(log: TransactionLog) {
    transactionHistory.value.unshift(log)
    // Keep only last 50 transactions
    if (transactionHistory.value.length > 50) {
      transactionHistory.value = transactionHistory.value.slice(0, 50)
    }
    console.log('[Contract] Transaction logged:', log)
  }
  
  // Helper to update existing transaction log
  function updateTransactionLog(hash: `0x${string}`, updates: Partial<TransactionLog>) {
    const index = transactionHistory.value.findIndex(tx => tx.hash === hash)
    if (index !== -1) {
      transactionHistory.value[index] = {
        ...transactionHistory.value[index],
        ...updates
      }
      console.log('[Contract] Transaction updated:', transactionHistory.value[index])
    }
  }
  
  // Helper to get explorer URL
  function getExplorerUrl(hash: `0x${string}`) {
    return `https://blockscout-passet-hub.parity-testnet.parity.io/tx/${hash}`
  }
  
  // Helper to decode revert reason from transaction
  async function getRevertReason(hash: `0x${string}`) {
    try {
      const publicClient = createPublicClient({
        chain: passetHub,
        transport: http()
      })
      
      const tx = await publicClient.getTransaction({ hash })
      if (!tx) return 'Transaction not found'
      
      try {
        // Try to simulate the transaction to get revert reason
        await publicClient.call({
          to: tx.to,
          data: tx.input,
          value: tx.value,
        })
      } catch (err: any) {
        // Extract revert reason from error
        if (err.message) {
          // Look for common revert patterns
          const match = err.message.match(/reverted with reason string '(.+?)'/) ||
                       err.message.match(/execution reverted: (.+)/) ||
                       err.message.match(/Error: (.+)/)
          if (match) return match[1]
        }
        return err.message || 'Unknown revert reason'
      }
    } catch (error: any) {
      console.error('[Contract] Failed to get revert reason:', error)
      return 'Could not decode revert reason'
    }
  }
  
  // Helper to wait for transaction and update log
  async function waitAndLogTransaction(hash: `0x${string}`, type: TransactionLog['type'], details?: any) {
    const publicClient = createPublicClient({
      chain: passetHub,
      transport: http()
    })
    
    try {
      console.log(`[Contract] Waiting for ${type} transaction:`, hash)
      console.log(`[Contract] Explorer: ${getExplorerUrl(hash)}`)
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1,
        timeout: 60_000 // 60 second timeout
      })
      
      const success = receipt.status === 'success'
      
      // If transaction failed, try to get revert reason
      let errorMessage: string | undefined
      if (!success) {
        console.error('[Contract] Transaction reverted! Getting revert reason...')
        errorMessage = await getRevertReason(hash)
        console.error('[Contract] Revert reason:', errorMessage)
      }
      
      // Update existing pending transaction instead of creating new entry
      updateTransactionLog(hash, {
        status: success ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        error: errorMessage,
        details
      })
      
      console.log(`[Contract] Transaction ${success ? 'succeeded' : 'failed'}:`, {
        hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        logs: receipt.logs.length,
        status: receipt.status
      })
      
      // Log decoded events
      if (receipt.logs.length > 0) {
        console.log('[Contract] Transaction logs:', receipt.logs)
      }
      
      // Throw error if transaction failed
      if (!success) {
        throw new Error(`Transaction reverted: ${errorMessage || 'Unknown reason'}`)
      }
      
      return receipt
    } catch (error: any) {
      console.error(`[Contract] Transaction failed or timed out:`, error)
      // Update existing pending transaction
      updateTransactionLog(hash, {
        status: 'failed',
        error: error.message || 'Transaction failed'
      })
      throw error
    }
  }
  
  // Create a new game
  async function createGame() {
    try {
      console.log('[Contract] Creating game...')
      console.log('[Contract] Contract address:', CONTRACT_ADDRESS)
      console.log('[Contract] Chain:', passetHub.name)
      
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'createGame',
      })
      
      console.log('[Contract] Game creation tx submitted:', hash)
      console.log('[Contract] View on explorer:', getExplorerUrl(hash))
      
      // Log as pending immediately
      logTransaction({
        hash,
        type: 'createGame',
        timestamp: Date.now(),
        status: 'pending',
        explorerUrl: getExplorerUrl(hash)
      })
      
      // Wait for confirmation and parse game ID
      const publicClient = createPublicClient({
        chain: passetHub,
        transport: http()
      })
      
      console.log('[Contract] Waiting for transaction confirmation to get game ID...')
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1
      })
      
      // Parse GameCreated event to get the game ID
      let gameId: number | null = null
      if (receipt.logs.length > 0) {
        try {
          const gameCreatedEvent = parseAbiItem('event GameCreated(uint256 indexed gameId, address indexed host, uint256 timestamp)')
          const logs = receipt.logs.filter(log => {
            try {
              const decoded = decodeEventLog({
                abi: [gameCreatedEvent],
                data: log.data,
                topics: log.topics
              })
              return decoded.eventName === 'GameCreated'
            } catch {
              return false
            }
          })
          
          if (logs.length > 0) {
            const decoded = decodeEventLog({
              abi: [gameCreatedEvent],
              data: logs[0].data,
              topics: logs[0].topics
            })
            gameId = Number(decoded.args.gameId)
            console.log('[Contract] Game created with ID:', gameId)
          }
        } catch (error) {
          console.error('[Contract] Failed to parse GameCreated event:', error)
        }
      }
      
      // Update transaction log with game ID
      updateTransactionLog(hash, {
        status: receipt.status === 'success' ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        details: { gameId }
      })
      
      return { hash, gameId }
    } catch (error: any) {
      console.error('[Contract] Failed to create game:', error)
      console.error('[Contract] Error details:', {
        message: error.message,
        code: error.code,
        data: error.data
      })
      throw error
    }
  }
  
  // Join an existing game
  async function joinGame(gameId: number) {
    try {
      console.log('[Contract] Joining game:', gameId)
      
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'joinGame',
        args: [BigInt(gameId)],
      })
      
      console.log('[Contract] Join game tx submitted:', hash)
      console.log('[Contract] View on explorer:', getExplorerUrl(hash))
      
      logTransaction({
        hash,
        type: 'joinGame',
        timestamp: Date.now(),
        status: 'pending',
        explorerUrl: getExplorerUrl(hash),
        details: { gameId }
      })
      
      waitAndLogTransaction(hash, 'joinGame', { gameId }).catch(console.error)
      
      return hash
    } catch (error: any) {
      console.error('[Contract] Failed to join game:', error)
      console.error('[Contract] Error details:', {
        message: error.message,
        code: error.code,
        gameId
      })
      throw error
    }
  }
  
  // Check game state before committing
  async function checkGameState(gameId: number) {
    try {
      const publicClient = createPublicClient({
        chain: passetHub,
        transport: http()
      })
      
      const gameData = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'getGame',
        args: [BigInt(gameId)]
      }) as any
      
      console.log('[Contract] Game state:', {
        gameId,
        host: gameData[0],
        wordCommitment: gameData[1],
        createdAt: gameData[2]?.toString(),
        isActive: gameData[3]
      })
      
      return gameData
    } catch (error) {
      console.error('[Contract] Failed to check game state:', error)
      return null
    }
  }
  
  // Commit word hash (host only)
  async function commitWord(gameId: number, word: string, salt: string) {
    try {
      console.log('[Contract] Committing word for game:', gameId)
      console.log('[Contract] Current address:', address.value)
      
      // Check game state first
      const gameState = await checkGameState(gameId)
      if (gameState) {
        const [host, existingCommitment, createdAt, isActive] = gameState
        console.log('[Contract] Game host:', host)
        console.log('[Contract] Your address:', address.value)
        console.log('[Contract] Is host?', host.toLowerCase() === address.value?.toLowerCase())
        console.log('[Contract] Existing commitment:', existingCommitment)
        console.log('[Contract] Is active?', isActive)
        
        if (existingCommitment !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          console.warn('[Contract] ⚠️ Word already committed for this game!')
        }
        
        if (!isActive) {
          throw new Error('Game is not active')
        }
        
        if (host.toLowerCase() !== address.value?.toLowerCase()) {
          throw new Error('You are not the host of this game')
        }
      }
      
      // Create commitment hash
      const commitment = keccak256(encodePacked(['string', 'string'], [word, salt]))
      console.log('[Contract] Commitment hash:', commitment)
      console.log('[Contract] Word:', word, 'Length:', word.length)
      console.log('[Contract] Salt:', salt, 'Length:', salt.length)
      
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'commitWord',
        args: [BigInt(gameId), commitment],
      })
      
      console.log('[Contract] Commit word tx submitted:', hash)
      console.log('[Contract] View on explorer:', getExplorerUrl(hash))
      
      logTransaction({
        hash,
        type: 'commitWord',
        timestamp: Date.now(),
        status: 'pending',
        explorerUrl: getExplorerUrl(hash),
        details: { gameId, commitment }
      })
      
      waitAndLogTransaction(hash, 'commitWord', { gameId, commitment }).catch(console.error)
      
      return hash
    } catch (error: any) {
      console.error('[Contract] Failed to commit word:', error)
      console.error('[Contract] Error details:', {
        message: error.message,
        code: error.code,
        gameId
      })
      throw error
    }
  }
  
  // Reveal word and record scores (host only)
  async function revealAndScore(
    gameId: number,
    word: string,
    salt: string,
    winners: Address[],
    scores: number[]
  ) {
    try {
      console.log('[Contract] Revealing and scoring game:', gameId)
      console.log('[Contract] Word:', word)
      console.log('[Contract] Salt:', salt)
      console.log('[Contract] Winners:', winners)
      console.log('[Contract] Scores:', scores)
      
      // Verify commitment matches
      const commitment = keccak256(encodePacked(['string', 'string'], [word, salt]))
      console.log('[Contract] Recomputed commitment:', commitment)
      
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'revealAndScore',
        args: [
          BigInt(gameId),
          word,
          salt,
          winners,
          scores.map(s => BigInt(s)),
        ],
      })
      
      console.log('[Contract] Reveal and score tx submitted:', hash)
      console.log('[Contract] View on explorer:', getExplorerUrl(hash))
      
      logTransaction({
        hash,
        type: 'revealAndScore',
        timestamp: Date.now(),
        status: 'pending',
        explorerUrl: getExplorerUrl(hash),
        details: { gameId, word, winners: winners.length, totalScore: scores.reduce((a, b) => a + b, 0) }
      })
      
      waitAndLogTransaction(hash, 'revealAndScore', { gameId, word, winners, scores }).catch(console.error)
      
      return hash
    } catch (error: any) {
      console.error('[Contract] Failed to reveal and score:', error)
      console.error('[Contract] Error details:', {
        message: error.message,
        code: error.code,
        data: error.data,
        gameId,
        word,
        winnersCount: winners.length
      })
      throw error
    }
  }
  
  // Read functions
  function useGameData(gameId: number) {
    return useReadContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'getGame',
      args: [BigInt(gameId)],
    })
  }
  
  function usePlayerWins(playerAddress?: Address) {
    return useReadContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'getPlayerWins',
      args: playerAddress ? [playerAddress] : undefined,
      query: {
        enabled: !!playerAddress,
      },
    })
  }
  
  // Query past games from events
  async function getRecentGames(limit = 20) {
    try {
      console.log('[Contract] Fetching recent games from contract:', CONTRACT_ADDRESS)
      console.log('[Contract] Chain:', passetHub)
      
      const publicClient = createPublicClient({
        chain: passetHub,
        transport: http()
      })
      
      console.log('[Contract] Public client created, fetching logs...')
      
      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event GameCompleted(uint256 indexed gameId, address indexed host, string word, address[] winners, uint256[] scores, uint256 timestamp)'),
        fromBlock: 0n,
        toBlock: 'latest'
      })
      
      console.log('[Contract] Found', logs.length, 'GameCompleted events')
      console.log('[Contract] Raw logs:', logs)
      
      const games = logs.map(log => ({
        gameId: Number(log.args.gameId),
        host: log.args.host as Address,
        word: log.args.word as string,
        winners: log.args.winners as Address[],
        scores: (log.args.scores as bigint[])?.map(s => Number(s)) || [],
        timestamp: Number(log.args.timestamp),
        blockNumber: Number(log.blockNumber),
        transactionHash: log.transactionHash
      }))
      
      console.log('[Contract] Parsed games:', games)
      
      // Return most recent games
      return games.slice(-limit).reverse()
    } catch (error) {
      console.error('[Contract] Failed to fetch recent games:', error)
      console.error('[Contract] Error details:', JSON.stringify(error, null, 2))
      return []
    }
  }
  
  // Get games by specific player (as host)
  async function getGamesByHost(hostAddress: Address) {
    try {
      const publicClient = createPublicClient({
        chain: passetHub,
        transport: http()
      })
      
      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event GameCompleted(uint256 indexed gameId, address indexed host, string word, address[] winners, uint256[] scores, uint256 timestamp)'),
        args: {
          host: hostAddress
        },
        fromBlock: 0n,
        toBlock: 'latest'
      })
      
      return logs.map(log => ({
        gameId: Number(log.args.gameId),
        host: log.args.host as Address,
        word: log.args.word as string,
        winners: log.args.winners as Address[],
        scores: (log.args.scores as bigint[])?.map(s => Number(s)) || [],
        timestamp: Number(log.args.timestamp),
        blockNumber: Number(log.blockNumber)
      }))
    } catch (error) {
      console.error('[Contract] Failed to fetch games by host:', error)
      return []
    }
  }
  
  // Get leaderboard data
  async function getLeaderboard() {
    try {
      const publicClient = createPublicClient({
        chain: passetHub,
        transport: http()
      })
      
      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event GameCompleted(uint256 indexed gameId, address indexed host, string word, address[] winners, uint256[] scores, uint256 timestamp)'),
        fromBlock: 0n,
        toBlock: 'latest'
      })
      
      // Count wins per player
      const playerStats = new Map<Address, { wins: number, totalScore: number, gamesPlayed: number }>()
      
      logs.forEach(log => {
        const winners = log.args.winners as Address[]
        const scores = (log.args.scores as bigint[])?.map(s => Number(s)) || []
        
        winners.forEach((winner, index) => {
          const stats = playerStats.get(winner) || { wins: 0, totalScore: 0, gamesPlayed: 0 }
          stats.wins += 1
          stats.totalScore += scores[index] || 0
          stats.gamesPlayed += 1
          playerStats.set(winner, stats)
        })
      })
      
      // Convert to array and sort by wins
      return Array.from(playerStats.entries())
        .map(([address, stats]) => ({
          address,
          ...stats,
          avgScore: stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0
        }))
        .sort((a, b) => b.wins - a.wins)
    } catch (error) {
      console.error('[Contract] Failed to fetch leaderboard:', error)
      return []
    }
  }
  
  // Debug: Get transaction receipt
  async function getTransactionReceipt(txHash: `0x${string}`) {
    try {
      const publicClient = createPublicClient({
        chain: passetHub,
        transport: http()
      })
      
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
      console.log('[Contract] Transaction receipt:', receipt)
      console.log('[Contract] Logs:', receipt.logs)
      return receipt
    } catch (error) {
      console.error('[Contract] Failed to get transaction receipt:', error)
      return null
    }
  }

  // Clear transaction history
  function clearTransactionHistory() {
    transactionHistory.value = []
  }
  
  return {
    // Contract info
    contractAddress: CONTRACT_ADDRESS,
    
    // Write functions
    createGame,
    joinGame,
    commitWord,
    revealAndScore,
    
    // Read functions
    useGameData,
    usePlayerWins,
    
    // Event queries
    getRecentGames,
    getGamesByHost,
    getLeaderboard,
    
    // Debug & Logging
    getTransactionReceipt,
    transactionHistory: computed(() => transactionHistory.value),
    clearTransactionHistory,
    getExplorerUrl,
    getRevertReason,
    checkGameState,
    
    // State
    isPending,
    hash,
  }
}
