import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from '@wagmi/vue'
import { keccak256, encodePacked, type Address } from 'viem'
import { computed } from 'vue'
import contractABI from '~/utils/abi/Sk3chyGame.json'

// Contract address on PAsset Hub testnet
const CONTRACT_ADDRESS = '0xd8Ceb2B3dCdC96F903a4A8927C8ed6B6265293d6' as const

// Extract ABI from the JSON
const ABI = contractABI.abi

export function useGameContract() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract()
  const { address } = useAccount()
  
  // Create a new game
  async function createGame() {
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'createGame',
      })
      
      console.log('[Contract] Game creation tx:', hash)
      return hash
    } catch (error) {
      console.error('[Contract] Failed to create game:', error)
      throw error
    }
  }
  
  // Join an existing game
  async function joinGame(gameId: number) {
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'joinGame',
        args: [BigInt(gameId)],
      })
      
      console.log('[Contract] Join game tx:', hash)
      return hash
    } catch (error) {
      console.error('[Contract] Failed to join game:', error)
      throw error
    }
  }
  
  // Commit word hash (host only)
  async function commitWord(gameId: number, word: string, salt: string) {
    try {
      // Create commitment hash
      const commitment = keccak256(encodePacked(['string', 'string'], [word, salt]))
      
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'commitWord',
        args: [BigInt(gameId), commitment],
      })
      
      console.log('[Contract] Commit word tx:', hash)
      console.log('[Contract] Commitment:', commitment)
      return hash
    } catch (error) {
      console.error('[Contract] Failed to commit word:', error)
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
      
      console.log('[Contract] Reveal and score tx:', hash)
      return hash
    } catch (error) {
      console.error('[Contract] Failed to reveal and score:', error)
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
    
    // State
    isPending,
    hash,
  }
}
