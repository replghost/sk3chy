<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted, watch } from 'vue'
import YCanvas from '~/components/YCanvas.vue'
import { useYPictionary } from '~/composables/useYPictionary'

const route = useRoute()
const roomId = `sk-${String(route.params.id)}`  // Prefix to make it independent

const {
  ready, strokes, peers, guesses, brushColor, brushSize, userId, displayName,
  isHost, canDraw, hostId,
  start, addPoint, commitStroke, setCursor, setDisplayName, sendGuess, clearCanvas, clearGuesses
} = useYPictionary(roomId)

const guessInput = ref('')
const guessesContainer = ref<HTMLElement | null>(null)

const handleSendGuess = () => {
  if (guessInput.value.trim()) {
    sendGuess(guessInput.value)
    guessInput.value = ''
    // Auto-scroll to bottom after sending
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

onMounted(() => {
  start({
    // In prod, use your own signaling & TURN here
    signaling: ['wss://signaling.yjs.dev'],
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })
})
</script>

<template>
  <section class="p-6 space-y-4">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold">Pictionary · Room {{ route.params.id }}</h1>
        <div class="flex items-center gap-2 mt-2">
          <UInput 
            v-model="displayName" 
            placeholder="Enter your name"
            size="sm"
            class="w-48"
            @update:model-value="setDisplayName"
          />
          <span class="text-xs text-gray-500">({{ userId }})</span>
        </div>
        
        <!-- Role indicator -->
        <div class="mt-2">
          <UBadge 
            :color="isHost ? 'green' : 'gray'" 
            variant="soft"
            size="sm"
          >
            {{ isHost ? '🎨 Host (Drawing)' : '👀 Viewer' }}
          </UBadge>
        </div>

        <UButton 
          v-if="canDraw"
          @click="clearCanvas" 
          color="red" 
          variant="soft" 
          size="sm" 
          class="mt-2"
        >
          Clear Canvas
        </UButton>
      </div>
      
      <!-- Connected Peers -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border p-3 min-w-[200px]">
        <h3 class="text-sm font-semibold mb-2">Players ({{ peers.length }})</h3>
        <div class="space-y-1">
          <div 
            v-for="peer in peers" 
            :key="peer.id"
            class="flex items-center gap-2 text-sm"
          >
            <div 
              class="w-3 h-3 rounded-full" 
              :style="{ backgroundColor: peer.color || '#0aa' }"
            />
            <div class="flex flex-col">
              <span :class="{ 'font-semibold': peer.id === userId }">
                {{ peer.displayName || 'Anonymous' }}
                <span v-if="peer.id === hostId" class="text-xs">🎨</span>
                <span v-if="peer.id === userId" class="text-xs text-gray-500">(you)</span>
              </span>
              <span class="text-xs text-gray-400">{{ peer.id }}</span>
            </div>
          </div>
          <p v-if="peers.length === 0" class="text-xs text-gray-400">No players connected</p>
        </div>
      </div>
    </div>

    <!-- Canvas with overlay -->
    <div class="relative">
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
      <div v-if="ready" class="absolute bottom-4 right-4 w-80 flex flex-col bg-black/40 backdrop-blur-md rounded-lg">
        <!-- Guesses list -->
        <div 
          ref="guessesContainer"
          class="overflow-y-auto p-3 space-y-2 max-h-[400px]"
        >
          <div 
            v-for="guess in guesses" 
            :key="guess.id"
            class="text-sm text-white"
          >
            <span class="font-semibold">{{ guess.displayName }}:</span>
            <span class="ml-1">{{ guess.text }}</span>
          </div>
        </div>

        <!-- Input area -->
        <div v-if="!canDraw" class="p-3 border-t border-white/10">
          <div class="flex gap-2">
            <UInput 
              v-model="guessInput"
              placeholder="Type your guess..."
              size="sm"
              class="flex-1"
              @keyup.enter="handleSendGuess"
            />
            <UButton 
              @click="handleSendGuess"
              size="sm"
              color="primary"
            >
              Send
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
