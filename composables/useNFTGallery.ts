import { createPublicClient, http } from 'viem'
import { passetHub } from '~/utils/chains'

const NFT_ABI = [
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "tokenURI",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "ownerOf",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "tokenIdToGameId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const

// In-memory cache for IPFS content
const ipfsCache = new Map<string, any>()

// Helper to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Fetch with retry and exponential backoff
async function fetchWithRetry(url: string, maxRetries = 2): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8s timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        mode: 'cors',
        cache: 'force-cache' // Use browser cache when possible
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        return response
      }
      
      // If rate limited (429), wait longer before retry
      if (response.status === 429) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 8000)
        console.log(`[NFT Gallery] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`)
        await delay(waitTime)
        continue
      }
      
      // For other errors, don't retry
      return null
    } catch (e) {
      if (attempt < maxRetries - 1) {
        const waitTime = Math.min(500 * Math.pow(2, attempt), 4000)
        console.log(`[NFT Gallery] Fetch error, retrying in ${waitTime}ms (${attempt + 1}/${maxRetries})`, e)
        await delay(waitTime)
      } else {
        console.warn(`[NFT Gallery] All retries failed for:`, url, e)
        return null
      }
    }
  }
  return null
}

export function useNFTGallery() {
  const config = useRuntimeConfig()
  const nftContractAddress = config.public.nftContractAddress
  const pinataGateway = config.public.pinataGateway
  const pinataJwtRead = config.public.pinataJwtRead || config.public.pinataJwt

  console.log('[NFT Gallery] Config:', {
    nftContractAddress,
    pinataGateway: pinataGateway || 'not configured',
    hasPinataJwtRead: !!pinataJwtRead
  })

  const publicClient = createPublicClient({
    chain: passetHub,
    transport: http()
  })

  async function getAllNFTs() {
    if (!nftContractAddress) {
      console.warn('[NFT Gallery] No NFT contract address configured')
      return []
    }

    try {
      // Get total supply
      const totalSupply = await publicClient.readContract({
        address: nftContractAddress as `0x${string}`,
        abi: NFT_ABI,
        functionName: 'totalSupply'
      })

      console.log('[NFT Gallery] Total NFTs:', totalSupply)

      if (totalSupply === 0n) {
        console.log('[NFT Gallery] No NFTs minted yet')
        return []
      }

      // Determine if contract uses 0-indexed or 1-indexed token IDs
      let startIndex = 0
      let endIndex = Number(totalSupply) - 1
      
      // Try to fetch token 0 to see if it exists
      try {
        await publicClient.readContract({
          address: nftContractAddress as `0x${string}`,
          abi: NFT_ABI,
          functionName: 'tokenURI',
          args: [0n]
        })
        // Token 0 exists, so it's 0-indexed
        console.log('[NFT Gallery] Contract uses 0-indexed token IDs')
        startIndex = 0
        endIndex = Number(totalSupply) - 1
      } catch (e) {
        // Token 0 doesn't exist, so it's 1-indexed
        console.log('[NFT Gallery] Contract uses 1-indexed token IDs')
        startIndex = 1
        endIndex = Number(totalSupply)
      }

      // Fetch all NFTs
      const nfts = []
      for (let i = startIndex; i <= endIndex; i++) {
        try {
          const [tokenURI, owner, gameId] = await Promise.all([
            publicClient.readContract({
              address: nftContractAddress as `0x${string}`,
              abi: NFT_ABI,
              functionName: 'tokenURI',
              args: [BigInt(i)]
            }),
            publicClient.readContract({
              address: nftContractAddress as `0x${string}`,
              abi: NFT_ABI,
              functionName: 'ownerOf',
              args: [BigInt(i)]
            }),
            publicClient.readContract({
              address: nftContractAddress as `0x${string}`,
              abi: NFT_ABI,
              functionName: 'tokenIdToGameId',
              args: [BigInt(i)]
            })
          ])

          // Fetch metadata from IPFS with fallback gateways
          let metadata = null
          let imageUrl = null
          
          if (tokenURI) {
            const cid = tokenURI.replace('ipfs://', '')
            
            // Check cache first
            if (ipfsCache.has(cid)) {
              console.log(`[NFT Gallery] ✅ Token ${i} metadata from cache`)
              metadata = ipfsCache.get(cid)
            } else {
              console.log(`[NFT Gallery] Token ${i} URI:`, tokenURI)
              
              // Try Pinata gateway first if JWT is available
              if (pinataJwtRead) {
                try {
                  console.log(`[NFT Gallery] Fetching from Pinata gateway:`, cid)
                  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
                    headers: {
                      'Authorization': `Bearer ${pinataJwtRead}`
                    }
                  })
                  
                  if (response.ok) {
                    metadata = await response.json()
                    ipfsCache.set(cid, metadata)
                    console.log(`[NFT Gallery] ✅ Token ${i} metadata loaded from Pinata gateway`)
                  } else {
                    console.warn(`[NFT Gallery] Pinata gateway returned ${response.status}, trying public gateways`)
                  }
                } catch (e) {
                  console.warn(`[NFT Gallery] Pinata gateway failed, trying public gateways:`, e)
                }
              }
              
              // If Pinata API didn't work, try public gateways
              if (!metadata) {
                const gateways = [
                  `https://${cid}.ipfs.w3s.link`,
                  `https://ipfs.io/ipfs/${cid}`,
                  `https://dweb.link/ipfs/${cid}`
                ]
                
                for (const metadataUrl of gateways) {
                  console.log(`[NFT Gallery] Trying gateway:`, metadataUrl)
                  const response = await fetchWithRetry(metadataUrl)
                  
                  if (response) {
                    try {
                      metadata = await response.json()
                      ipfsCache.set(cid, metadata)
                      console.log(`[NFT Gallery] ✅ Token ${i} metadata loaded from:`, metadataUrl)
                      break
                    } catch (e) {
                      console.warn(`[NFT Gallery] Failed to parse JSON from:`, metadataUrl, e)
                    }
                  } else {
                    console.warn(`[NFT Gallery] Gateway failed:`, metadataUrl)
                  }
                }
              }
              
              if (!metadata) {
                console.error(`[NFT Gallery] ❌ All gateways failed for token ${i}`)
              }
            }
            
            // Set image URL - use gateway.pinata.cloud for images (works with <img> tags)
            if (metadata) {
              console.log(`[NFT Gallery] Token ${i} metadata:`, metadata)
              if (metadata.image) {
                const imageCid = metadata.image.replace('ipfs://', '')
                // Use gateway.pinata.cloud for images - works fine with <img> tags (no CORS issues)
                imageUrl = `https://gateway.pinata.cloud/ipfs/${imageCid}`
                console.log(`[NFT Gallery] Token ${i} image URL:`, imageUrl)
              } else {
                console.warn(`[NFT Gallery] Token ${i} metadata has no 'image' field`)
              }
            }
          } else {
            console.warn(`[NFT Gallery] Token ${i} has no tokenURI`)
          }
          
          // Add delay between NFT fetches to avoid rate limits
          await delay(500)

          nfts.push({
            tokenId: i,
            tokenURI,
            owner,
            gameId: Number(gameId),
            metadata,
            imageUrl,
            name: metadata?.name || `sk3chy #${i}`,
            description: metadata?.description || '',
            attributes: metadata?.attributes || []
          })
        } catch (e: any) {
          // Skip tokens that don't exist or have errors
          if (e?.message?.includes('ERC721NonexistentToken') || e?.message?.includes('0x7e273289')) {
            console.warn(`[NFT Gallery] Token ${i} does not exist, skipping...`)
          } else {
            console.error(`[NFT Gallery] Error fetching NFT ${i}:`, e)
          }
        }
      }

      return nfts
    } catch (error) {
      console.error('[NFT Gallery] Error fetching NFTs:', error)
      return []
    }
  }

  async function getNFTsByOwner(ownerAddress: string) {
    const allNFTs = await getAllNFTs()
    return allNFTs.filter(nft => 
      nft.owner.toLowerCase() === ownerAddress.toLowerCase()
    )
  }

  return {
    getAllNFTs,
    getNFTsByOwner
  }
}
