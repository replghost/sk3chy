import { useWriteContract, useWaitForTransactionReceipt } from '@wagmi/vue'
import { ref } from 'vue'
import { createPublicClient, http } from 'viem'
import { passetHub } from '~/utils/chains'

// Minimal ABI for minting - you'll need to update this after deploying the contract
const NFT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "string", "name": "metadataURI", "type": "string" }
    ],
    "name": "mintDrawing",
    "outputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "internalType": "string", "name": "metadataURI", "type": "string" }
    ],
    "name": "mintDrawingWithGameId",
    "outputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const

export function useNFTMint() {
  const minting = ref(false)
  const mintError = ref<string | null>(null)
  const mintedTokenId = ref<bigint | null>(null)
  const txHash = ref<string | null>(null)

  const { writeContractAsync } = useWriteContract()

  async function mintNFT(
    nftContractAddress: string,
    recipient: string,
    metadataURI: string,
    gameId?: number
  ) {
    minting.value = true
    mintError.value = null
    mintedTokenId.value = null
    txHash.value = null

    try {
      console.log('[NFT] Minting NFT...', {
        contract: nftContractAddress,
        recipient,
        metadataURI,
        gameId
      })

      // Choose function based on whether we have a gameId
      let hash: `0x${string}`
      
      if (gameId) {
        hash = await writeContractAsync({
          address: nftContractAddress as `0x${string}`,
          abi: NFT_ABI,
          functionName: 'mintDrawingWithGameId',
          args: [recipient as `0x${string}`, BigInt(gameId), metadataURI]
        })
      } else {
        hash = await writeContractAsync({
          address: nftContractAddress as `0x${string}`,
          abi: NFT_ABI,
          functionName: 'mintDrawing',
          args: [recipient as `0x${string}`, metadataURI]
        })
      }

      txHash.value = hash
      console.log('[NFT] Transaction sent:', hash)

      // Wait for confirmation
      const publicClient = usePublicClient()
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        if (receipt.status === 'success') {
          // Try to extract token ID from logs
          const mintEvent = receipt.logs.find((log: any) => 
            log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer event
          )
          
          if (mintEvent && mintEvent.topics[3]) {
            mintedTokenId.value = BigInt(mintEvent.topics[3])
            console.log('[NFT] Minted token ID:', mintedTokenId.value)
          }
          
          console.log('[NFT] ✅ NFT minted successfully!')
          return {
            success: true,
            tokenId: mintedTokenId.value,
            txHash: hash
          }
        } else {
          throw new Error('Transaction failed')
        }
      }

      return {
        success: true,
        txHash: hash
      }
    } catch (error: any) {
      console.error('[NFT] Minting failed:', error)
      mintError.value = error.message || 'Failed to mint NFT'
      throw error
    } finally {
      minting.value = false
    }
  }

  return {
    mintNFT,
    minting,
    mintError,
    mintedTokenId,
    txHash
  }
}

// Helper to get public client
function usePublicClient() {
  return createPublicClient({
    chain: passetHub,
    transport: http()
  })
}
