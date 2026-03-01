<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSubstrateAuth, type SubstrateAuthData } from '~/composables/useSubstrateAuth'
import { useSubstrateWallet } from '~/composables/useSubstrateWallet'
import { useReviveMapAccount } from '~/composables/useReviveMapAccount'

const roomId = 'substrate-auth-test-room'
let yroom: any = null
let substrateAuth: ReturnType<typeof useSubstrateAuth> | null = null

const { extensions, accounts, activeAccount, status, error: walletError, refreshExtensions, connect, disconnect, setActiveAccount } = useSubstrateWallet()
const { status: mapStatus, error: mapError, lastTxHash, mapNote, unmapStatus, unmapError, lastUnmapTxHash, mapAccount, unmapAccount } = useReviveMapAccount()

const isSigningIn = ref(false)
const isSigned = ref(false)
const error = ref<string | null>(null)
const verifiedUsers = ref<Map<string, SubstrateAuthData>>(new Map())
const peerStates = ref<any[]>([])

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

const chainId = computed(() => {
  const config = useRuntimeConfig()
  const name = config.public.substrateChainName as string
  const id = config.public.substrateChainId as string
  if (id) return `${name} (${id})`
  return name || (config.public.substrateChain as string)
})

async function connectFirstExtension() {
  if (extensions.value.length === 0) {
    await refreshExtensions()
  }
  const target = extensions.value[0]
  if (target) {
    await connect(target)
  }
}

onMounted(async () => {
  const { $createYRoom } = useNuxtApp()
  const config = useRuntimeConfig()

  await refreshExtensions()

  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' }
  ]

  if (config.public.turnUsername && config.public.turnCredential) {
    iceServers.push({
      urls: [
        'turn:a.relay.metered.ca:443',
        'turn:a.relay.metered.ca:443?transport=tcp'
      ],
      username: config.public.turnUsername,
      credential: config.public.turnCredential
    })
  }

  yroom = $createYRoom(roomId, { iceServers })
  substrateAuth = useSubstrateAuth(yroom, chainId.value)

  yroom.doc.getMap('users').observe(() => {
    verifiedUsers.value = new Map(yroom.doc.getMap('users'))
  })

  yroom.awareness.on('change', () => {
    const states = yroom.awareness.getStates()
    peerStates.value = Array.from(states.values())
  })
})

watch([isConnected, address], ([connected, addr], [wasConnected, prevAddr]) => {
  if (!yroom) return

  yroom.awareness.setLocalState({
    ...yroom.awareness.getLocalState(),
    address: connected ? addr : null,
    walletConnected: connected
  })

  if (!connected && wasConnected && prevAddr) {
    substrateAuth?.clearSignature(prevAddr)
    isSigned.value = false
  }
}, { immediate: true })

async function handleSignIn() {
  if (!activeAccount.value) {
    error.value = 'Please connect your wallet first'
    return
  }

  if (!substrateAuth) {
    error.value = 'Auth not initialized yet'
    return
  }

  isSigningIn.value = true
  error.value = null

  try {
    await substrateAuth.signIn(activeAccount.value)
    isSigned.value = true

    yroom.awareness.setLocalState({
      ...yroom.awareness.getLocalState(),
      address: activeAccount.value.address,
      signedIn: true,
      walletConnected: true
    })
  } catch (err: any) {
    error.value = err.message || 'Failed to sign in'
  } finally {
    isSigningIn.value = false
  }
}

async function handleMapAccount() {
  error.value = null
  try {
    await mapAccount()
  } catch (err: any) {
    error.value = err.message || 'Failed to map account'
  }
}

async function handleUnmapAccount() {
  error.value = null
  try {
    await unmapAccount()
  } catch (err: any) {
    error.value = err.message || 'Failed to unmap account'
  }
}

async function handleVerifyPeer(peerAddress: string) {
  if (!substrateAuth) return

  const userData = verifiedUsers.value.get(peerAddress)
  if (!userData) return

  const isValid = await substrateAuth.verifyPeer(userData)
  const isActive = await substrateAuth.isUserActive(peerAddress, yroom.awareness.getStates())

  let statusText = ''
  if (isValid && isActive) {
    statusText = 'VERIFIED & ACTIVE ✓✓'
  } else if (isValid && !isActive) {
    statusText = 'VERIFIED but OFFLINE ✓○'
  } else {
    statusText = 'INVALID ✗'
  }

  alert(`Peer ${peerAddress.slice(0, 6)}...${peerAddress.slice(-4)}\n${statusText}`)
}

const connectedPeers = computed(() => peerStates.value.filter(p => p.address))

function getPeerStatus(peer: any) {
  if (peer.walletConnected && peer.signedIn) {
    return { text: '✓ Active & Signed In', color: 'green' }
  } else if (peer.signedIn) {
    return { text: '○ Signed In (Wallet Disconnected)', color: 'yellow' }
  } else if (peer.walletConnected) {
    return { text: '○ Connected (Not Signed In)', color: 'blue' }
  }
  return { text: '○ Not signed in', color: 'gray' }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
    <UContainer>
      <div class="max-w-4xl mx-auto space-y-6">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold mb-2">🧪 Substrate Test Page</h1>
          <p class="text-neutral-600 dark:text-neutral-400">
            DOTConnect + map_account + Substrate sign-in
          </p>
          <p class="text-sm text-neutral-500 mt-2">
            Room: <code class="bg-neutral-200 dark:bg-neutral-800 px-2 py-1 rounded">{{ roomId }}</code>
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

            <p v-if="walletError" class="text-sm text-red-600 dark:text-red-400">
              {{ walletError }}
            </p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">2. Map Address (pallet-revive)</h2>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              Map your Substrate account to an H160 address for revive contracts (required before calling Solidity contracts or you’ll hit <code>OriginMustBeMapped</code>).
            </p>

            <UButton
              @click="handleMapAccount"
              :loading="mapStatus === 'mapping'"
              :disabled="!isConnected || mapStatus === 'mapped'"
              color="primary"
              size="lg"
              block
            >
              {{ mapStatus === 'mapped' ? 'Account Mapped ✓' : (isConnected ? 'Map Account' : 'Connect Wallet First') }}
            </UButton>

            <div v-if="mapStatus === 'mapped'" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div class="flex items-center gap-2 text-green-700 dark:text-green-400">
                <span class="text-2xl">✓</span>
                <div>
                  <p class="font-semibold">{{ mapNote || 'Account mapped' }}</p>
                  <p v-if="lastTxHash" class="text-sm font-mono">Tx: {{ lastTxHash }}</p>
                </div>
              </div>
            </div>

            <UButton
              v-if="mapStatus === 'mapped'"
              @click="handleUnmapAccount"
              :loading="unmapStatus === 'unmapping'"
              color="red"
              variant="soft"
              size="sm"
              block
            >
              Unmap Account
            </UButton>

            <div v-if="unmapStatus === 'unmapped'" class="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 text-sm text-neutral-700 dark:text-neutral-300">
              Account unmapped.
              <span v-if="lastUnmapTxHash" class="font-mono">Tx: {{ lastUnmapTxHash }}</span>
            </div>

            <p v-if="mapError" class="text-sm text-red-600 dark:text-red-400">
              {{ mapError }}
            </p>
            <p v-if="unmapError" class="text-sm text-red-600 dark:text-red-400">
              {{ unmapError }}
            </p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">3. Sign In (Substrate)</h2>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              Sign a message to prove ownership of your Substrate address.
            </p>

            <div v-if="!isSigned">
              <UButton
                @click="handleSignIn"
                :loading="isSigningIn"
                :disabled="!isConnected"
                color="primary"
                size="lg"
                block
              >
                {{ isConnected ? 'Sign In with Substrate' : 'Connect Wallet First' }}
              </UButton>
            </div>

            <div v-else class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div class="flex items-center gap-2 text-green-700 dark:text-green-400">
                <span class="text-2xl">✓</span>
                <div>
                  <p class="font-semibold">Signed In Successfully</p>
                  <p class="text-sm font-mono">{{ address }}</p>
                </div>
              </div>
            </div>

            <p v-if="error" class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              {{ error }}
            </p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">4. Verified Users in Room</h2>
              <UBadge color="blue" variant="subtle">
                {{ verifiedUsers.size }} user{{ verifiedUsers.size !== 1 ? 's' : '' }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              These users have signed in and their signatures are stored in the shared Yjs document.
            </p>

            <div v-if="verifiedUsers.size === 0" class="text-center py-8 text-neutral-400">
              <p>No verified users yet. Sign in to be the first!</p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="[addr, data] in verifiedUsers"
                :key="addr"
                class="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg"
              >
                <div class="flex-1 min-w-0">
                  <p class="font-mono text-sm">
                    {{ addr.slice(0, 10) }}...{{ addr.slice(-8) }}
                  </p>
                  <p class="text-xs text-neutral-500">
                    Signed {{ new Date(data.timestamp).toLocaleString() }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge v-if="addr === address" color="green" variant="soft">
                    You
                  </UBadge>
                  <UButton
                    @click="() => handleVerifyPeer(addr)"
                    size="xs"
                    variant="outline"
                  >
                    Verify
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">5. Connected Peers (WebRTC)</h2>
              <UBadge color="purple" variant="subtle">
                {{ connectedPeers.length }} peer{{ connectedPeers.length !== 1 ? 's' : '' }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              Open this page in multiple browsers/tabs to test awareness.
            </p>

            <div v-if="connectedPeers.length === 0" class="text-center py-8 text-neutral-400">
              <p>No other peers connected. Open this page in another browser/tab!</p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="(peer, idx) in connectedPeers"
                :key="idx"
                class="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
              >
                <div
                  class="w-3 h-3 rounded-full"
                  :class="peer.walletConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"
                ></div>
                <div class="flex-1">
                  <p class="font-mono text-sm">
                    {{ peer.address?.slice(0, 10) }}...{{ peer.address?.slice(-8) }}
                  </p>
                  <p class="text-xs" :class="`text-${getPeerStatus(peer).color}-600 dark:text-${getPeerStatus(peer).color}-400`">
                    {{ getPeerStatus(peer).text }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
