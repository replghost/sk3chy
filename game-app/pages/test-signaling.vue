<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
    <UContainer>
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Signaling Server Test</h1>
        
        <UCard class="mb-6">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">Connection Status</h2>
              <UBadge :color="connected ? 'green' : 'red'" variant="subtle">
                {{ connected ? 'Connected' : 'Disconnected' }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Signaling Server</label>
              <USelectMenu 
                v-model="selectedServer" 
                :options="serverOptions"
                :disabled="connected"
                placeholder="Select server"
              />
            </div>

            <div v-if="peerId">
              <label class="block text-sm font-medium mb-2">Your Peer ID</label>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 font-mono">
                {{ peerId }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Room ID</label>
              <UInput v-model="roomId" placeholder="Enter room ID" />
            </div>

            <div class="flex gap-2">
              <UButton 
                v-if="!connected" 
                @click="connect" 
                color="primary"
              >
                Connect
              </UButton>
              <UButton 
                v-if="connected && !inRoom" 
                @click="joinRoom" 
                color="primary"
              >
                Join Room
              </UButton>
              <UButton 
                v-if="connected && inRoom" 
                @click="leaveRoom" 
                color="red"
              >
                Leave Room
              </UButton>
              <UButton 
                v-if="connected" 
                @click="disconnect" 
                color="gray"
              >
                Disconnect
              </UButton>
            </div>
          </div>
        </UCard>

        <UCard v-if="peers.length > 0" class="mb-6">
          <template #header>
            <h2 class="text-xl font-semibold">Peers in Room ({{ peers.length }})</h2>
          </template>
          <div class="space-y-2">
            <div 
              v-for="peer in peers" 
              :key="peer"
              class="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg font-mono text-sm"
            >
              👤 {{ peer }}
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Event Log</h2>
          </template>
          <div class="space-y-2 max-h-96 overflow-y-auto">
            <div 
              v-for="(log, index) in logs" 
              :key="index"
              class="p-2 bg-neutral-100 dark:bg-neutral-800 rounded text-sm"
            >
              <span class="text-neutral-500 dark:text-neutral-400">
                [{{ log.time }}]
              </span>
              <span class="ml-2">{{ log.message }}</span>
            </div>
          </div>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRuntimeConfig } from '#app'

const config = useRuntimeConfig()

// Server options
const serverOptions = [
  { label: 'Localhost (ws://localhost:4444)', value: 'ws://localhost:4444' },
  { label: 'Production (Railway)', value: config.public.signalingServer },
  { label: 'Yjs Public Server', value: 'wss://signaling.yjs.dev' },
]

const selectedServer = ref(serverOptions[0].value)

const connected = ref(false)
const inRoom = ref(false)
const peerId = ref<string | null>(null)
const roomId = ref('test-room')
const peers = ref<string[]>([])
const logs = ref<Array<{ time: string; message: string }>>([])

let ws: WebSocket | null = null

function addLog(message: string) {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift({ time, message })
  console.log(`[${time}] ${message}`)
}

function connect() {
  addLog(`Connecting to ${selectedServer.value}...`)
  
  ws = new WebSocket(selectedServer.value)

  ws.onopen = () => {
    connected.value = true
    addLog('✅ Connected to signaling server')
  }

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      addLog(`📨 Received: ${message.type}`)
      
      switch (message.type) {
        case 'publish':
          // y-webrtc protocol: publish messages contain peer info
          if (message.topic === roomId.value && message.clients) {
            addLog(`👥 Room has ${message.clients} clients (including you)`)
            // Update peer count (subtract 1 for self)
            const peerCount = Math.max(0, message.clients - 1)
            peers.value = Array(peerCount).fill(null).map((_, i) => `peer-${i + 1}`)
          }
          break

        case 'pong':
          addLog('🏓 Pong received')
          break
      }
    } catch (error) {
      addLog(`⚠️ Error parsing message: ${error}`)
    }
  }

  ws.onclose = () => {
    connected.value = false
    inRoom.value = false
    peerId.value = null
    peers.value = []
    addLog('❌ Disconnected from server')
  }

  ws.onerror = (error) => {
    addLog(`⚠️ WebSocket error: ${error}`)
  }
}

function disconnect() {
  if (ws) {
    ws.close()
    ws = null
  }
}

function joinRoom() {
  if (!ws || !roomId.value) return

  // y-webrtc protocol: subscribe to a topic (room)
  const message = {
    type: 'subscribe',
    topics: [roomId.value]
  }
  
  ws.send(JSON.stringify(message))
  inRoom.value = true
  addLog(`🚪 Subscribing to room: ${roomId.value}`)
  
  // Send a publish message to announce presence
  setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const announceMessage = {
        type: 'publish',
        topic: roomId.value,
        data: { type: 'announce' }
      }
      ws.send(JSON.stringify(announceMessage))
      addLog(`📢 Announced presence in room`)
    }
  }, 100)
}

function leaveRoom() {
  if (!ws) return

  // y-webrtc protocol: unsubscribe from topic
  const message = {
    type: 'unsubscribe',
    topics: [roomId.value]
  }
  
  ws.send(JSON.stringify(message))
  inRoom.value = false
  peers.value = []
  addLog('🚪 Unsubscribed from room')
}

onBeforeUnmount(() => {
  disconnect()
})
</script>
