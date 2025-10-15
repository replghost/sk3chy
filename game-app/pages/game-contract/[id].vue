<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted, watch, computed } from 'vue'
import { useRuntimeConfig } from '#app'
import confetti from 'canvas-confetti'
import { useAccount, useSignMessage, useWaitForTransactionReceipt } from '@wagmi/vue'
import YCanvas from '~/components/YCanvas.vue'
import WalletConnect from '~/components/WalletConnect.vue'
import { useDrawingGame } from '~/composables/useDrawingGame'
import { useSIWE } from '~/composables/useSIWE'
import { useGameContract } from '~/composables/useGameContract'
import { getAllDifficulties, type DifficultyLevel } from '~/utils/wordDictionary'
import contractABI from '~/utils/abi/Sk3chyGame.json'
import type { Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { passetHub } from '~/utils/chains'

const config = useRuntimeConfig()
const route = useRoute()
const roomId = `game-contract-${String(route.params.id)}`

const {
  ready, strokes, peers, guesses, brushColor, brushSize, userId, displayName,
  isHost, canDraw, gameState, timeRemaining, isRoomFull, canJoin, maxPlayers,
  start, addPoint, commitStroke, setCursor, setDisplayName, setWalletAddress, sendGuess, clearCanvas,
  generateWordOptions, selectWord, startGame, resetGame, setDifficulty, setDuration,
  getYRoom
} = useDrawingGame(roomId)

// Wallet & SIWE
const { address, isConnected } = useAccount()
const { signMessageAsync } = useSignMessage()
const isSigningIn = ref(false)
const isSiweAuthenticated = ref(false)
const siweError = ref<string | null>(null)
let siweComposable: ReturnType<typeof useSIWE> | null = null

// Smart Contract Integration
const {
  createGame: createGameOnChain,
  joinGame: joinGameOnChain,
  commitWord: commitWordOnChain,
  revealAndScore: revealAndScoreOnChain,
  usePlayerWins,
  contractAddress,
  isPending: isContractPending,
  transactionHistory,
  clearTransactionHistory,
  getExplorerUrl,
} = useGameContract()

// Contract state
const onChainGameId = ref<number | null>(null)
const wordSalt = ref<string>('')
const isCreatingGame = ref(false)
const isJoiningGame = ref(false)
const isCommittingWord = ref(false)
const isRevealingScore = ref(false)
const isWaitingForBlockchain = ref(false) // For non-host players waiting for host to submit
const contractError = ref<string | null>(null)

// Clear contract state when starting a new game
function clearContractState() {
  onChainGameId.value = null
  wordSalt.value = ''
  contractError.value = null
  console.log('[Contract] Contract state cleared for new game')
}

// Get player wins
const { data: playerWins } = usePlayerWins(address as any)

const guessInput = ref('')
const guessesContainer = ref<HTMLElement | null>(null)
const selectedWordLocal = ref<string | null>(null) // Track selected word locally for UI
const playersExpanded = ref(false) // Collapse players by default
const canvasRef = ref<any>(null) // Reference to YCanvas component
const exportedImageUrl = ref<string | null>(null) // Preview of exported PNG
const showFinishModal = ref(false) // Control modal visibility separately

// Vibrant colors that pop on black background
const drawingColors = [
  '#FFFFFF', // White
  '#FF006E', // Hot Pink
  '#00F5FF', // Cyan
  '#FFBE0B', // Yellow
  '#FB5607', // Orange
  '#8338EC', // Purple
  '#3A86FF', // Blue
  '#06FFA5', // Mint Green
]

const difficulties = getAllDifficulties()

// Separate active players from spectators
const activePlayers = computed(() => peers.value.slice(0, maxPlayers))
const spectators = computed(() => peers.value.slice(maxPlayers))

const handleSendGuess = () => {
  if (!canJoin.value) return
  if (guessInput.value.trim()) {
    sendGuess(guessInput.value)
    guessInput.value = ''
    setTimeout(() => {
      if (guessesContainer.value) {
        guessesContainer.value.scrollTop = guessesContainer.value.scrollHeight
      }
    }, 50)
  }
}

// Auto-scroll when new guesses arrive
watch(guesses, () => {
  setTimeout(() => {
    if (guessesContainer.value) {
      guessesContainer.value.scrollTop = guessesContainer.value.scrollHeight
    }
  }, 50)
}, { deep: true })

// Format time as MM:SS
const formattedTime = computed(() => {
  const minutes = Math.floor(timeRemaining.value / 60)
  const seconds = timeRemaining.value % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

// Show countdown warning in last 10 seconds
const showCountdownWarning = computed(() => timeRemaining.value <= 10 && timeRemaining.value > 0)

// Calculate actual game duration (from start to end)
const actualDuration = computed(() => {
  if (!gameState.value.startTime || !gameState.value.endTime) return 0
  return Math.floor((gameState.value.endTime - gameState.value.startTime) / 1000)
})

const formattedActualDuration = computed(() => {
  const minutes = Math.floor(actualDuration.value / 60)
  const seconds = actualDuration.value % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

// Download drawing as PNG
function downloadDrawing() {
  const canvas = canvasRef.value?.$el?.querySelector('canvas')
  if (!canvas) return
  
  // Use fixed dimensions for consistent output across devices
  const fixedWidth = 1200
  const fixedHeight = 900
  const scale = 2 // For high-res text
  
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = fixedWidth * scale
  exportCanvas.height = fixedHeight * scale
  const ctx = exportCanvas.getContext('2d')
  if (!ctx) return
  
  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  
  // Draw the original canvas scaled to fit
  const aspectRatio = canvas.width / canvas.height
  const targetAspectRatio = fixedWidth / fixedHeight
  
  let drawWidth = fixedWidth * scale
  let drawHeight = fixedHeight * scale
  let offsetX = 0
  let offsetY = 0
  
  if (aspectRatio > targetAspectRatio) {
    drawHeight = (fixedWidth / aspectRatio) * scale
    offsetY = (fixedHeight * scale - drawHeight) / 2
  } else {
    drawWidth = (fixedHeight * aspectRatio) * scale
    offsetX = (fixedWidth * scale - drawWidth) / 2
  }
  
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  ctx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight)
  
  // Draw guesses on the right side (wider area for less wrapping)
  const guessX = exportCanvas.width - 60 * scale
  const guessY = exportCanvas.height - 160 * scale
  const recentGuesses = guesses.value.slice(-8) // Last 8 guesses
  
  ctx.textAlign = 'right'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
  ctx.shadowBlur = 8 * scale
  
  recentGuesses.forEach((guess, i) => {
    const y = guessY - (recentGuesses.length - i - 1) * 24 * scale
    const peer = peers.value.find(p => p.id === guess.by)
    const color = peer?.color || '#fff'
    
    // Name on left, guess on right
    ctx.fillStyle = color
    ctx.globalAlpha = 0.5
    ctx.font = `${14 * scale}px sans-serif`
    const nameText = `${guess.displayName}:`
    const nameWidth = ctx.measureText(nameText).width
    
    // Draw name (right-aligned at guessX)
    ctx.fillText(nameText, guessX, y)
    
    // Draw guess text (right-aligned, to the left of name)
    ctx.globalAlpha = 0.8
    ctx.font = `${14 * scale}px sans-serif`
    const guessWidth = ctx.measureText(guess.text).width
    ctx.fillText(guess.text, guessX - nameWidth - 8 * scale - guessWidth, y)
  })
  
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  
  // Add info bar at the bottom
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, exportCanvas.height - 120 * scale, exportCanvas.width, 120 * scale)
  
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.font = `bold ${32 * scale}px sans-serif`
  ctx.fillText(`"${gameState.value.selectedWord}"`, exportCanvas.width / 2, exportCanvas.height - 70 * scale)
  
  if (gameState.value.winnerId) {
    ctx.font = `${24 * scale}px sans-serif`
    ctx.fillText(`🎉 Winner: ${gameState.value.winnerName}`, exportCanvas.width / 2, exportCanvas.height - 35 * scale)
  } else {
    ctx.font = `${20 * scale}px sans-serif`
    ctx.fillStyle = '#aaa'
    ctx.fillText(`Time's up - No winner`, exportCanvas.width / 2, exportCanvas.height - 35 * scale)
  }
  
  // Add sk3chy branding in lower left
  ctx.textAlign = 'left'
  ctx.fillStyle = '#888'
  ctx.font = `${18 * scale}px sans-serif`
  ctx.fillText('sk3chy', 20 * scale, exportCanvas.height - 20 * scale)
  
  // Convert to blob and create preview/download
  exportCanvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    
    // Set preview
    if (exportedImageUrl.value) {
      URL.revokeObjectURL(exportedImageUrl.value)
    }
    exportedImageUrl.value = url
    
    // Download
    const a = document.createElement('a')
    a.href = url
    a.download = `sk3chy-${gameState.value.selectedWord}-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, 'image/png', 0.95) // High quality PNG
}

// Generate preview (not download) when game finishes
function generatePreview() {
  try {
    if (!canvasRef.value?.$el) {
      console.warn('Canvas ref not available')
      showFinishModal.value = true // Show modal anyway
      return
    }
    
    const canvas = canvasRef.value.$el.querySelector('canvas')
    if (!canvas) {
      console.warn('Canvas element not found')
      showFinishModal.value = true // Show modal anyway
      return
    }
  
    // Use smaller dimensions to avoid freezing
    const fixedWidth = 800
    const fixedHeight = 600
    const scale = 1 // Reduced scale for performance
  
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = fixedWidth * scale
    exportCanvas.height = fixedHeight * scale
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) {
      showFinishModal.value = true
      return
    }
    
    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    
    // Draw the original canvas scaled to fit
    const aspectRatio = canvas.width / canvas.height
    const targetAspectRatio = fixedWidth / fixedHeight
    
    let drawWidth = fixedWidth * scale
    let drawHeight = fixedHeight * scale
    let offsetX = 0
    let offsetY = 0
    
    if (aspectRatio > targetAspectRatio) {
      drawHeight = (fixedWidth / aspectRatio) * scale
      offsetY = (fixedHeight * scale - drawHeight) / 2
    } else {
      drawWidth = (fixedHeight * aspectRatio) * scale
      offsetX = (fixedWidth * scale - drawWidth) / 2
    }
    
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    ctx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight)
    
    // Draw guesses on the right side (wider area for less wrapping)
    const guessX = exportCanvas.width - 60 * scale
    const guessY = exportCanvas.height - 160 * scale
    const recentGuesses = guesses.value.slice(-8) // Last 8 guesses
    
    ctx.textAlign = 'right'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 8 * scale
    
    recentGuesses.forEach((guess, i) => {
      const y = guessY - (recentGuesses.length - i - 1) * 24 * scale
      const peer = peers.value.find(p => p.id === guess.by)
      const color = peer?.color || '#fff'
      
      ctx.fillStyle = color
      ctx.font = `${14 * scale}px sans-serif`
      
      // Measure both texts
      const nameText = `${guess.displayName}:`
      const nameWidth = ctx.measureText(nameText).width
      const guessWidth = ctx.measureText(guess.text).width
      
      // Draw guess text first (right-aligned at guessX)
      ctx.globalAlpha = 0.8
      ctx.fillText(guess.text, guessX, y)
      
      // Draw name to the right of guess text
      ctx.globalAlpha = 0.5
      ctx.fillText(nameText, guessX + 8 * scale, y)
    })
    
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    
    // Add info bar at the bottom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, exportCanvas.height - 120 * scale, exportCanvas.width, 120 * scale)
    
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.font = `bold ${32 * scale}px sans-serif`
    ctx.fillText(`"${gameState.value.selectedWord}"`, exportCanvas.width / 2, exportCanvas.height - 70 * scale)
    
    if (gameState.value.winnerId) {
      ctx.font = `${24 * scale}px sans-serif`
      ctx.fillText(`🎉 Winner: ${gameState.value.winnerName}`, exportCanvas.width / 2, exportCanvas.height - 35 * scale)
    } else {
      ctx.font = `${20 * scale}px sans-serif`
      ctx.fillStyle = '#aaa'
      ctx.fillText(`Time's up - No winner`, exportCanvas.width / 2, exportCanvas.height - 35 * scale)
    }
    
    // Add sk3chy branding in lower left
    ctx.textAlign = 'left'
    ctx.fillStyle = '#888'
    ctx.font = `${18 * scale}px sans-serif`
    ctx.fillText('sk3chy', 20 * scale, exportCanvas.height - 20 * scale)
    
    // Convert to blob and create preview only (no download)
    // Use lower quality to speed up generation
    exportCanvas.toBlob((blob) => {
      if (!blob) {
        showFinishModal.value = true
        return
      }
      const url = URL.createObjectURL(blob)
      
      // Set preview
      if (exportedImageUrl.value) {
        URL.revokeObjectURL(exportedImageUrl.value)
      }
      exportedImageUrl.value = url
      
      // Show modal now that preview is ready
      showFinishModal.value = true
    }, 'image/png', 0.7) // Reduced quality for faster generation
  } catch (error) {
    console.error('Error generating preview:', error)
    // Show modal anyway even if preview fails
    showFinishModal.value = true
  }
}

// Generate preview when game finishes
watch(() => gameState.value.status, async (newStatus, oldStatus) => {
  console.log('[Game Page] Status changed:', oldStatus, '->', newStatus, 'showFinishModal:', showFinishModal.value)
  
  if (newStatus === 'finished' && oldStatus !== 'finished') {
    console.log('[Game Page] Game finished!')
    console.log('[Game Page] Blockchain check:', {
      isHost: isHost.value,
      isConnected: isConnected.value,
      onChainGameId: onChainGameId.value,
      wordSalt: wordSalt.value
    })
    
    // If host with blockchain, submit results first before showing modal
    if (isHost.value && isConnected.value && onChainGameId.value && wordSalt.value) {
      console.log('[Game Page] ===== STARTING BLOCKCHAIN SUBMISSION =====')
      console.log('[Game Page] About to call handleRevealAndScoreOnChain...')
      
      // Set revealing flag to show loading overlay
      console.log('[Game Page] Setting isRevealingScore = true')
      isRevealingScore.value = true
      console.log('[Game Page] isRevealingScore is now:', isRevealingScore.value)
      console.log('[Game Page] gameState.status is:', gameState.value.status)
      
      try {
        await handleRevealAndScoreOnChain()
        console.log('[Game Page] ===== BLOCKCHAIN SUBMISSION COMPLETE =====')
        console.log('[Game Page] Now showing modal')
      } catch (error) {
        console.error('[Game Page] Blockchain submission failed:', error)
        // Show modal anyway even if blockchain fails
      } finally {
        // Clear revealing flag
        isRevealingScore.value = false
      }
    } else {
      console.log('[Game Page] Skipping blockchain submission')
      
      // If connected to blockchain but not host, poll to wait for host to complete the game
      if (isConnected.value && gameState.value.onChainGameId) {
        console.log('[Game Page] Non-host polling blockchain for game completion...')
        console.log('[Game Page] Using on-chain game ID:', gameState.value.onChainGameId)
        
        // Show loading overlay for non-host
        isWaitingForBlockchain.value = true
        
        const publicClient = createPublicClient({
          chain: passetHub,
          transport: http()
        })
        
        // Poll every 2 seconds for up to 30 seconds
        const maxAttempts = 15
        let attempts = 0
        let gameCompleted = false
        
        while (attempts < maxAttempts && !gameCompleted) {
          try {
            const gameData = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: contractABI.abi,
              functionName: 'getGame',
              args: [BigInt(gameState.value.onChainGameId!)]
            }) as any
            
            // Check if game is no longer active (host completed it)
            if (!gameData[3]) { // isActive is false
              console.log('[Game Page] Game completed on blockchain!')
              gameCompleted = true
              break
            }
            
            console.log(`[Game Page] Waiting for completion... (attempt ${attempts + 1}/${maxAttempts})`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            attempts++
          } catch (error) {
            console.error('[Game Page] Error polling blockchain:', error)
            break
          }
        }
        
        if (!gameCompleted) {
          console.log('[Game Page] Timeout waiting for blockchain completion, showing modal anyway')
        }
        
        // Clear waiting flag
        isWaitingForBlockchain.value = false
      } else {
        console.log('[Game Page] No blockchain, showing modal immediately')
      }
    }
    
    console.log('[Game Page] Setting showFinishModal = true')
    // Show modal after blockchain submission (or immediately if not host/blockchain)
    showFinishModal.value = true
    console.log('[Game Page] showFinishModal is now:', showFinishModal.value)
    
    // Generate preview in background (non-blocking)
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => generatePreview(), { timeout: 2000 })
    } else {
      setTimeout(() => generatePreview(), 500)
    }
  }
  
  // Reset modal flag when leaving finished state
  if (oldStatus === 'finished' && newStatus !== 'finished') {
    showFinishModal.value = false
    exportedImageUrl.value = null
  }
}, { immediate: true })

// Trigger confetti when finish modal is shown (after blockchain submission for hosts)
watch(() => showFinishModal.value, (isShowing, wasShowing) => {
  if (isShowing && !wasShowing && gameState.value.status === 'finished' && gameState.value.winnerId) {
    // Fire confetti!
    const duration = 3000
    const end = Date.now() + duration

    const colors = ['#FF006E', '#00F5FF', '#FFBE0B', '#FB5607', '#8338EC', '#3A86FF', '#06FFA5']

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
        zIndex: 100000
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
        zIndex: 100000
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }
})

// ============ SMART CONTRACT FUNCTIONS ============

// Handle start game flow - create on-chain if needed, then generate words
async function handleStartGameFlow() {
 // If wallet connected and game not created on-chain yet, create it first
 if (isConnected.value && !onChainGameId.value) {
 console.log('[Game] Creating game on-chain before starting...')
 await handleCreateGameOnChain()
 // Only proceed if game was created successfully
 if (!onChainGameId.value) {
 console.error('[Game] Failed to create game on-chain, not starting')
 return
 }
 }
 // Proceed to word selection
 generateWordOptions()
}

// Generate random salt for commit-reveal
function generateSalt(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Switch to PAsset Hub network
async function switchToPAssetHub() {
  if (!window.ethereum) {
    contractError.value = 'MetaMask not found'
    return false
  }
  
  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x190f1b46' }], // 420420421 in hex
    })
    return true
  } catch (switchError: any) {
    // Network not added, try to add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x190f1b46',
            chainName: 'Polkadot Asset Hub Testnet',
            nativeCurrency: {
              name: 'DOT',
              symbol: 'DOT',
              decimals: 18,
            },
            rpcUrls: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
            blockExplorerUrls: ['https://blockscout-passet-hub.parity-testnet.parity.io'],
          }],
        })
        return true
      } catch (addError: any) {
        console.error('Failed to add network:', addError)
        contractError.value = 'Failed to add network to MetaMask'
        return false
      }
    } else {
      console.error('Failed to switch network:', switchError)
      contractError.value = 'Failed to switch network'
      return false
    }
  }
}

// Create game on-chain (called by host when starting)
async function handleCreateGameOnChain() {
  if (!isConnected.value) {
    contractError.value = 'Please connect your wallet first'
    return
  }
  
  // First, ensure we're on the right network
  const switched = await switchToPAssetHub()
  if (!switched) return
  
  try {
    isCreatingGame.value = true
    contractError.value = null
    
    const result = await createGameOnChain()
    console.log('[Contract] Game created, tx:', result.hash)
    
    if (result.gameId !== null && result.gameId !== undefined) {
      onChainGameId.value = result.gameId
      
      // Share with all players via Y.js
      const yroom = getYRoom()
      if (yroom) {
        yroom.game.set('onChainGameId', result.gameId)
        console.log('[Contract] On-chain game ID set in Y.js:', result.gameId)
      }
      gameState.value.onChainGameId = result.gameId
      console.log('[Contract] On-chain game ID set to:', result.gameId)
    } else {
      console.warn('[Contract] Could not extract game ID from transaction')
      contractError.value = 'Game created but could not get game ID'
    }
    
  } catch (error: any) {
    console.error('[Contract] Failed to create game:', error)
    contractError.value = error.message || 'Failed to create game'
  } finally {
    isCreatingGame.value = false
  }
}

// Join game on-chain (called by players)
async function handleJoinGameOnChain() {
  if (!isConnected.value) {
    contractError.value = 'Please connect your wallet first'
    return
  }
  
  if (!onChainGameId.value) {
    contractError.value = 'No on-chain game ID available'
    return
  }
  
  // First, ensure we're on the right network
  const switched = await switchToPAssetHub()
  if (!switched) return
  
  try {
    isJoiningGame.value = true
    contractError.value = null
    
    const txHash = await joinGameOnChain(onChainGameId.value)
    console.log('[Contract] Joined game, tx:', txHash)
    
  } catch (error: any) {
    console.error('[Contract] Failed to join game:', error)
    contractError.value = error.message || 'Failed to join game'
  } finally {
    isJoiningGame.value = false
  }
}

// Handle start game - commit to blockchain first if needed, then start
async function handleStartGame() {
  // If connected to blockchain and have a game ID, commit word first
  if (isConnected.value && onChainGameId.value && selectedWordLocal.value && !wordSalt.value) {
    await handleCommitWordOnChain(selectedWordLocal.value)
    // Only start game if commit succeeded (wordSalt will be set)
    if (wordSalt.value) {
      startGame()
    }
  } else {
    // No blockchain or already committed, just start
    startGame()
  }
}

// Commit word hash on-chain (called by host after selecting word)
async function handleCommitWordOnChain(word: string) {
  if (!isConnected.value || !isHost.value) return
  
  if (!onChainGameId.value) {
    contractError.value = 'No on-chain game ID available'
    return
  }
  
  try {
    isCommittingWord.value = true
    contractError.value = null
    
    // Generate salt and store it
    wordSalt.value = generateSalt()
    
    console.log('[Contract] Committing word with salt:', wordSalt.value)
    const txHash = await commitWordOnChain(onChainGameId.value, word, wordSalt.value)
    console.log('[Contract] Word commitment tx sent:', txHash)
    
    // Wait for transaction to be confirmed on-chain
    console.log('[Contract] Waiting for transaction confirmation...')
    const publicClient = createPublicClient({
      chain: passetHub,
      transport: http()
    })
    
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 1
    })
    
    if (receipt.status === 'success') {
      console.log('[Contract] Word committed successfully! Block:', receipt.blockNumber)
    } else {
      throw new Error('Transaction reverted')
    }
    
  } catch (error: any) {
    console.error('[Contract] Failed to commit word:', error)
    contractError.value = error.message || 'Failed to commit word'
    wordSalt.value = '' // Clear salt on failure
  } finally {
    isCommittingWord.value = false
  }
}

// Reveal and score on-chain (called by host when game ends)
async function handleRevealAndScoreOnChain() {
  if (!isConnected.value || !isHost.value) {
    console.error('[Contract] Not connected or not host')
    return
  }
  
  if (!onChainGameId.value) {
    contractError.value = 'No on-chain game ID available'
    console.error('[Contract] No game ID')
    return
  }
  
  // Wait for commit to finish if it's in progress
  if (isCommittingWord.value) {
    console.log('[Contract] Waiting for word commit to finish...')
    contractError.value = 'Waiting for word commitment to complete...'
    // Wait up to 30 seconds for commit to finish
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 500))
      if (!isCommittingWord.value) break
    }
  }
  
  if (!wordSalt.value) {
    contractError.value = 'Word salt not found - did you commit the word?'
    console.error('[Contract] No salt found!')
    return
  }
  
  if (!gameState.value.selectedWord) {
    contractError.value = 'No word selected'
    console.error('[Contract] No word selected!')
    return
  }
  
  console.log('[Contract] === REVEAL DEBUG ===')
  console.log('[Contract] Game ID:', onChainGameId.value)
  console.log('[Contract] Word:', gameState.value.selectedWord)
  console.log('[Contract] Salt:', wordSalt.value)
  console.log('[Contract] Host address:', address.value)
  
  try {
    contractError.value = null
    
    // Get winners and scores from game state
    // Only include active players (first maxPlayers), exclude spectators
    const winners: Address[] = []
    const scores: number[] = []
    
    guesses.value.forEach(guess => {
      if (guess.text.toLowerCase() === gameState.value.selectedWord?.toLowerCase()) {
        const peer = peers.value.find(p => p.id === guess.by)
        if (peer?.walletAddress) {
          const peerGuesses = guesses.value.filter(g => g.by === guess.by).length
          winners.push(peer.walletAddress as Address)
          scores.push(peerGuesses * 10) // 10 points per guess
        }
      }
    })
    
    console.log('[Contract] Winners:', winners)
    console.log('[Contract] Scores:', scores)
    
    // This now waits for confirmation internally before returning
    const txHash = await revealAndScoreOnChain(
      onChainGameId.value,
      gameState.value.selectedWord || '',
      wordSalt.value,
      winners,
      scores
    )
    
    console.log('[Contract] Results submitted and confirmed, tx:', txHash)
    
  } catch (error: any) {
    console.error('[Contract] Failed to reveal and score:', error)
    contractError.value = error.message || 'Failed to submit results'
  } 
}

// Auto-commit word when host selects it
watch(() => gameState.value.selectedWord, (newWord) => {
  console.log('[Contract] Word changed:', newWord, {
    isHost: isHost.value,
    isConnected: isConnected.value,
    onChainGameId: onChainGameId.value,
    hasSalt: !!wordSalt.value
  })
  
  if (newWord && isHost.value && isConnected.value && onChainGameId.value && !wordSalt.value) {
    console.log('[Contract] Auto-committing word on selection')
    handleCommitWordOnChain(newWord)
  }
})

// ============ END SMART CONTRACT FUNCTIONS ============

// SIWE Sign In
async function handleSiweSignIn() {
  if (!address.value) {
    siweError.value = 'Please connect your wallet first'
    return
  }
  
  if (!siweComposable) {
    siweError.value = 'SIWE not initialized yet, please wait'
    return
  }
  
  isSigningIn.value = true
  siweError.value = null
  
  try {
    await siweComposable.signIn(address.value, async (message: string) => {
      return await signMessageAsync({ message })
    })
    
    isSiweAuthenticated.value = true
    console.log('[SIWE] Successfully authenticated:', address.value)
  } catch (err: any) {
    console.error('[SIWE] Sign in error:', err)
    siweError.value = err.message || 'Failed to sign in'
  } finally {
    isSigningIn.value = false
  }
}

// Check if a peer is SIWE authenticated
function isPeerAuthenticated(peerId: string): boolean {
  if (!siweComposable) {
    console.log('[isPeerAuthenticated] No SIWE composable')
    return false
  }
  const verifiedUsers = siweComposable.getVerifiedUsers()
  console.log('[isPeerAuthenticated] Verified users:', Array.from(verifiedUsers.keys()))
  
  // Check if any verified address matches this peer's awareness state
  const peer = peers.value.find(p => p.id === peerId)
  if (!peer?.address) {
    console.log('[isPeerAuthenticated] No address for peer:', peerId)
    return false
  }
  const peerAddress = typeof peer.address === 'string' ? peer.address : String(peer.address)
  console.log('[isPeerAuthenticated] Checking address:', peerAddress)
  
  // Check both original case and lowercase
  const hasOriginal = verifiedUsers.has(peerAddress)
  const hasLower = verifiedUsers.has(peerAddress.toLowerCase())
  console.log('[isPeerAuthenticated] Has original:', hasOriginal, 'Has lower:', hasLower)
  
  return hasOriginal || hasLower
}

// Get truncated address for a peer
function getPeerAddress(peerId: string): string | null {
  const peer = peers.value.find(p => p.id === peerId)
  if (!peer?.address) {
    console.log('[getPeerAddress] No address for peer:', peerId, peer)
    return null
  }
  if (!isPeerAuthenticated(peerId)) {
    console.log('[getPeerAddress] Peer not authenticated:', peerId)
    return null
  }
  const addr = typeof peer.address === 'string' ? peer.address : String(peer.address)
  const truncated = `${addr.slice(0, 6)}...${addr.slice(-4)}`
  console.log('[getPeerAddress] Returning address:', truncated, 'for peer:', peerId)
  return truncated
}

// Copy address to clipboard
function copyAddress(address: string | number) {
  const addr = typeof address === 'string' ? address : String(address)
  window.navigator.clipboard.writeText(addr)
}

onMounted(() => {
  // Build ICE servers array - keep it minimal to avoid "5+ servers" warning
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' }
  ]

  // Add TURN server only if credentials are configured and valid
  // Use only 2 TURN URLs to avoid "5+ servers" warning
  if (config.public.turnUsername && config.public.turnCredential && 
      config.public.turnUsername.length > 0 && config.public.turnCredential.length > 0) {
    console.log('[Game] TURN server configured')
    iceServers.push({
      urls: [
        'turn:a.relay.metered.ca:443',
        'turn:a.relay.metered.ca:443?transport=tcp'
      ],
      username: config.public.turnUsername,
      credential: config.public.turnCredential
    })
  } else {
    console.log('[Game] Using STUN-only (no TURN servers - this is fine for local testing)')
  }

  start({ iceServers })
})

// Initialize SIWE when room is ready
watch(ready, (isReady) => {
  if (isReady && !siweComposable) {
    const yroom = getYRoom()
    if (yroom) {
      siweComposable = useSIWE(yroom)
      console.log('[SIWE] Initialized')
      
      // Set wallet address if already connected
      if (isConnected.value && address.value) {
        setWalletAddress(address.value)
        console.log('[Wallet] Set address on ready:', address.value)
      }
    }
  }
})

// Watch wallet connection and update awareness
watch([address, isConnected], ([newAddress, newIsConnected]) => {
  // Update awareness with wallet info
  console.log('[Wallet] Status changed:', { address: newAddress, connected: newIsConnected })
  if (ready.value) {
    if (newIsConnected && newAddress) {
      setWalletAddress(newAddress)
      console.log('[Wallet] Set address:', newAddress)
    } else {
      setWalletAddress(null)
      console.log('[Wallet] Cleared address')
    }
  }
})
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>

<template>
  <!-- Full-screen Lobby for Waiting State -->
  <div v-if="gameState.status === 'waiting'" class="flex items-center justify-center p-6 py-16">
    <div class="max-w-6xl w-full">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-2">{{ isHost ? 'sk3chy Game Lobby: You are the host' : 'sk3chy Game Lobby' }}</h1>
        <p class="text-gray-600 dark:text-gray-400">Room: {{ roomId }}</p>
      </div>

      <!-- Two Column Layout -->
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Left: Players List -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
            <span>👥</span>
            <span>Players</span>
            <span class="text-sm font-normal" :class="isRoomFull ? 'text-red-500' : 'text-gray-500'">
              {{ activePlayers.length }}/{{ maxPlayers }}
            </span>
            <span v-if="isRoomFull" class="text-xs font-normal text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
              FULL
            </span>
          </h2>
          
          <!-- Active Players -->
          <div class="grid grid-cols-2 gap-2 mb-4">
            <div 
              v-for="peer in activePlayers" 
              :key="peer.id"
              class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700 transition-all hover:scale-105"
              :class="{ 'ring-2 ring-primary': peer.id === userId }"
            >
              <div 
                class="w-8 h-8 rounded-full flex-shrink-0" 
                :style="{ backgroundColor: peer.color || '#0aa' }"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold truncate flex items-center gap-1">
                  {{ peer.displayName || 'Anonymous' }}
                  <span v-if="isPeerAuthenticated(peer.id)" class="text-green-500" title="SIWE Authenticated">🔐</span>
                  <span v-if="peer.id === userId" class="text-xs text-gray-500">(you)</span>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 flex-wrap">
                  <span v-if="peer.id === gameState.hostId">🎨 Host</span>
                  <span v-else>👀 Player</span>
                  <!-- Show address if wallet connected (even without SIWE) -->
                  <UPopover v-if="peer.address" mode="hover" :open-delay="100" :close-delay="200" :popper="{ placement: 'top', offsetDistance: 8 }">
                    <span 
                      class="font-mono cursor-pointer hover:underline inline-flex items-center gap-0.5 whitespace-nowrap" 
                      :class="isPeerAuthenticated(peer.id) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'"
                    >
                      <span>·</span>
                      <span>{{ typeof peer.address === 'string' ? `${peer.address.slice(0, 6)}...${peer.address.slice(-4)}` : peer.address }}</span>
                      <span v-if="isPeerAuthenticated(peer.id)" class="text-green-500">✓</span>
                    </span>
                    <template #panel="{ close }">
                      <div class="p-2 flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                        <span class="text-xs font-mono">{{ typeof peer.address === 'string' ? peer.address : String(peer.address) }}</span>
                        <UButton 
                          size="xs" 
                          color="gray" 
                          variant="ghost"
                          icon="i-heroicons-clipboard-document"
                          @click="() => { copyAddress(peer.address); close(); }"
                        />
                      </div>
                    </template>
                  </UPopover>
                </div>
              </div>
            </div>
            
            <!-- Empty state -->
            <div v-if="activePlayers.length === 0" class="col-span-2 text-center py-8 text-gray-400">
              <p>Waiting for players to join...</p>
            </div>
          </div>
          
          <!-- Spectators Section -->
          <div v-if="spectators.length > 0" class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
            <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <span>👁️</span>
              <span>Spectators</span>
              <span class="text-xs font-normal">{{ spectators.length }}</span>
            </h3>
            <div class="grid grid-cols-2 gap-2 mb-4">
              <div 
                v-for="peer in spectators" 
                :key="peer.id"
                class="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 transition-all hover:scale-105"
                :class="{ 'ring-2 ring-yellow-400': peer.id === userId }"
              >
                <div 
                  class="w-6 h-6 rounded-full flex-shrink-0 opacity-60" 
                  :style="{ backgroundColor: peer.color || '#0aa' }"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold truncate flex items-center gap-1 text-yellow-700 dark:text-yellow-400">
                    {{ peer.displayName || 'Anonymous' }}
                    <span v-if="peer.id === userId" class="text-[10px]">(you)</span>
                  </div>
                  <div class="text-[10px] text-yellow-600 dark:text-yellow-500">
                    Watching
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Room Full Warning -->
          <div v-if="isRoomFull && !canJoin" class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div class="flex items-start gap-2">
              <span class="text-red-500 text-lg">⚠️</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-red-900 dark:text-red-100">Room is Full</p>
                <p class="text-xs text-red-700 dark:text-red-300 mt-1">
                  This room has reached the maximum of {{ maxPlayers }} players. You can spectate but cannot join the game.
                </p>
              </div>
            </div>
          </div>

          <!-- Your Name Input -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div>
              <label class="block text-sm font-medium mb-2">Your Name</label>
              <UInput 
                v-model="displayName" 
                placeholder="Enter your name"
                size="md"
                @update:model-value="setDisplayName"
              />
            </div>
            
            <!-- SIWE Authentication (Optional) -->
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div class="flex items-start gap-2 mb-2">
                <span class="text-lg">🔐</span>
                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100">Optional: Sign In with Ethereum</h3>
                  <p class="text-xs text-blue-700 dark:text-blue-300 mt-0.5">Verify your identity with a signature (optional)</p>
                </div>
              </div>
              
              <div class="space-y-2">
                <WalletConnect />
                
                <UButton
                  v-if="isConnected && !isSiweAuthenticated"
                  @click="handleSiweSignIn"
                  :loading="isSigningIn"
                  color="primary"
                  size="sm"
                  block
                >
                  Sign Message to Verify
                </UButton>
                
                <div v-if="isSiweAuthenticated" class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded px-2 py-1.5">
                  <span>✓</span>
                  <span>Verified as {{ address?.slice(0, 6) }}...{{ address?.slice(-4) }}</span>
                </div>
                
                <p v-if="siweError" class="text-xs text-red-600 dark:text-red-400">
                  {{ siweError }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Game Settings -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span>
            <span>Game Settings</span>
            <span v-if="!isHost" class="text-sm font-normal text-gray-500">(Host only)</span>
          </h2>

          <div class="space-y-6">
            <!-- Difficulty -->
            <div>
              <label class="block text-sm font-medium mb-3">Difficulty</label>
              <div class="flex gap-2">
                <button
                  v-for="diff in difficulties"
                  :key="diff"
                  @click="isHost && setDifficulty(diff)"
                  :disabled="!isHost"
                  class="flex-1 py-3 px-2 rounded-lg font-medium transition-all text-sm"
                  :class="[
                    gameState.difficulty === diff 
                      ? 'bg-primary text-white shadow-lg scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                    !isHost && 'cursor-not-allowed opacity-60'
                  ]"
                >
                  {{ diff }}
                </button>
              </div>
            </div>

            <!-- Duration -->
            <div>
              <label class="block text-sm font-medium mb-3">Time Limit</label>
              <div class="flex gap-2">
                <button
                  @click="isHost && setDuration(20)"
                  :disabled="!isHost"
                  class="flex-1 py-3 px-2 rounded-lg font-medium transition-all text-sm"
                  :class="[
                    gameState.duration === 20 
                      ? 'bg-primary text-white shadow-lg scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                    !isHost && 'cursor-not-allowed opacity-60'
                  ]"
                >
                  20s
                </button>
                <button
                  @click="isHost && setDuration(60)"
                  :disabled="!isHost"
                  class="flex-1 py-3 px-2 rounded-lg font-medium transition-all text-sm"
                  :class="[
                    gameState.duration === 60 
                      ? 'bg-primary text-white shadow-lg scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                    !isHost && 'cursor-not-allowed opacity-60'
                  ]"
                >
                  1m
                </button>
                <button
                  @click="isHost && setDuration(180)"
                  :disabled="!isHost"
                  class="flex-1 py-3 px-2 rounded-lg font-medium transition-all text-sm"
                  :class="[
                    gameState.duration === 180 
                      ? 'bg-primary text-white shadow-lg scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                    !isHost && 'cursor-not-allowed opacity-60'
                  ]"
                >
                  3m
                </button>
                <button
                  @click="isHost && setDuration(300)"
                  :disabled="!isHost"
                  class="flex-1 py-3 px-2 rounded-lg font-medium transition-all text-sm"
                  :class="[
                    gameState.duration === 300 
                      ? 'bg-primary text-white shadow-lg scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                    !isHost && 'cursor-not-allowed opacity-60'
                  ]"
                >
                  5m
                </button>
              </div>
            </div>


            <!-- Start Button -->
            <div class="pt-4">
              <UButton
                v-if="isHost"
                @click="handleStartGameFlow"
                :disabled="isCreatingGame"
                :loading="isCreatingGame"
                color="primary"
                size="xl"
                block
                class="font-bold text-lg"
              >
                {{ isCreatingGame ? 'Creating Game On-Chain...' : (isConnected && !onChainGameId ? '🎮 Start Game (On-Chain)' : '🎮 Start Game') }}
              </UButton>
              <div v-else class="text-center p-4">
                <p class="text-gray-500 dark:text-gray-400">Waiting for host to start...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction History (if any transactions exist) -->
      <div v-if="transactionHistory.length > 0" class="mt-6">
        <TransactionHistory 
          :transactions="transactionHistory" 
          @clear="clearTransactionHistory"
        />
      </div>
    </div>
  </div>

  <!-- Game UI (for other states) -->
  <section v-else class="p-3 space-y-2">
    <!-- Compact header -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <UInput 
          v-model="displayName" 
          placeholder="Your name"
          size="xs"
          class="w-32"
          @update:model-value="setDisplayName"
        />
        <UBadge 
          :color="isHost ? 'green' : 'gray'" 
          variant="soft"
          size="xs"
        >
          {{ isHost ? '🎨' : '👀' }}
        </UBadge>
        <UBadge 
          v-if="gameState.status === 'playing'"
          color="blue"
          variant="soft"
          size="xs"
        >
          {{ formattedTime }}
        </UBadge>
        <UBadge 
          v-if="showCountdownWarning"
          color="red"
          variant="solid"
          size="xs"
          class="animate-pulse"
        >
          {{ timeRemaining }}
        </UBadge>
      </div>
      
      <!-- Collapsible Players -->
      <div class="relative">
        <button 
          @click="playersExpanded = !playersExpanded"
          class="flex items-center gap-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <span>{{ peers.length }} {{ peers.length === 1 ? 'player' : 'players' }}</span>
          <span class="text-gray-400">{{ playersExpanded ? '▼' : '▶' }}</span>
        </button>
        <div 
          v-if="playersExpanded"
          class="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded border shadow-lg p-2 min-w-[150px] z-20"
        >
          <div class="space-y-1 max-h-[200px] overflow-y-auto">
            <div 
              v-for="peer in peers" 
              :key="peer.id"
              class="flex items-center gap-2 text-xs"
            >
              <div 
                class="w-2 h-2 rounded-full" 
                :style="{ backgroundColor: peer.color || '#0aa' }"
              />
              <div class="flex-1 min-w-0">
                <div class="truncate" :class="{ 'font-semibold': peer.id === userId }">
                  {{ peer.displayName || 'Anonymous' }}
                  <span v-if="peer.id === gameState.hostId">🎨</span>
                  <span v-if="peer.id === gameState.winnerId">🏆</span>
                  <span v-if="isPeerAuthenticated(peer.id)" class="text-green-500" title="SIWE Verified">🔐</span>
                </div>
                <UPopover v-if="peer.address" mode="hover" :open-delay="100" :close-delay="200" :popper="{ placement: 'right', offsetDistance: 8 }">
                  <div 
                    class="text-[10px] font-mono truncate cursor-pointer hover:underline" 
                    :class="isPeerAuthenticated(peer.id) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'"
                  >
                    {{ typeof peer.address === 'string' ? `${peer.address.slice(0, 6)}...${peer.address.slice(-4)}` : peer.address }}
                    <span v-if="isPeerAuthenticated(peer.id)" class="text-green-500">✓</span>
                  </div>
                  <template #panel="{ close }">
                    <div class="p-2 flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      <span class="text-xs font-mono">{{ typeof peer.address === 'string' ? peer.address : String(peer.address) }}</span>
                      <UButton 
                        size="xs" 
                        color="gray" 
                        variant="ghost"
                        icon="i-heroicons-clipboard-document"
                        @click="() => { copyAddress(peer.address); close(); }"
                      />
                    </div>
                  </template>
                </UPopover>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Compact controls row -->
    <div class="flex items-center gap-2 flex-wrap text-xs">


        <!-- Host Controls - Playing -->
        <template v-if="isHost && gameState.status === 'playing'">
          <div class="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-green-700 dark:text-green-400 font-semibold">
            {{ selectedWordLocal }}
          </div>
          <UButton 
            @click="clearCanvas" 
            color="red" 
            variant="soft" 
            size="xs"
          >
            Clear
          </UButton>
          <UButton 
            @click="() => { resetGame(); clearContractState() }" 
            color="gray" 
            variant="soft" 
            size="xs"
          >
            End
          </UButton>
        </template>


        <!-- Waiting messages -->
        <span v-if="!isHost && gameState.status === 'waiting'" class="text-gray-500 text-xs">
          Waiting for host...
        </span>
    </div>

    <!-- Non-host waiting screen during word selection -->
    <div v-if="!isHost && gameState.status === 'selecting'" class="flex items-center justify-center p-6 min-h-[80vh]">
      <div class="text-center max-w-2xl w-full">
        <div class="animate-spin w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"></div>
        <h2 class="text-2xl font-bold mb-2">Host is choosing a word...</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-8">The game will start soon</p>
        
        <!-- Players List -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mt-8">
          <h3 class="text-lg font-semibold mb-4 flex items-center justify-center gap-2">
            <span>👥</span>
            <span>Players</span>
            <span class="text-sm font-normal text-gray-500">{{ peers.length }}</span>
          </h3>
          
          <div class="grid grid-cols-2 gap-2">
            <div 
              v-for="peer in peers" 
              :key="peer.id"
              class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700"
              :class="{ 'ring-2 ring-primary': peer.id === userId }"
            >
              <div 
                class="w-8 h-8 rounded-full flex-shrink-0" 
                :style="{ backgroundColor: peer.color || '#0aa' }"
              />
              <div class="flex-1 min-w-0 text-left">
                <div class="text-sm font-semibold truncate flex items-center gap-1">
                  {{ peer.displayName || 'Anonymous' }}
                  <span v-if="isPeerAuthenticated(peer.id)" class="text-green-500" title="SIWE Authenticated">🔐</span>
                  <span v-if="peer.id === userId" class="text-xs text-gray-500">(you)</span>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 flex-wrap">
                  <span v-if="peer.id === gameState.hostId">🎨 Host</span>
                  <span v-else>👀 Player</span>
                  <!-- Show address if wallet connected -->
                  <UPopover v-if="peer.address" mode="hover" :open-delay="100" :close-delay="200" :popper="{ placement: 'top', offsetDistance: 8 }">
                    <span 
                      class="font-mono cursor-pointer hover:underline inline-flex items-center gap-0.5 whitespace-nowrap" 
                      :class="isPeerAuthenticated(peer.id) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'"
                    >
                      <span>·</span>
                      <span>{{ typeof peer.address === 'string' ? `${peer.address.slice(0, 6)}...${peer.address.slice(-4)}` : peer.address }}</span>
                      <span v-if="isPeerAuthenticated(peer.id)" class="text-green-500">✓</span>
                    </span>
                    <template #panel="{ close }">
                      <div class="p-2 flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                        <span class="text-xs font-mono">{{ typeof peer.address === 'string' ? peer.address : String(peer.address) }}</span>
                        <UButton 
                          size="xs" 
                          color="gray" 
                          variant="ghost"
                          icon="i-heroicons-clipboard-document"
                          @click="() => { copyAddress(peer.address); close(); }"
                        />
                      </div>
                    </template>
                  </UPopover>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Full-screen Word Selection for Host -->
    <div v-if="isHost && gameState.status === 'selecting'" class="flex items-center justify-center p-6 min-h-[80vh]">
      <div class="max-w-4xl w-full">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 class="text-3xl font-bold mb-2 text-center">Choose Your BIP-39 Word</h2>
          <p class="text-gray-600 dark:text-gray-400 text-center mb-8">
            Select a word to draw for the other players
          </p>
          
          <!-- Word Options - 3 across -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button
              v-for="word in gameState.wordOptions"
              :key="word"
              @click="() => { 
                selectWord(word); 
                selectedWordLocal = word;
              }"
              class="group relative p-8 rounded-xl border-4 transition-all hover:scale-105"
              :class="selectedWordLocal === word 
                ? 'border-primary bg-primary/10 shadow-lg' 
                : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'"
            >
              <div class="text-center">
                <div class="text-3xl font-bold" :class="selectedWordLocal === word ? 'text-primary' : 'text-gray-900 dark:text-white'">
                  {{ word }}
                </div>
                <div v-if="selectedWordLocal === word" class="text-primary text-xl mt-2">
                  ✓
                </div>
              </div>
            </button>
          </div>

          <!-- Start Button -->
          <div class="flex flex-col items-center gap-3">
            <UButton
              v-if="gameState.wordCommitment"
              @click="handleStartGame"
              :disabled="isCommittingWord"
              :loading="isCommittingWord"
              color="primary"
              size="xl"
              class="font-bold text-lg px-12"
            >
              {{ isCommittingWord ? 'Committing to Blockchain...' : `🎮 Start Drawing! (${gameState.duration < 60 ? `${gameState.duration}s` : `${Math.floor(gameState.duration / 60)}m`})` }}
            </UButton>
            <div v-else class="text-gray-500 dark:text-gray-400">
              Select a word to continue...
            </div>
            
            <!-- Show blockchain status -->
            <div v-if="isConnected && onChainGameId && gameState.wordCommitment" class="text-xs text-gray-500">
              {{ wordSalt ? '✓ Word committed on-chain' : 'Will commit word to blockchain when you start' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Canvas with overlay -->
    <div v-if="gameState.status === 'playing' || gameState.status === 'finished'" class="relative">
      <YCanvas
        ref="canvasRef"
        v-if="ready"
        :strokes="strokes"
        :peers="peers"
        :canDraw="canDraw"
        v-model:brushColor="brushColor"
        v-model:brushSize="brushSize"
        :onPoint="(x,y)=>addPoint(x,y)"
        :onCommit="commitStroke"
        :onCursor="setCursor"
      />
      <p v-else>Connecting…</p>

      <!-- Word Length Hint (letter underlines) -->
      <div v-if="(gameState.status === 'playing' || gameState.status === 'finished') && (gameState.wordLength || gameState.selectedWord)" class="absolute top-4 md:top-8 left-1/2 transform -translate-x-1/2 pointer-events-none z-20">
        <div class="flex gap-3 md:gap-6">
          <div 
            v-for="(letter, index) in (gameState.status === 'finished' && gameState.selectedWord ? gameState.selectedWord : Array(gameState.wordLength).fill(''))" 
            :key="index"
            class="w-5 h-8 md:w-8 md:h-12 border-b-2 md:border-b-4 border-gray-800 dark:border-white flex flex-col items-center justify-end pb-0.5 md:pb-1"
          >
            <span v-if="gameState.status === 'finished' && letter" class="text-lg md:text-2xl font-bold text-gray-800 dark:text-white">
              {{ letter.toLowerCase() }}
            </span>
          </div>
        </div>
      </div>

      <!-- Guesses overlay -->
      <div v-if="ready && (gameState.status === 'playing' || gameState.status === 'finished')" class="absolute bottom-16 right-4 w-64 pointer-events-none select-none z-10">
        <!-- Guesses list with fade at top -->
        <div class="relative max-h-[250px]">
          <div 
            ref="guessesContainer"
            class="overflow-y-auto p-2 space-y-1 max-h-[250px] pointer-events-auto scrollbar-hide"
            style="mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 100%); scrollbar-width: none; -ms-overflow-style: none;"
          >
            <div 
              v-for="guess in guesses" 
              :key="guess.id"
              class="text-xs text-right"
              style="text-shadow: 0 0 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.9)"
            >
              <span 
                class="opacity-80"
                :style="{ color: peers.find(p => p.id === guess.by)?.color || '#fff' }"
              >
                {{ guess.displayName }}: {{ guess.text }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Color picker overlay (bottom center, only for host during playing) -->
      <div v-if="ready && isHost && gameState.status === 'playing'" class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div class="flex gap-1 bg-black/40 backdrop-blur-sm rounded-full p-2">
          <button
            v-for="color in drawingColors"
            :key="color"
            @click="brushColor = color"
            class="w-8 h-8 rounded-full border-2 transition-all pointer-events-auto"
            :class="brushColor === color ? 'border-white scale-110' : 'border-gray-600/50 hover:scale-105'"
            :style="{ backgroundColor: color }"
          />
        </div>
      </div>

      <!-- Input area (separate, only for viewers during playing) -->
      <div v-if="ready && !isHost && gameState.status === 'playing'" class="absolute bottom-4 right-4 w-64 p-2 pointer-events-auto z-10 bg-black/30 backdrop-blur-sm rounded-lg">
        <!-- Spectator Warning -->
        <div v-if="!canJoin" class="mb-2 text-xs text-yellow-300 bg-yellow-900/30 px-2 py-1 rounded flex items-center gap-1">
          <span>👁️</span>
          <span>Spectating only</span>
        </div>
        
        <div class="flex gap-1">
          <UInput 
            v-model="guessInput"
            :placeholder="canJoin ? 'guess...' : 'spectating...'"
            :disabled="!canJoin"
            size="xs"
            class="flex-1 transition-opacity"
            :class="{ 'opacity-50 cursor-not-allowed': !canJoin }"
            :ui="{ base: 'bg-white/10 border-white/20 text-white placeholder-white/40' }"
            @keydown.enter.prevent="handleSendGuess"
          />
          <UButton 
            @click="handleSendGuess"
            :disabled="!canJoin"
            size="xs"
            color="gray"
            variant="ghost"
            class="opacity-60 hover:opacity-100"
            :class="{ 'opacity-30 cursor-not-allowed': !canJoin }"
          >
            →
          </UButton>
        </div>
      </div>
    </div>
  </section>

  <!-- Blockchain Submission Loading Overlay -->
  <div v-if="(isRevealingScore || isWaitingForBlockchain) && gameState.status === 'finished'" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center" style="z-index: 100000;">
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 text-center max-w-md">
      <div class="text-4xl mb-4">⏳</div>
      <h3 class="text-xl font-bold mb-2">
        {{ isRevealingScore ? 'Submitting Results to Blockchain' : 'Waiting for Results' }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ isRevealingScore ? 'Please wait while we commit the game results on-chain...' : 'Waiting for host to submit results to blockchain...' }}
      </p>
      <div class="flex justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    </div>
  </div>

  <!-- Game Finished Modal (outside section so it's always available) -->
  <div v-if="showFinishModal && gameState.status === 'finished'" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4" style="z-index: 99999;" @click.self="() => { resetGame(); clearContractState(); selectedWordLocal = null; showFinishModal = false }">
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] md:max-h-none overflow-y-auto p-3 md:p-6 relative">
      <!-- Close button (mobile only) -->
      <button
        @click="() => { resetGame(); clearContractState(); selectedWordLocal = null; showFinishModal = false }"
        class="md:hidden absolute top-2 left-2 p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors z-10"
        title="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <!-- Responsive Layout: Horizontal on desktop, Vertical on mobile -->
      <div class="flex flex-col md:flex-row gap-3 md:gap-6">
        <!-- PNG Preview (optional - loads in background) -->
        <div v-if="exportedImageUrl" class="flex-shrink-0 md:w-1/2 relative mx-auto max-w-[80vw] md:max-w-none">
          <div class="rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 aspect-[4/3] md:aspect-auto md:h-auto flex items-center justify-center bg-black">
            <img :src="exportedImageUrl" alt="Drawing" class="w-full h-full object-contain" />
          </div>
          <!-- Download button overlay -->
          <button
            @click="downloadDrawing"
            class="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-all"
            title="Download PNG"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
        
        <!-- Loading placeholder while preview generates -->
        <div v-else class="flex-shrink-0 md:w-1/2 relative">
          <div class="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 h-64 md:h-full flex items-center justify-center">
            <div class="text-center text-gray-400">
              <div class="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
              <p class="text-sm">Generating preview...</p>
            </div>
          </div>
        </div>
        
        <!-- Info Panel -->
        <div class="flex-1 flex flex-col justify-between min-h-0">
          <div>
            <h2 class="text-xl md:text-3xl font-bold mb-2 md:mb-3">Game Over!</h2>
            
            <div class="space-y-2 md:space-y-3">
              <div>
                <p class="text-gray-600 dark:text-gray-400 text-xs mb-1">The word was:</p>
                <p class="text-xl md:text-3xl font-bold text-primary">{{ gameState.selectedWord }}</p>
              </div>
              
              <div v-if="gameState.winnerId">
                <p class="text-gray-600 dark:text-gray-400 text-xs mb-1">Winner:</p>
                <p class="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">
                  🏆 {{ gameState.winnerName }}
                </p>
              </div>
              <div v-else>
                <p class="text-gray-600 dark:text-gray-400 text-xs mb-1">Result:</p>
                <p class="text-lg md:text-xl font-semibold text-gray-500">
                  ⏱️ Time's up - No winner
                </p>
              </div>

              <div class="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-2">
                  <span>Commitment Verification:</span>
                  <div v-if="gameState.commitmentVerified !== null" class="inline-flex items-center gap-1 px-2 py-1 rounded-full" :class="gameState.commitmentVerified ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'">
                    <span>{{ gameState.commitmentVerified ? '✓' : '✗' }}</span>
                    <span class="hidden md:inline">{{ gameState.commitmentVerified ? 'Verified' : 'Failed' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-3 md:mt-4 flex justify-center">
            <UButton
              @click.stop="() => { console.log('Reset clicked'); resetGame(); clearContractState(); selectedWordLocal = null; showFinishModal = false }"
              color="primary"
              size="lg"
            >
              New Game (Become Host)
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
