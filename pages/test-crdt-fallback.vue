<template>
  <main class="min-h-screen bg-neutral-950 p-6 text-neutral-100">
    <section class="mx-auto max-w-xl space-y-4">
      <h1 class="text-2xl font-semibold">CRDT Fallback Smoke</h1>

      <div class="rounded border border-neutral-800 p-4 text-sm">
        <p>Status: <span data-testid="status">{{ status }}</span></p>
        <p>Room: <span data-testid="room">{{ roomId }}</span></p>
        <p>Peers: <span data-testid="peer-count">{{ peerCount }}</span></p>
        <p>Shared: <span data-testid="shared-value">{{ sharedValue }}</span></p>
      </div>

      <label class="block space-y-2">
        <span class="text-sm text-neutral-400">Shared value</span>
        <input
          v-model="draft"
          data-testid="shared-input"
          class="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
        >
      </label>

      <button
        data-testid="publish"
        class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        @click="publish"
      >
        Publish
      </button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const roomId = computed(() => String(route.query.room || `crdt-smoke-${Date.now()}`))
const endpoint = computed(() => String(route.query.endpoint || ''))
const status = ref('idle')
const peerCount = ref(0)
const sharedValue = ref('')
const draft = ref('')

let yroom: any = null

onMounted(() => {
  const { $createYRoom } = useNuxtApp()
  yroom = $createYRoom(roomId.value, {
    statementStoreEndpoint: endpoint.value,
    pollInterval: 250,
    presenceTtl: 5_000,
  })

  yroom.provider.on('status', (event: any) => {
    status.value = event.status || 'unknown'
  })
  yroom.provider.on('peers', (event: any) => {
    peerCount.value = event.webrtcPeers?.length ?? 0
  })

  yroom.awareness.setLocalState({
    id: `smoke-${Math.random().toString(36).slice(2)}`,
    displayName: 'Smoke',
  })

  sharedValue.value = yroom.game.get('smokeValue') || ''
  yroom.game.observe(() => {
    sharedValue.value = yroom.game.get('smokeValue') || ''
  })
})

function publish() {
  yroom?.game?.set('smokeValue', draft.value)
}

onBeforeUnmount(() => {
  void yroom?.provider?.destroy?.()
  yroom?.doc?.destroy?.()
})
</script>
