<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted, watch, computed } from 'vue'
import confetti from 'canvas-confetti'
import YCanvas from '~/components/YCanvas.vue'
import { useDrawingGame } from '~/composables/useDrawingGame'
import { getAllDifficulties, type DifficultyLevel } from '~/utils/wordDictionary'

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
  start({
    signaling: ['wss://signaling.yjs.dev'],
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })
})
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>

<template>
  <section class="p-3 space-y-2">
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
        <!-- Host Controls - Waiting State -->
        <template v-if="isHost && gameState.status === 'waiting'">
          <span class="text-gray-600 dark:text-gray-400">Difficulty:</span>
          <UButton
            v-for="diff in difficulties"
            :key="diff"
            @click="setDifficulty(diff)"
            :color="gameState.difficulty === diff ? 'primary' : 'gray'"
            :variant="gameState.difficulty === diff ? 'solid' : 'soft'"
            size="xs"
          >
            {{ diff }}
          </UButton>
          <span class="text-gray-600 dark:text-gray-400 ml-2">Time:</span>
          <UButton
            @click="setDuration(20)"
            :color="gameState.duration === 20 ? 'primary' : 'gray'"
            :variant="gameState.duration === 20 ? 'solid' : 'soft'"
            size="xs"
          >
            20s
          </UButton>
          <UButton
            @click="setDuration(60)"
            :color="gameState.duration === 60 ? 'primary' : 'gray'"
            :variant="gameState.duration === 60 ? 'solid' : 'soft'"
            size="xs"
          >
            1m
          </UButton>
          <UButton
            @click="setDuration(180)"
            :color="gameState.duration === 180 ? 'primary' : 'gray'"
            :variant="gameState.duration === 180 ? 'solid' : 'soft'"
            size="xs"
          >
            3m
          </UButton>
          <UButton
            @click="setDuration(300)"
            :color="gameState.duration === 300 ? 'primary' : 'gray'"
            :variant="gameState.duration === 300 ? 'solid' : 'soft'"
            size="xs"
          >
            5m
          </UButton>
          <UButton 
            @click="generateWordOptions"
            color="primary"
            size="xs"
            class="ml-2"
          >
            Start Game
          </UButton>
        </template>

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

        <!-- Game Finished -->
        <template v-if="gameState.status === 'finished'">
          <div class="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
            <span class="font-semibold">{{ gameState.selectedWord }}</span>
            <span v-if="gameState.winnerId" class="ml-2 text-green-600 dark:text-green-400">
              🎉 {{ gameState.winnerName }}
            </span>
            <span v-else class="ml-2 text-gray-600 dark:text-gray-400">⏰ Time's up</span>
            <span v-if="gameState.commitmentVerified" class="ml-2 text-green-600 dark:text-green-400 text-xs">✓</span>
            <span v-else-if="gameState.commitmentVerified === false" class="ml-2 text-red-600 dark:text-red-400 text-xs">✗</span>
          </div>
          <UButton
            @click="() => { resetGame(); selectedWordLocal = null }"
            color="primary"
            size="xs"
          >
            New Game
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
      <div v-if="ready && (gameState.status === 'playing' || gameState.status === 'finished')" class="absolute bottom-16 right-4 w-40 pointer-events-none select-none z-10">
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
      <div v-if="ready && !isHost && gameState.status === 'playing'" class="absolute bottom-4 right-4 w-40 p-2 pointer-events-auto z-10 bg-black/30 backdrop-blur-sm rounded-lg">
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
</template>
