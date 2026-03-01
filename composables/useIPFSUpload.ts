// Using Pinata API (pinFileToIPFS endpoint) with fetch
export function useIPFSUpload() {
  const config = useRuntimeConfig()
  const uploading = ref(false)
  const error = ref<string | null>(null)
  const progress = ref(0)

  async function uploadDrawing(
    canvas: HTMLCanvasElement,
    metadata: {
      word: string
      artist: string
      artistAddress: string
      winner?: string
      winnerAddress?: string
      gameId?: number
      difficulty?: string
      duration?: number
    }
  ) {
    uploading.value = true
    error.value = null
    progress.value = 0

    try {
      const jwt = config.public.pinataJwt
      const gateway = config.public.pinataGateway

      if (!jwt) {
        throw new Error('Pinata JWT not configured. Add NUXT_PUBLIC_PINATA_JWT to your .env file')
      }

      if (!gateway) {
        throw new Error('Pinata Gateway not configured. Add NUXT_PUBLIC_PINATA_GATEWAY to your .env file')
      }

      console.log('[IPFS] Starting upload with Pinata API...')
      progress.value = 20

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to convert canvas to blob'))
          }
        }, 'image/png', 0.95)
      })

      console.log('[IPFS] Canvas converted to blob, size:', blob.size)
      progress.value = 40

      // Upload image to Pinata (using pinFileToIPFS endpoint)
      const imageFile = new File([blob], 'drawing.png', { type: 'image/png' })
      const imageFormData = new FormData()
      imageFormData.append('file', imageFile)
      
      const imageResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`
        },
        body: imageFormData
      })

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text()
        throw new Error(`Image upload failed (${imageResponse.status}): ${errorText}`)
      }

      const imageData = await imageResponse.json()
      console.log('[IPFS] Image uploaded:', imageData)
      const imageCid = imageData.IpfsHash
      progress.value = 70

      // Create and upload metadata
      const nftMetadata = {
        name: `sk3chy: ${metadata.word}`,
        description: `A drawing of "${metadata.word}" created in the sk3chy game`,
        image: `ipfs://${imageCid}`,
        external_url: 'https://sk3chy.com/gallery',
        attributes: [
          {
            trait_type: 'Word',
            value: metadata.word
          },
          {
            trait_type: 'Artist',
            value: metadata.artist
          },
          {
            trait_type: 'Artist Address',
            value: metadata.artistAddress
          },
          ...(metadata.winner ? [{
            trait_type: 'Winner',
            value: metadata.winner
          }] : []),
          ...(metadata.winnerAddress ? [{
            trait_type: 'Winner Address',
            value: metadata.winnerAddress
          }] : []),
          ...(metadata.gameId ? [{
            trait_type: 'Game ID',
            value: metadata.gameId.toString()
          }] : []),
          {
            trait_type: 'Difficulty',
            value: metadata.difficulty || 'medium'
          },
          {
            trait_type: 'Duration',
            value: metadata.duration?.toString() || '0'
          },
          {
            trait_type: 'Timestamp',
            value: Date.now().toString()
          }
        ]
      }

      // Upload metadata JSON to Pinata
      const metadataBlob = new Blob([JSON.stringify(nftMetadata)], { type: 'application/json' })
      const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' })
      const metadataFormData = new FormData()
      metadataFormData.append('file', metadataFile)
      
      const metadataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`
        },
        body: metadataFormData
      })

      if (!metadataResponse.ok) {
        const errorText = await metadataResponse.text()
        throw new Error(`Metadata upload failed (${metadataResponse.status}): ${errorText}`)
      }

      const metadataData = await metadataResponse.json()
      console.log('[IPFS] Metadata uploaded:', metadataData)
      const metadataCid = metadataData.IpfsHash
      progress.value = 100

      const result = {
        success: true,
        imageCid,
        metadataCid,
        imageUri: `ipfs://${imageCid}`,
        metadataUri: `ipfs://${metadataCid}`,
        imageUrl: `https://${gateway}/ipfs/${imageCid}`,
        metadataUrl: `https://${gateway}/ipfs/${metadataCid}`,
        metadata: nftMetadata
      }

      console.log('[IPFS] Upload complete:', result)
      return result
    } catch (e: any) {
      console.error('[IPFS] Upload error:', e)
      error.value = e.message || 'Failed to upload to IPFS'
      throw e
    } finally {
      uploading.value = false
    }
  }

  return {
    uploadDrawing,
    uploading,
    error,
    progress
  }
}
