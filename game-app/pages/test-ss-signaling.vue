<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
    <UContainer>
      <div class="max-w-4xl mx-auto space-y-6">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold mb-2">🧪 Statement Store Signaling</h1>
          <p class="text-neutral-600 dark:text-neutral-400">
            WebRTC signaling via Substrate statement store (no signaling server)
          </p>
        </div>

        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">1. Connect Wallet</h2>
          </template>

          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <dc-connection-button />
              <UButton size="sm" variant="outline" @click="refreshExtensions">
                Refresh Wallets
              </UButton>
              <UButton size="sm" variant="outline" @click="connectFirstExtension">
                Load Accounts
              </UButton>
            </div>
            <p class="text-xs text-neutral-500">
              Use the DOTConnect button to authorize, then “Load Accounts” to sync.
            </p>

            <div v-if="!isConnected" class="space-y-3">
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                Detected wallets:
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="ext in extensions"
                  :key="ext"
                  variant="outline"
                  @click="() => connect(ext)"
                >
                  {{ ext }}
                </UButton>
                <p v-if="extensions.length === 0" class="text-xs text-neutral-500">
                  No injected wallets detected yet.
                </p>
              </div>
            </div>

            <div v-else class="space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-neutral-600 dark:text-neutral-400">Connected as:</p>
                  <p class="font-mono text-lg">{{ shortAddress }}</p>
                  <p class="text-xs text-neutral-500">{{ address }}</p>
                </div>
                <UButton @click="() => disconnect()" color="red" variant="soft">
                  Disconnect
                </UButton>
              </div>

              <div v-if="hasOnlyEvmAccounts" class="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                Your wallet is exposing only EVM accounts. Switch to a Substrate account (SS58) in your wallet to continue.
              </div>

              <div v-if="substrateAccounts.length > 1" class="space-y-2">
                <p class="text-sm text-neutral-600 dark:text-neutral-400">Active account:</p>
                <USelect v-model="selectedAccount" :options="substrateAccountOptions" />
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">2. Connect Room</h2>
              <UBadge :color="providerStatus === 'connected' ? 'green' : providerStatus === 'connecting' ? 'yellow' : 'red'" variant="subtle">
                {{ providerStatus }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Room ID</label>
              <UInput v-model="roomId" placeholder="Enter room ID" />
            </div>

            <div class="flex gap-2">
              <UButton @click="connectRoom" color="primary" :disabled="!isConnected">
                Connect Room
              </UButton>
              <UButton @click="disconnectRoom" color="red" variant="soft" :disabled="!yroom">
                Disconnect Room
              </UButton>
            </div>

            <p v-if="!isConnected" class="text-xs text-neutral-500">
              Connect a Substrate wallet first to sign statement store entries.
            </p>
          </div>
        </UCard>

        <UCard v-if="peers.length > 0" class="mb-6">
          <template #header>
            <h2 class="text-xl font-semibold">WebRTC Peers ({{ peers.length }})</h2>
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
            <h2 class="text-xl font-semibold">Awareness Peers ({{ awarenessPeers.length }})</h2>
          </template>
          <div class="space-y-2">
            <div
              v-for="(peer, index) in awarenessPeers"
              :key="index"
              class="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm"
            >
              <div class="font-mono">{{ peer.address || 'unknown' }}</div>
              <div class="text-xs text-neutral-500">walletConnected: {{ !!peer.walletConnected }}</div>
            </div>
            <div v-if="awarenessPeers.length === 0" class="text-sm text-neutral-500">
              No awareness states yet.
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
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useSubstrateWallet } from '~/composables/useSubstrateWallet'

const { extensions, accounts, activeAccount, status, refreshExtensions, connect, disconnect, setActiveAccount } = useSubstrateWallet()

const roomId = ref('ss-test-room')
const providerStatus = ref('disconnected')
const peers = ref<string[]>([])
const awarenessPeers = ref<any[]>([])
const logs = ref<Array<{ time: string; message: string }>>([])

const isConnected = computed(() => status.value === 'connected' && !!activeAccount.value)
const address = computed(() => activeAccount.value?.address ?? null)
const shortAddress = computed(() => {
  if (!address.value) return ''
  return `${address.value.slice(0, 6)}...${address.value.slice(-4)}`
})

const substrateAccounts = computed(() => accounts.value.filter((acct) => !/^0x[0-9a-fA-F]{40}$/.test(acct.address)))
const hasOnlyEvmAccounts = computed(() => accounts.value.length > 0 && substrateAccounts.value.length === 0)
const substrateAccountOptions = computed(() => substrateAccounts.value.map((acct) => ({
  label: `${acct.name ?? 'Account'} (${acct.address.slice(0, 6)}...${acct.address.slice(-4)})`,
  value: acct.address
})))

const selectedAccount = computed({
  get: () => activeAccount.value?.address ?? '',
  set: (value: string) => setActiveAccount(value)
})

let yroom: any = null

function addLog(message: string) {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift({ time, message })
  console.log(`[${time}] ${message}`)
}

async function connectFirstExtension() {
  if (extensions.value.length === 0) {
    await refreshExtensions()
  }
  const target = extensions.value[0]
  if (target) {
    await connect(target)
  }
}

async function connectRoom() {
  if (!activeAccount.value) {
    addLog('Connect a Substrate wallet first')
    return
  }

  const { $createYRoom } = useNuxtApp()
  const config = useRuntimeConfig()

  if (yroom?.provider?.destroy) {
    await yroom.provider.destroy()
  }

  yroom = $createYRoom(roomId.value, {
    statementStoreEndpoint: config.public.statementStoreWs,
    account: activeAccount.value,
    signingMode: 'ephemeral',
    peerId: activeAccount.value.address,
    pollInterval: 500,
    presenceTtl: 20000
  })

  providerStatus.value = 'connecting'
  peers.value = []
  awarenessPeers.value = []

  yroom.provider.on('status', (event: any) => {
    providerStatus.value = event.status || 'connecting'
    addLog(`Status: ${providerStatus.value}`)
  })

  yroom.provider.on('peers', (event: any) => {
    peers.value = event.webrtcPeers || []
  })

  yroom.awareness.on('change', () => {
    const states = yroom.awareness.getStates()
    awarenessPeers.value = Array.from(states.values())
  })

  yroom.awareness.setLocalState({
    address: activeAccount.value.address,
    walletConnected: true
  })
}

async function disconnectRoom() {
  if (yroom?.provider?.destroy) {
    await yroom.provider.destroy()
  }
  yroom = null
  providerStatus.value = 'disconnected'
  peers.value = []
  awarenessPeers.value = []
  addLog('Disconnected from room')
}

watch([isConnected, address], ([connected, addr]) => {
  if (!yroom) return
  yroom.awareness.setLocalState({
    ...yroom.awareness.getLocalState(),
    address: connected ? addr : null,
    walletConnected: connected
  })
}, { immediate: true })

onBeforeUnmount(() => {
  void disconnectRoom()
})
</script>
