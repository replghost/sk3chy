<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted, watch, computed } from 'vue'
import { useRuntimeConfig } from '#app'
import confetti from 'canvas-confetti'
import YCanvas from '~/components/YCanvas.vue'
import { useDrawingGame } from '~/composables/useDrawingGame'
import { getAllDifficulties, type DifficultyLevel } from '~/utils/wordDictionary'

const config = useRuntimeConfig()
const route = useRoute()
const roomId = `game-${String(route.params.id)}`

const {
  ready, strokes, peers, guesses, brushColor, brushSize, userId, displayName,
  isHost, canDraw, gameState, timeRemaining,
  start, addPoint, commitStroke, setCursor, setDisplayName, sendGuess, clearCanvas,
  generateWordOptions, selectWord, startGame, resetGame, setDifficulty, setDuration
} = useDrawingGame(roomId)

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
    a.download = `drawing-${gameState.value.selectedWord}-${Date.now()}.png`
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
watch(() => gameState.value.status, (newStatus, oldStatus) => {
  console.log('[Game Page] Status changed:', oldStatus, '->', newStatus, 'showFinishModal:', showFinishModal.value)
  
  if (newStatus === 'finished' && oldStatus !== 'finished') {
    console.log('[Game Page] Setting showFinishModal to true')
    // Show modal immediately
    showFinishModal.value = true
    
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

// Trigger confetti when someone wins
watch(() => gameState.value.winnerId, (newWinnerId, oldWinnerId) => {
  if (newWinnerId && !oldWinnerId && gameState.value.status === 'finished') {
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
        colors: colors
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }
})

onMounted(() => {
  // Build ICE servers array
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' }
  ]

  // Add TURN servers only if credentials are configured (for production)
  if (config.public.turnUsername && config.public.turnCredential) {
    // Use only 2 TURN servers to avoid the "5+ servers" warning
    iceServers.push(
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: config.public.turnUsername,
        credential: config.public.turnCredential
      },
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: config.public.turnUsername,
        credential: config.public.turnCredential
      }
    )
  }

  start({ iceServers })
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
        <h1 class="text-4xl font-bold mb-2">🎨 Drawing Game Lobby</h1>
        <p class="text-gray-600 dark:text-gray-400">Room: {{ roomId }}</p>
      </div>

      <!-- Two Column Layout -->
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Left: Players List -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
            <span>👥</span>
            <span>Players</span>
            <span class="text-sm font-normal text-gray-500">{{ peers.length }}</span>
          </h2>
          
          <div class="grid grid-cols-2 gap-2 mb-6">
            <div 
              v-for="peer in peers" 
              :key="peer.id"
              class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700 transition-all hover:scale-105"
              :class="{ 'ring-2 ring-primary': peer.id === userId }"
            >
              <div 
                class="w-8 h-8 rounded-full flex-shrink-0" 
                :style="{ backgroundColor: peer.color || '#0aa' }"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold truncate">
                  {{ peer.displayName || 'Anonymous' }}
                  <span v-if="peer.id === userId" class="text-xs text-gray-500">(you)</span>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  <span v-if="peer.id === gameState.hostId">🎨 Host</span>
                  <span v-else>👀 Player</span>
                </div>
              </div>
            </div>
            
            <!-- Empty state -->
            <div v-if="peers.length === 0" class="col-span-2 text-center py-8 text-gray-400">
              <p>Waiting for players to join...</p>
            </div>
          </div>

          <!-- Your Name Input -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label class="block text-sm font-medium mb-2">Your Name</label>
            <UInput 
              v-model="displayName" 
              placeholder="Enter your name"
              size="md"
              @update:model-value="setDisplayName"
            />
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
                @click="generateWordOptions"
                color="primary"
                size="xl"
                block
                class="font-bold text-lg"
              >
                🎮 Start Game
              </UButton>
              <div v-else class="text-center p-4">
                <p class="text-gray-500 dark:text-gray-400">Waiting for host to start...</p>
              </div>
            </div>
          </div>
        </div>
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
              <span class="truncate" :class="{ 'font-semibold': peer.id === userId }">
                {{ peer.displayName || 'Anonymous' }}
                <span v-if="peer.id === gameState.hostId">🎨</span>
                <span v-if="peer.id === gameState.winnerId">🏆</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Compact controls row -->
    <div class="flex items-center gap-2 flex-wrap text-xs">

        <!-- Host Controls - Word Selection -->
        <template v-if="isHost && gameState.status === 'selecting'">
          <span class="text-gray-600 dark:text-gray-400">Choose word:</span>
          <UButton
            v-for="word in gameState.wordOptions"
            :key="word"
            @click="() => { selectWord(word); selectedWordLocal = word }"
            :color="selectedWordLocal === word ? 'primary' : 'gray'"
            :variant="selectedWordLocal === word ? 'solid' : 'soft'"
            size="xs"
          >
            {{ word }}
          </UButton>
          <UButton
            v-if="gameState.wordCommitment"
            @click="startGame"
            color="green"
            size="xs"
            class="ml-2"
          >
            Start! ({{ gameState.duration < 60 ? `${gameState.duration}s` : `${Math.floor(gameState.duration / 60)}m` }})
          </UButton>
        </template>

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
            @click="resetGame" 
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
        <span v-if="!isHost && gameState.status === 'selecting'" class="text-gray-500 text-xs">
          Host choosing word...
        </span>
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
                class="opacity-50"
                :style="{ color: peers.find(p => p.id === guess.by)?.color || '#fff' }"
              >
                {{ guess.displayName }}:
              </span>
              <span 
                class="ml-1 opacity-80"
                :style="{ color: peers.find(p => p.id === guess.by)?.color || '#fff' }"
              >
                {{ guess.text }}
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
        <div class="flex gap-1">
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
  </section>

  <!-- Game Finished Modal (outside section so it's always available) -->
  <div v-if="showFinishModal && gameState.status === 'finished'" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4" style="z-index: 99999;" @click.self="() => { resetGame(); selectedWordLocal = null; showFinishModal = false }">
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] md:max-h-none overflow-y-auto p-3 md:p-6 relative">
      <!-- Close button (mobile only) -->
      <button
        @click="() => { resetGame(); selectedWordLocal = null; showFinishModal = false }"
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
        <div v-if="exportedImageUrl" class="flex-shrink-0 md:w-1/2 relative">
          <div class="rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 max-h-[40vh] md:max-h-none">
            <img :src="exportedImageUrl" alt="Drawing" class="w-full h-full object-contain md:object-cover" />
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
              @click.stop="() => { console.log('Reset clicked'); resetGame(); selectedWordLocal = null; showFinishModal = false }"
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
