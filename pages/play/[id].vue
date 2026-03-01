<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useRuntimeConfig } from '#app'
import confetti from 'canvas-confetti'
import YCanvas from '~/components/YCanvas.vue'
import { useDrawingGame } from '~/composables/useDrawingGame'
import { useBrowserKeys } from '~/composables/useBrowserKeys'
import { useUsernameRegistration } from '~/composables/useUsernameRegistration'
import { useLogger } from '~/composables/useLogger'
import { getAllDifficulties, type DifficultyLevel } from '~/utils/wordDictionary'

const config = useRuntimeConfig()
const route = useRoute()
const roomId = `play-${String(route.params.id)}`
const keys = useBrowserKeys()
const registration = useUsernameRegistration()
const { addLog } = useLogger()
const showOnboarding = useState<boolean>('showOnboarding')
const onboardingRequireOnChain = useState<boolean>('onboardingRequireOnChain', () => false)
const onboardingChainEndpoint = useState<string>('onboardingChainEndpoint', () => '')

const {
  ready, strokes, lobbyStrokes, peers, guesses, brushColor, brushSize, userId, displayName,
  isHost, isDrawer, canDraw, gameState, timeRemaining, isRoomFull, canJoin, isSpectator, hintLetters,
  maxPlayers, electionInProgress,
  start, addPoint, commitStroke, setCursor, setDisplayName, sendGuess,
  undoStroke, clearCanvas, addLobbyPoint, commitLobbyStroke, clearLobbyStrokes,
  generateWordOptions, selectWord, startGame, requestNewGame, setDifficulty, setDuration,
  advanceRound
} = useDrawingGame(roomId)

// Split peers into active players and spectators
const activePlayers = computed(() => {
  const ids = gameState.value.activePlayerIds
  if (!ids) return peers.value // No game in progress — everyone is a player
  return peers.value.filter(p => ids.includes(p.id))
})
const spectators = computed(() => {
  const ids = gameState.value.activePlayerIds
  if (!ids) return []
  return peers.value.filter(p => !ids.includes(p.id))
})

// Chain / endpoint options
const CHAIN_OPTIONS = [
  { label: 'PreviewNet', endpoint: 'wss://previewnet.substrate.dev/people' },
  { label: 'PoP People', endpoint: 'wss://pop3-testnet.parity-lab.parity.io/people' },
]

// Allow custom endpoint from env (useful for local testing with mock servers)
const customEndpoint = config.public.statementStoreWs as string
if (customEndpoint && !CHAIN_OPTIONS.some(c => c.endpoint === customEndpoint)) {
  CHAIN_OPTIONS.push({ label: 'Custom', endpoint: customEndpoint })
}

const ALLOWED_ENDPOINTS = new Set(CHAIN_OPTIONS.map((chain) => chain.endpoint))

// Check URL for chain override, otherwise use config default.
// To keep behavior aligned with sdchat, only allow configured endpoints.
const urlChainRaw = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('chain') : null
const urlChain = urlChainRaw && ALLOWED_ENDPOINTS.has(urlChainRaw) ? urlChainRaw : null
const configuredEndpointRaw = config.public.statementStoreWs as string
const configuredEndpoint = ALLOWED_ENDPOINTS.has(configuredEndpointRaw)
  ? configuredEndpointRaw
  : CHAIN_OPTIONS[0].endpoint
const selectedEndpoint = ref(
  urlChain || configuredEndpoint
)
const connecting = ref(false)
const connectionError = ref<string | null>(null)
const selectedChainLabel = computed(() => {
  const match = CHAIN_OPTIONS.find(c => c.endpoint === selectedEndpoint.value)
  return match?.label || 'Custom'
})

const eraserActive = ref(false)
const savedColor = ref('#FFFFFF')

function toggleEraser() {
  if (eraserActive.value) {
    eraserActive.value = false
    brushColor.value = savedColor.value
  } else {
    eraserActive.value = true
    savedColor.value = brushColor.value
    brushColor.value = '#000000'
  }
}

function selectColor(color: string) {
  eraserActive.value = false
  brushColor.value = color
}

const guessInput = ref('')
const guessesContainer = ref<HTMLElement | null>(null)
const selectedWordLocal = ref<string | null>(null)
const playersExpanded = ref(false)
const canvasRef = ref<any>(null)
const exportedImageUrl = ref<string | null>(null)
const showFinishModal = ref(false)
const linkCopied = ref(false)

async function handleNewGame() {
  selectedWordLocal.value = null
  showFinishModal.value = false
  await requestNewGame()
}

function copyInviteLink() {
  navigator.clipboard.writeText(window.location.href)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
}

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

const handleSendGuess = () => {
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

// Multi-round helpers
const isMultiRound = computed(() => gameState.value.totalRounds > 1)
const sortedScores = computed(() => {
  const scores = gameState.value.scores || {}
  return Object.entries(scores)
    .map(([id, data]) => ({ id, name: data.name, score: data.score }))
    .sort((a, b) => b.score - a.score)
})
const currentDrawerName = computed(() => {
  const did = gameState.value.drawerId
  if (!did) return 'Unknown'
  const peer = peers.value.find(p => p.id === did)
  return peer?.displayName || 'Anonymous'
})
const nextDrawerName = computed(() => {
  const drawOrder = gameState.value.drawOrder
  const nextIndex = gameState.value.roundNumber // 0-indexed next = current roundNumber
  if (!drawOrder || nextIndex >= drawOrder.length) return null
  const nextId = drawOrder[nextIndex]
  const peer = peers.value.find(p => p.id === nextId)
  return peer?.displayName || 'Anonymous'
})
const sessionWinner = computed(() => {
  const scores = sortedScores.value
  if (!scores.length) return null
  // No winner if top two are tied
  if (scores.length > 1 && scores[0].score === scores[1].score) return null
  return scores[0]
})

// Round-end countdown
const roundEndCountdown = ref(5)
let roundEndInterval: ReturnType<typeof setInterval> | null = null

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

// Sync display name changes back to localStorage
watch(displayName, (name) => {
  if (name && keys.initialized.value) {
    keys.setUsername(name)
  }
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
      showFinishModal.value = true
      return
    }

    const canvas = canvasRef.value.$el.querySelector('canvas')
    if (!canvas) {
      console.warn('Canvas element not found')
      showFinishModal.value = true
      return
    }

    // Use smaller dimensions to avoid freezing
    const fixedWidth = 800
    const fixedHeight = 600
    const scale = 1

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = fixedWidth * scale
    exportCanvas.height = fixedHeight * scale
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) {
      showFinishModal.value = true
      return
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

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

    const guessX = exportCanvas.width - 60 * scale
    const guessY = exportCanvas.height - 160 * scale
    const recentGuesses = guesses.value.slice(-8)

    ctx.textAlign = 'right'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 8 * scale

    recentGuesses.forEach((guess, i) => {
      const y = guessY - (recentGuesses.length - i - 1) * 24 * scale
      const peer = peers.value.find(p => p.id === guess.by)
      const color = peer?.color || '#fff'

      ctx.fillStyle = color
      ctx.font = `${14 * scale}px sans-serif`

      const nameText = `${guess.displayName}:`
      const nameWidth = ctx.measureText(nameText).width
      const guessWidth = ctx.measureText(guess.text).width

      ctx.globalAlpha = 0.8
      ctx.fillText(guess.text, guessX, y)

      ctx.globalAlpha = 0.5
      ctx.fillText(nameText, guessX + 8 * scale, y)
    })

    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

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

    ctx.textAlign = 'left'
    ctx.fillStyle = '#888'
    ctx.font = `${18 * scale}px sans-serif`
    ctx.fillText('sk3chy', 20 * scale, exportCanvas.height - 20 * scale)

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        showFinishModal.value = true
        return
      }
      const url = URL.createObjectURL(blob)

      if (exportedImageUrl.value) {
        URL.revokeObjectURL(exportedImageUrl.value)
      }
      exportedImageUrl.value = url

      showFinishModal.value = true
    }, 'image/png', 0.7)
  } catch (error) {
    console.error('Error generating preview:', error)
    showFinishModal.value = true
  }
}

// Generate preview when game finishes
watch(() => gameState.value.status, (newStatus, oldStatus) => {
  if (newStatus === 'finished' && oldStatus !== 'finished') {
    showFinishModal.value = true

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => generatePreview(), { timeout: 2000 })
    } else {
      setTimeout(() => generatePreview(), 500)
    }
  }

  if (oldStatus === 'finished' && newStatus !== 'finished') {
    showFinishModal.value = false
    exportedImageUrl.value = null
  }

  // Clear stale word selection for new rounds
  if (newStatus === 'selecting') {
    selectedWordLocal.value = null
  }

  // Round-end countdown
  if (newStatus === 'roundEnd') {
    roundEndCountdown.value = 5
    if (roundEndInterval) clearInterval(roundEndInterval)
    roundEndInterval = setInterval(() => {
      roundEndCountdown.value = Math.max(0, roundEndCountdown.value - 1)
      if (roundEndCountdown.value <= 0) {
        if (roundEndInterval) clearInterval(roundEndInterval)
        roundEndInterval = null
      }
    }, 1000)
  } else if (oldStatus === 'roundEnd') {
    if (roundEndInterval) {
      clearInterval(roundEndInterval)
      roundEndInterval = null
    }
  }
}, { immediate: true })

// Trigger confetti when someone wins
watch(() => gameState.value.winnerId, (newWinnerId, oldWinnerId) => {
  if (newWinnerId && !oldWinnerId && (gameState.value.status === 'finished' || gameState.value.status === 'roundEnd')) {
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

onBeforeUnmount(() => {
  if (roundEndInterval) {
    clearInterval(roundEndInterval)
    roundEndInterval = null
  }
})

function switchChain(endpoint: string) {
  selectedEndpoint.value = endpoint
  // Reload with the new endpoint — provider is bound at connect time
  const url = new URL(window.location.href)
  url.searchParams.set('chain', endpoint)
  window.location.href = url.toString()
}

async function connectToChain(endpoint: string) {
  connecting.value = true
  connectionError.value = null

  try {
    // Determine whether to use host (Spektr) or standalone mode
    let useHostMode = false
    let preferredName: string | undefined

    if (keys.isInHost.value) {
      // Wait for Spektr extension to initialize (connected or failed)
      await new Promise<void>((resolve) => {
        if (keys.spektrReady.value || keys.spektrInitFailed.value) return resolve()
        const timer = setTimeout(() => { stop(); resolve() }, 8000)
        const stop = watch(
          [keys.spektrReady, keys.spektrInitFailed],
          ([ready, failed]) => {
            if (ready || failed) { clearTimeout(timer); stop(); resolve() }
          }
        )
      })

      if (keys.spektrInitFailed.value) {
        throw new Error('Could not connect to host wallet. Ensure the host app supports Spektr.')
      }

      // Spektr connected — wait for an account (user may need to connect wallet in host)
      if (!keys.spektrAccount.value) {
        addLog('Waiting for host wallet — connect an account in the host app', 'warning')
      }
      await new Promise<void>((resolve, reject) => {
        if (keys.spektrAccount.value) return resolve()
        const timer = setTimeout(() => { stop(); reject(new Error('Connect a wallet in the host app to continue.')) }, 120000)
        const stop = watch(
          () => keys.spektrAccount.value,
          (acc) => {
            if (acc) { clearTimeout(timer); stop(); resolve() }
          }
        )
      })
      useHostMode = true
    }

    if (useHostMode) {
      // Host mode: prefer local browser wallet if registered, else ephemeral
      const account = keys.spektrAccount.value!
      registration.init(endpoint)

      if (registration.isRegisteredForCurrentEndpoint.value && keys.wallet.value?.mnemonic) {
        // User has a registered local wallet for this chain — use it
        preferredName = keys.username.value || account.name || undefined
        addLog('Using registered browser wallet for signaling (host mode)', 'info')
        onboardingRequireOnChain.value = false
        try {
          await start({
            statementStoreEndpoint: endpoint,
            signingMode: 'mnemonic',
            mnemonic: keys.wallet.value.mnemonic,
            peerId: userId.value,
            username: preferredName,
            onLog: addLog,
          })
        } catch (error: any) {
          const message = error?.message || 'Unknown error'
          addLog(`Statement-store signaling failed: ${message}`, 'error')
          throw new Error(message)
        }
      } else {
        // No registered wallet — try ephemeral, fall back to registration if noAllowance
        preferredName = account.name || keys.username.value || undefined
        addLog('Using ephemeral signing key (host mode)', 'info')
        onboardingRequireOnChain.value = false
        try {
          await start({
            statementStoreEndpoint: endpoint,
            signingMode: 'ephemeral',
            peerId: userId.value,
            username: preferredName,
            onLog: addLog,
          })
        } catch (error: any) {
          const message = error?.message || 'Unknown error'
          if (message.includes('statement-store allowance')) {
            // Ephemeral key has no allowance — require on-chain registration
            addLog('Ephemeral key rejected, switching to on-chain registration', 'warning')
            onboardingRequireOnChain.value = true
            onboardingChainEndpoint.value = endpoint
            showOnboarding.value = true
            throw new Error('On-chain registration required for this chain before joining')
          }
          addLog(`Statement-store signaling failed: ${message}`, 'error')
          throw new Error(message)
        }
      }
    } else {
      // Standalone mode — require on-chain registration
      registration.init(endpoint)
      onboardingChainEndpoint.value = endpoint
      onboardingRequireOnChain.value = true

      if (!registration.isRegisteredForCurrentEndpoint.value) {
        showOnboarding.value = true
        throw new Error('On-chain registration required for this chain before joining')
      }

      preferredName = keys.username.value || undefined
      try {
        await start({
          statementStoreEndpoint: endpoint,
          signingMode: 'mnemonic',
          mnemonic: keys.wallet.value!.mnemonic,
          peerId: userId.value,
          username: preferredName,
          onLog: addLog,
        })
      } catch (error: any) {
        const message = error?.message || 'Unknown error'
        addLog(`Statement-store signaling failed: ${message}`, 'error')
        throw new Error(message)
      }
    }

    if (preferredName) {
      setDisplayName(preferredName)
    }
  } catch (e: any) {
    const message = e?.message || 'Connection failed'
    if (message.includes('statement-store allowance')) {
      registration.clearChainRegistration()
      onboardingRequireOnChain.value = true
      onboardingChainEndpoint.value = endpoint
      showOnboarding.value = true
      connectionError.value = 'This account is not approved for statement-store writes on this chain. Register again for this endpoint.'
    } else {
      connectionError.value = message
    }
  } finally {
    connecting.value = false
  }
}

onMounted(() => {
  keys.init()
  registration.init(selectedEndpoint.value)

  // Pre-fill display name from stored username
  const preferredName = registration.fullUsername.value || keys.username.value
  if (preferredName) {
    displayName.value = preferredName
  }

  // Auto-connect to default chain
  connectToChain(selectedEndpoint.value)
})

watch(showOnboarding, (open, wasOpen) => {
  if (
    wasOpen &&
    !open &&
    !ready.value &&
    !connecting.value
  ) {
    connectToChain(selectedEndpoint.value)
  }
})
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

@keyframes fade-in-letter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-letter {
  opacity: 0;
  animation: fade-in-letter 0.3s ease forwards;
}

@keyframes glow {
  0%, 100% { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor; }
  50% { text-shadow: 0 0 20px currentColor, 0 0 40px currentColor; }
}
.animate-glow {
  animation: glow 2s ease-in-out infinite;
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.animate-bounce-slow {
  animation: bounce-slow 1.5s ease-in-out infinite;
}

@keyframes player-pop-in {
  from { opacity: 0; transform: scale(0.5) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.lobby-player-enter {
  animation: player-pop-in 0.3s ease-out both;
}
</style>

<template>
  <!-- Full-screen Lobby for Waiting State -->
  <div v-if="gameState.status === 'waiting'" class="fixed inset-0 bg-black z-30 flex flex-col">
    <!-- Canvas fills the screen -->
    <div v-if="ready" class="flex-1 relative min-h-0 m-2 rounded-xl border border-white/10 overflow-hidden">
      <YCanvas
        :strokes="lobbyStrokes"
        :peers="peers"
        :canDraw="true"
        :fillContainer="true"
        v-model:brushColor="brushColor"
        v-model:brushSize="brushSize"
        :onPoint="addLobbyPoint"
        :onCommit="commitLobbyStroke"
        :onCursor="setCursor"
      />

      <!-- Center prompt — disappears once someone draws -->
      <div v-if="lobbyStrokes.length === 0" class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div class="text-center">
          <p class="text-white/15 text-5xl md:text-7xl font-black leading-tight">Sketch<br/>together</p>
          <p class="text-white/10 text-base mt-3">Everyone can draw — go wild</p>
        </div>
      </div>

      <!-- Top-left: Room + invite -->
      <div class="absolute top-3 left-3 pointer-events-auto z-20 flex items-center gap-2">
        <div class="px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full text-xs text-white/50 font-medium">
          {{ roomId }}
        </div>
        <button
          @click="copyInviteLink"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full text-xs transition-colors"
          :class="linkCopied ? 'text-green-400' : 'text-white/50 hover:text-white'"
        >
          <UIcon :name="linkCopied ? 'i-heroicons-check' : 'i-heroicons-link'" class="w-3.5 h-3.5" />
          {{ linkCopied ? 'Copied!' : 'Copy invite' }}
        </button>
      </div>

      <!-- Top-right: Chain selector (hidden when embedded in host) -->
      <div v-if="!keys.isInHost.value" class="absolute top-3 right-3 pointer-events-auto z-20">
        <select
          :value="selectedEndpoint"
          @change="(e: Event) => switchChain((e.target as HTMLSelectElement).value)"
          class="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 text-[10px] text-white/40 outline-none cursor-pointer hover:border-white/25 hover:text-white/60 transition-colors appearance-none pr-6"
          :style="{ backgroundImage: `url('data:image/svg+xml;utf8,<svg fill=\\'%23666\\' viewBox=\\'0 0 20 20\\' xmlns=\\'http://www.w3.org/2000/svg\\'><path d=\\'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z\\'/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }"
        >
          <option
            v-for="chain in CHAIN_OPTIONS"
            :key="chain.endpoint"
            :value="chain.endpoint"
            class="bg-black text-white"
          >
            {{ chain.label }}
          </option>
        </select>
      </div>

      <!-- Alone? Compact invite banner at top-center (doesn't block drawing) -->
      <div v-if="peers.length <= 1" class="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto z-20">
        <button
          @click="copyInviteLink"
          class="flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-full text-white/60 hover:text-white text-xs font-medium transition-all"
        >
          <UIcon :name="linkCopied ? 'i-heroicons-check' : 'i-heroicons-user-plus'" class="w-3.5 h-3.5" />
          {{ linkCopied ? 'Copied!' : 'Invite friends — no one else here yet' }}
        </button>
      </div>

      <!-- Always-visible player roster — bottom-left -->
      <div class="absolute bottom-3 left-3 pointer-events-auto z-20">
        <div class="flex items-end gap-2">
          <!-- Player avatars with names -->
          <div class="flex items-end gap-1.5">
            <div
              v-for="peer in peers"
              :key="peer.id"
              class="flex flex-col items-center gap-1 lobby-player-enter"
            >
              <div
                class="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-black/50 shadow-lg flex items-center justify-center text-xs font-bold text-black/70"
                :style="{ backgroundColor: peer.color || '#0aa' }"
              >
                {{ (peer.displayName || '?')[0].toUpperCase() }}
              </div>
              <span class="text-[10px] text-white/50 max-w-[60px] truncate text-center leading-tight">
                {{ peer.displayName || 'Anon' }}
                <template v-if="peer.id === userId"> (you)</template>
              </span>
            </div>
          </div>

          <!-- Player count -->
          <div class="px-2 py-1 bg-black/40 backdrop-blur-sm rounded-full text-[10px] text-white/30 mb-2">
            {{ peers.length }}/{{ maxPlayers }}
          </div>
        </div>

        <!-- Name edit — inline, subtle -->
        <div class="mt-2">
          <input
            :value="displayName"
            @input="(e: Event) => { displayName = (e.target as HTMLInputElement).value; setDisplayName((e.target as HTMLInputElement).value) }"
            placeholder="Your name"
            class="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white/70 placeholder-white/20 outline-none focus:border-white/30 w-36 transition-colors"
          />
        </div>
      </div>

      <!-- Drawing toolbar — bottom center -->
      <div class="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-20">
        <div class="flex items-center gap-1.5 bg-black/50 backdrop-blur-md rounded-full px-3 py-2 pointer-events-auto">
          <button
            @click="clearLobbyStrokes"
            class="w-7 h-7 rounded-full border border-white/15 hover:border-white/40 hover:scale-105 transition-all flex items-center justify-center text-white/40 hover:text-white bg-white/5"
            title="Clear canvas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
          <div class="w-px h-5 bg-white/10 mx-0.5"></div>
          <button
            v-for="color in drawingColors"
            :key="color"
            @click="selectColor(color)"
            class="w-7 h-7 rounded-full border-2 transition-all"
            :class="brushColor === color ? 'border-white scale-110' : 'border-white/15 hover:scale-105'"
            :style="{ backgroundColor: color }"
          />
        </div>
      </div>

      <!-- Host: compact start bar — bottom right -->
      <div v-if="isHost" class="absolute bottom-3 right-3 pointer-events-auto z-20">
        <div class="bg-black/60 backdrop-blur-md rounded-xl p-3 w-56">
          <!-- Settings row -->
          <div class="flex gap-1 mb-2">
            <button
              v-for="diff in difficulties"
              :key="diff"
              @click="setDifficulty(diff)"
              class="flex-1 py-1 rounded-lg font-medium transition-all text-[10px]"
              :class="gameState.difficulty === diff
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/50 hover:bg-white/20'"
            >
              {{ diff }}
            </button>
          </div>
          <div class="flex gap-1 mb-3">
            <button
              v-for="dur in [{ val: 20, label: '20s' }, { val: 60, label: '1m' }, { val: 180, label: '3m' }, { val: 300, label: '5m' }]"
              :key="dur.val"
              @click="setDuration(dur.val)"
              class="flex-1 py-1 rounded-lg font-medium transition-all text-[10px]"
              :class="gameState.duration === dur.val
                ? 'bg-white text-black'
                : 'bg-white/10 text-white/50 hover:bg-white/20'"
            >
              {{ dur.label }}
            </button>
          </div>
          <button
            @click="generateWordOptions"
            class="w-full py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg transition-colors text-sm"
          >
            Start Game
          </button>
        </div>
      </div>

      <!-- Non-host: subtle waiting pill — bottom right -->
      <div v-else class="absolute bottom-3 right-3 pointer-events-none z-20">
        <div class="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full">
          <p class="text-white/30 text-xs flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-400/60 animate-pulse"></span>
            Waiting for host to start
          </p>
        </div>
      </div>
    </div>

    <!-- Loading / connection error state -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center text-white/50">
        <template v-if="connectionError">
          <p class="text-red-400 text-sm mb-2">{{ connectionError }}</p>
          <div v-if="!keys.isInHost.value" class="flex flex-col items-center gap-2">
            <select
              :value="selectedEndpoint"
              @change="(e: Event) => switchChain((e.target as HTMLSelectElement).value)"
              class="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none cursor-pointer"
            >
              <option v-for="chain in CHAIN_OPTIONS" :key="chain.endpoint" :value="chain.endpoint" class="bg-black text-white">
                {{ chain.label }}
              </option>
            </select>
            <button
              @click="connectionError = null; connectToChain(selectedEndpoint)"
              class="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white/70 transition-colors"
            >
              Retry
            </button>
          </div>
          <button
            v-else
            @click="connectionError = null; connectToChain(selectedEndpoint)"
            class="mt-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white/70 transition-colors"
          >
            Retry
          </button>
        </template>
        <template v-else-if="keys.isInHost.value && connecting">
          <div class="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mx-auto mb-3"></div>
          <p>Waiting for host wallet...</p>
        </template>
        <template v-else>
          <div class="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mx-auto mb-3"></div>
          <p>Connecting to {{ selectedChainLabel }}...</p>
        </template>
      </div>
    </div>
  </div>

  <!-- Game UI (for other states) — fullscreen -->
  <div v-else class="fixed inset-0 bg-black z-30 flex flex-col">

    <!-- Floating game HUD (top bar) -->
    <div class="absolute top-0 left-0 right-0 z-20 pointer-events-none p-3 flex items-start justify-between">
      <!-- Left: Status pills -->
      <div class="pointer-events-auto flex items-center gap-1.5 flex-wrap">
        <div
          class="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-xs text-white"
        >
          <span
            :class="isSpectator ? 'text-yellow-400' : isDrawer ? 'text-green-400' : 'text-white/60'"
          >
            {{ isSpectator ? '👁' : isDrawer ? '🎨' : '👀' }}
          </span>
          <input
            :value="displayName"
            @input="(e: Event) => { displayName = (e.target as HTMLInputElement).value; setDisplayName((e.target as HTMLInputElement).value) }"
            placeholder="Name"
            class="bg-transparent border-none text-xs text-white placeholder-white/30 outline-none w-20"
          />
        </div>
        <div
          v-if="isMultiRound && (gameState.status === 'playing' || gameState.status === 'roundEnd')"
          class="px-2.5 py-1.5 bg-purple-500/20 backdrop-blur-md rounded-full text-xs text-purple-300 font-medium"
        >
          R{{ gameState.roundNumber }}/{{ gameState.totalRounds }}
        </div>
        <div
          v-if="gameState.status === 'playing'"
          class="px-2.5 py-1.5 backdrop-blur-md rounded-full text-xs font-mono font-medium"
          :class="showCountdownWarning ? 'bg-red-500/30 text-red-300 animate-pulse' : 'bg-blue-500/20 text-blue-300'"
        >
          {{ formattedTime }}
        </div>
        <!-- Drawer's secret word -->
        <div
          v-if="isDrawer && gameState.status === 'playing'"
          class="px-2.5 py-1.5 bg-green-500/20 backdrop-blur-md rounded-full text-xs text-green-300 font-semibold"
        >
          {{ selectedWordLocal }}
        </div>
      </div>

      <!-- Right: Players + controls -->
      <div class="pointer-events-auto flex items-center gap-1.5">
        <!-- Drawer controls -->
        <button
          v-if="isDrawer && gameState.status === 'playing'"
          @click="clearCanvas"
          class="px-2.5 py-1.5 bg-red-500/20 backdrop-blur-md rounded-full text-xs text-red-300 hover:bg-red-500/30 transition-colors"
        >
          Clear
        </button>
        <button
          v-if="(isDrawer || isHost) && gameState.status === 'playing'"
          @click="requestNewGame"
          class="px-2.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs text-white/50 hover:text-white hover:bg-white/20 transition-colors"
        >
          End
        </button>

        <!-- Player count pill -->
        <button
          @click="playersExpanded = !playersExpanded"
          class="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-xs text-white/70 hover:text-white transition-colors"
        >
          <span class="flex -space-x-1">
            <span
              v-for="peer in peers.slice(0, 4)"
              :key="peer.id"
              class="w-4 h-4 rounded-full border border-black/60 flex-shrink-0"
              :style="{ backgroundColor: peer.color || '#0aa' }"
            />
          </span>
          <span>{{ activePlayers.length }}</span>
          <span v-if="spectators.length" class="text-yellow-400/70">+{{ spectators.length }}</span>
        </button>

        <!-- Expanded player list -->
        <div
          v-if="playersExpanded"
          class="absolute right-3 top-12 bg-black/80 backdrop-blur-md rounded-xl p-3 min-w-[180px] max-h-[50vh] overflow-y-auto border border-white/10"
        >
          <div class="space-y-1.5">
            <div
              v-for="peer in activePlayers"
              :key="peer.id"
              class="flex items-center gap-2 text-xs"
            >
              <div
                class="w-3 h-3 rounded-full flex-shrink-0"
                :style="{ backgroundColor: peer.color || '#0aa' }"
              />
              <span class="truncate text-white/80" :class="{ 'font-semibold text-white': peer.id === userId }">
                {{ peer.displayName || 'Anonymous' }}
                <span v-if="peer.id === gameState.drawerId" class="text-yellow-400">🎨</span>
                <span v-if="peer.id === gameState.winnerId" class="text-yellow-400">🏆</span>
                <span v-if="peer.id === userId" class="text-white/30">(you)</span>
              </span>
            </div>
            <template v-if="spectators.length">
              <div class="border-t border-white/10 my-1 pt-1">
                <p class="text-[10px] text-white/30 uppercase tracking-wide mb-1">Spectators</p>
                <div
                  v-for="peer in spectators"
                  :key="peer.id"
                  class="flex items-center gap-2 text-xs opacity-60"
                >
                  <div class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: peer.color || '#0aa' }" />
                  <span class="truncate text-white/60">{{ peer.displayName || 'Anonymous' }} 👁</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Non-drawer waiting screen during word selection -->
    <div v-if="!isDrawer && gameState.status === 'selecting'" class="flex-1 flex items-center justify-center p-6">
      <div class="text-center max-w-md w-full">
        <div class="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <h2 class="text-xl font-bold text-white mb-1">{{ currentDrawerName }} is choosing a word...</h2>
        <p class="text-white/40 text-sm mb-6">
          <template v-if="isMultiRound">Round {{ gameState.roundNumber }}/{{ gameState.totalRounds }}</template>
          <template v-else>The game will start soon</template>
        </p>

        <!-- Compact player row -->
        <div class="flex flex-wrap justify-center gap-2">
          <div
            v-for="peer in peers"
            :key="peer.id"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10"
            :class="{ 'border-primary/50': peer.id === userId }"
          >
            <div class="w-4 h-4 rounded-full flex-shrink-0" :style="{ backgroundColor: peer.color || '#0aa' }" />
            <span class="text-xs text-white/70">{{ peer.displayName || 'Anon' }}</span>
            <span v-if="peer.id === gameState.drawerId" class="text-xs">🎨</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Word Selection for Drawer -->
    <div v-else-if="isDrawer && gameState.status === 'selecting'" class="flex-1 flex items-center justify-center p-6">
      <div class="max-w-2xl w-full">
        <h2 class="text-2xl font-bold mb-1 text-center text-white">Choose Your Word</h2>
        <p class="text-white/40 text-sm text-center mb-6">
          <template v-if="isMultiRound">Round {{ gameState.roundNumber }}/{{ gameState.totalRounds }} — </template>
          Select a word to draw
        </p>

        <!-- Word Options -->
        <div class="grid grid-cols-3 gap-3 mb-6">
          <button
            v-for="word in gameState.wordOptions"
            :key="word"
            @click="() => { selectWord(word); selectedWordLocal = word }"
            class="group relative p-6 rounded-xl border-2 transition-all hover:scale-105"
            :class="selectedWordLocal === word
              ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
              : 'border-white/10 bg-white/5 hover:border-white/30'"
          >
            <div class="text-center">
              <div class="text-xl font-bold" :class="selectedWordLocal === word ? 'text-primary' : 'text-white'">
                {{ word }}
              </div>
            </div>
          </button>
        </div>

        <!-- Start Button -->
        <div class="flex justify-center">
          <button
            v-if="gameState.wordCommitment"
            @click="startGame"
            class="px-10 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors text-base"
          >
            Start Drawing! ({{ gameState.duration < 60 ? `${gameState.duration}s` : `${Math.floor(gameState.duration / 60)}m` }})
          </button>
          <p v-else class="text-white/30 text-sm">Select a word to continue...</p>
        </div>
      </div>
    </div>

    <!-- Canvas with overlay -->
    <div v-if="gameState.status === 'playing' || gameState.status === 'finished' || gameState.status === 'roundEnd'" class="flex-1 relative min-h-0 m-2 rounded-xl border border-white/10 overflow-hidden">
      <YCanvas
        ref="canvasRef"
        v-if="ready"
        :strokes="strokes"
        :peers="peers"
        :canDraw="canDraw"
        :fillContainer="true"
        v-model:brushColor="brushColor"
        v-model:brushSize="brushSize"
        :onPoint="(x,y)=>addPoint(x,y)"
        :onCommit="commitStroke"
        :onCursor="setCursor"
      />
      <p v-else>Connecting…</p>

      <!-- Word Length Hint (letter underlines with progressive reveals) -->
      <div v-if="(gameState.status === 'playing' || gameState.status === 'finished') && (gameState.wordLength || gameState.selectedWord)" class="absolute top-4 md:top-8 left-1/2 transform -translate-x-1/2 pointer-events-none z-20">
        <div class="flex gap-3 md:gap-6">
          <div
            v-for="(letter, index) in (gameState.status === 'finished' && gameState.selectedWord ? gameState.selectedWord.split('') : Array(gameState.wordLength).fill(''))"
            :key="index"
            class="w-5 h-8 md:w-8 md:h-12 border-b-2 md:border-b-4 border-gray-800 dark:border-white flex flex-col items-center justify-end pb-0.5 md:pb-1"
          >
            <!-- Finished: show all letters -->
            <span v-if="gameState.status === 'finished' && letter" class="text-lg md:text-2xl font-bold text-gray-800 dark:text-white">
              {{ letter.toUpperCase() }}
            </span>
            <!-- Playing: show hint letters -->
            <span v-else-if="hintLetters[index]" class="text-lg md:text-2xl font-bold text-yellow-400">
              {{ hintLetters[index].toUpperCase() }}
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

      <!-- Drawing toolbar (bottom center, only for drawer during playing) -->
      <div v-if="ready && isDrawer && gameState.status === 'playing'" class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div class="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full p-2">
          <!-- Undo -->
          <button
            @click="undoStroke"
            class="w-8 h-8 rounded-full border-2 border-gray-600/50 hover:border-white hover:scale-105 transition-all pointer-events-auto flex items-center justify-center text-white/70 hover:text-white bg-gray-700/50"
            title="Undo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"/></svg>
          </button>
          <!-- Eraser -->
          <button
            @click="toggleEraser"
            class="w-8 h-8 rounded-full border-2 transition-all pointer-events-auto flex items-center justify-center bg-gray-700/50"
            :class="eraserActive ? 'border-white scale-110 text-white' : 'border-gray-600/50 hover:border-white hover:scale-105 text-white/70 hover:text-white'"
            title="Eraser"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
          </button>
          <div class="w-px h-6 bg-gray-600/50 mx-1"></div>
          <!-- Colors -->
          <button
            v-for="color in drawingColors"
            :key="color"
            @click="selectColor(color)"
            class="w-8 h-8 rounded-full border-2 transition-all pointer-events-auto"
            :class="!eraserActive && brushColor === color ? 'border-white scale-110' : 'border-gray-600/50 hover:scale-105'"
            :style="{ backgroundColor: color }"
          />
        </div>
      </div>

      <!-- Input area (viewers during playing, disabled for spectators and drawer) -->
      <div v-if="ready && !isDrawer && gameState.status === 'playing'" class="absolute bottom-4 right-4 w-64 p-2 pointer-events-auto z-10 bg-black/30 backdrop-blur-sm rounded-lg">
        <div v-if="isSpectator" class="text-xs text-yellow-400 flex items-center gap-1 justify-center py-1">
          <span>👁</span> Spectating — joined mid-game
        </div>
        <div v-else class="flex gap-1">
          <UInput
            v-model="guessInput"
            placeholder="guess..."
            size="xs"
            class="flex-1 transition-opacity"
            :ui="{ base: 'bg-white/10 border-white/20 text-white placeholder-white/40' }"
            @keyup.enter="handleSendGuess"
          />
          <UButton
            @click="handleSendGuess"
            size="xs"
            color="gray"
            variant="ghost"
            class="opacity-60 hover:opacity-100"
          >
            →
          </UButton>
        </div>
      </div>
    </div>
  </div>

  <!-- Round End Overlay -->
  <div v-if="gameState.status === 'roundEnd'" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" style="z-index: 99998;">
    <div class="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center text-white">
      <!-- Round info -->
      <div class="text-sm text-white/50 font-medium mb-2">
        Round {{ gameState.roundNumber }}/{{ gameState.totalRounds }}
      </div>

      <!-- Word reveal -->
      <div class="mb-4">
        <p class="text-white/40 text-xs mb-1">The word was</p>
        <p class="text-3xl font-bold text-primary">{{ gameState.selectedWord }}</p>
      </div>

      <!-- Round winner -->
      <div v-if="gameState.winnerId" class="mb-4">
        <p class="text-lg font-semibold text-green-400">
          {{ gameState.winnerName }} guessed it! <span class="text-sm text-white/50">+3</span>
        </p>
        <p class="text-sm text-white/40">
          {{ currentDrawerName }} <span class="text-white/30">+1 (drawer)</span>
        </p>
      </div>
      <div v-else class="mb-4">
        <p class="text-lg text-white/50">Time's up — no one guessed it</p>
      </div>

      <!-- Mini scoreboard -->
      <div class="bg-white/5 rounded-xl p-3 mb-4">
        <h4 class="text-xs text-white/40 uppercase tracking-wider mb-2">Standings</h4>
        <div class="space-y-1.5">
          <div
            v-for="(entry, index) in sortedScores"
            :key="entry.id"
            class="flex items-center justify-between text-sm px-2 py-1 rounded-lg"
            :class="entry.id === userId ? 'bg-white/10' : ''"
          >
            <div class="flex items-center gap-2">
              <span class="text-white/40 w-4 text-right">{{ index + 1 }}.</span>
              <span :class="entry.id === gameState.drawerId ? 'text-yellow-400' : 'text-white'">
                {{ entry.name }}
              </span>
              <span v-if="entry.id === userId" class="text-white/30 text-xs">(you)</span>
            </div>
            <span class="font-bold text-white/80">{{ entry.score }}</span>
          </div>
        </div>
      </div>

      <!-- Next drawer -->
      <div v-if="nextDrawerName" class="text-sm text-white/50 mb-3">
        Next up: <span class="text-white font-medium">{{ nextDrawerName }}</span> draws
      </div>

      <!-- Countdown bar -->
      <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
          :style="{ width: `${(roundEndCountdown / 5) * 100}%` }"
        />
      </div>
      <p class="text-xs text-white/30 mt-1">Next round in {{ roundEndCountdown }}s</p>
    </div>
  </div>

  <!-- Debug Panel -->
  <DebugPanel />

  <!-- Game Finished Modal (outside section so it's always available) -->
  <div v-if="showFinishModal && gameState.status === 'finished'" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-2 md:p-4" style="z-index: 99999;" @click.self="handleNewGame">
    <div class="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] md:max-h-none overflow-y-auto p-4 md:p-8 relative text-white">
      <!-- Close button (mobile only) -->
      <button
        @click="handleNewGame"
        class="md:hidden absolute top-2 left-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
        title="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="flex flex-col md:flex-row gap-4 md:gap-8">
        <!-- PNG Preview -->
        <div v-if="exportedImageUrl" class="flex-shrink-0 md:w-1/2 relative mx-auto max-w-[80vw] md:max-w-none">
          <div class="rounded-xl overflow-hidden border-2 aspect-[4/3] md:aspect-auto md:h-auto flex items-center justify-center bg-black"
            :class="gameState.winnerId ? 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)]' : 'border-white/10'"
          >
            <img :src="exportedImageUrl" alt="Drawing" class="w-full h-full object-contain" />
          </div>
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

        <!-- Loading placeholder -->
        <div v-else class="flex-shrink-0 md:w-1/2 relative">
          <div class="rounded-xl border-2 border-dashed border-white/10 h-64 md:h-full flex items-center justify-center">
            <div class="text-center text-white/40">
              <div class="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
              <p class="text-sm">Generating preview...</p>
            </div>
          </div>
        </div>

        <!-- Info Panel -->
        <div class="flex-1 flex flex-col justify-between min-h-0">
          <div>
            <!-- Title -->
            <h2 class="text-2xl md:text-4xl font-bold mb-4">
              {{ isMultiRound ? 'Session Complete!' : 'Game Over!' }}
            </h2>

            <!-- Word reveal with letter animation -->
            <div class="mb-4">
              <p class="text-white/40 text-xs mb-2">The word was</p>
              <div class="flex gap-1">
                <span
                  v-for="(letter, i) in (gameState.selectedWord || '').split('')"
                  :key="i"
                  class="text-2xl md:text-4xl font-bold text-primary inline-block animate-fade-in-letter"
                  :style="{ animationDelay: `${i * 80}ms` }"
                >{{ letter.toUpperCase() }}</span>
              </div>
            </div>

            <!-- Multi-round: Final Scoreboard with Podium -->
            <template v-if="isMultiRound && sortedScores.length > 0">
              <!-- Winner celebration -->
              <div v-if="sessionWinner" class="mb-4">
                <div class="text-center py-3 px-4 bg-gradient-to-r from-yellow-500/10 via-yellow-500/20 to-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <div class="text-4xl mb-1 animate-bounce-slow">🏆</div>
                  <p class="text-xl md:text-2xl font-bold text-yellow-400 animate-glow">
                    {{ sessionWinner.name }} wins!
                  </p>
                  <p class="text-sm text-white/50">{{ sessionWinner.score }} points</p>
                </div>
              </div>
              <div v-else-if="sortedScores.length > 1" class="mb-4">
                <div class="text-center py-3 px-4 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-xl border border-white/10">
                  <div class="text-3xl mb-1">🤝</div>
                  <p class="text-xl font-bold text-white/80">It's a tie!</p>
                  <p class="text-sm text-white/50">{{ sortedScores[0].score }} points each</p>
                </div>
              </div>

              <!-- Full rankings -->
              <div class="bg-white/5 rounded-xl p-3 mb-3">
                <h4 class="text-xs text-white/40 uppercase tracking-wider mb-2">Final Standings</h4>
                <div class="space-y-1.5">
                  <div
                    v-for="(entry, index) in sortedScores"
                    :key="entry.id"
                    class="flex items-center justify-between text-sm px-3 py-2 rounded-lg transition-colors"
                    :class="[
                      index === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                      index === 1 ? 'bg-white/5 border border-white/5' :
                      index === 2 ? 'bg-amber-900/10 border border-amber-900/20' : 'bg-transparent',
                      entry.id === userId ? 'ring-1 ring-primary/50' : ''
                    ]"
                  >
                    <div class="flex items-center gap-2">
                      <span class="w-6 text-center">
                        {{ index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.` }}
                      </span>
                      <span class="font-medium">{{ entry.name }}</span>
                      <span v-if="entry.id === userId" class="text-white/30 text-xs">(you)</span>
                    </div>
                    <span class="font-bold" :class="index === 0 ? 'text-yellow-400' : 'text-white/70'">
                      {{ entry.score }} pts
                    </span>
                  </div>
                </div>
              </div>

              <!-- Session stats -->
              <div class="text-xs text-white/40 flex items-center gap-3">
                <span>{{ gameState.totalRounds }} rounds</span>
                <span class="w-1 h-1 rounded-full bg-white/20"></span>
                <span>{{ formattedActualDuration }}</span>
              </div>
            </template>

            <!-- Single-round result -->
            <template v-else>
              <div v-if="gameState.winnerId" class="mb-4">
                <div class="text-center py-4 px-4 bg-gradient-to-r from-green-500/10 via-green-500/20 to-green-500/10 rounded-xl border border-green-500/20">
                  <div class="text-4xl mb-1 animate-bounce-slow">🏆</div>
                  <p class="text-xl md:text-2xl font-bold text-green-400 animate-glow">
                    {{ gameState.winnerName }}
                  </p>
                  <p class="text-sm text-white/40 mt-1">guessed it in {{ formattedActualDuration }}</p>
                </div>
              </div>
              <div v-else class="mb-4">
                <p class="text-lg font-semibold text-white/50">
                  Time's up — no winner
                </p>
              </div>
            </template>

            <!-- Commitment verification -->
            <div class="text-xs text-white/40 pt-3 border-t border-white/5 mt-3">
              <div class="flex items-center gap-2">
                <span>Commitment:</span>
                <div v-if="gameState.commitmentVerified !== null" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  :class="gameState.commitmentVerified ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'">
                  <span>{{ gameState.commitmentVerified ? '✓ Verified' : '✗ Failed' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 flex justify-center">
            <UButton
              @click.stop="handleNewGame"
              color="primary"
              size="lg"
              class="font-bold px-8"
              :loading="electionInProgress"
              :disabled="electionInProgress"
            >
              {{ electionInProgress ? 'Electing host...' : 'Play Again' }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
