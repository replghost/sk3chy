<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted } from 'vue'
import YCanvas from '~/components/YCanvas.vue'
import { useYDrawing } from '~/composables/useYDrawing'

const route = useRoute()
const roomId = String(route.params.id)

const {
  ready, strokes, peers, brushColor, brushSize, userId, displayName,
  start, addPoint, commitStroke, setCursor, setDisplayName, clearCanvas
} = useYDrawing(roomId)

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
        <h1 class="text-xl font-semibold">Yjs Drawing · Room {{ roomId }}</h1>
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
        <UButton 
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
        <h3 class="text-sm font-semibold mb-2">Connected Guests ({{ peers.length }})</h3>
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
                <span v-if="peer.id === userId" class="text-xs text-gray-500">(you)</span>
              </span>
              <span class="text-xs text-gray-400">{{ peer.id }}</span>
            </div>
          </div>
          <p v-if="peers.length === 0" class="text-xs text-gray-400">No peers connected</p>
        </div>
      </div>
    </div>

    <YCanvas
      v-if="ready"
      :strokes="strokes"
      :peers="peers"
      v-model:brushColor="brushColor"
      v-model:brushSize="brushSize"
      :onPoint="(x,y)=>addPoint(x,y)"
      :onCommit="commitStroke"
      :onCursor="setCursor"
    />
    <p v-else>Connecting…</p>
  </section>
</template>
