<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccount, useConnect, useDisconnect, useSignMessage } from '@wagmi/vue'
import { useSIWE, type SIWEData } from '~/composables/useSIWE'

// Create a simple Yjs room for testing
const roomId = 'siwe-test-room'
let yroom: any = null
let siweComposable: any = null

const { address, isConnected } = useAccount()
const { connectors, connect } = useConnect()
const { disconnect } = useDisconnect()
const { signMessageAsync } = useSignMessage()

const isSigningIn = ref(false)
const isSigned = ref(false)
const error = ref<string | null>(null)
const verifiedUsers = ref<Map<string, SIWEData>>(new Map())
const peerStates = ref<any[]>([])

onMounted(async () => {
  // Initialize Yjs room
  const { $createYRoom } = useNuxtApp()
  yroom = $createYRoom(roomId, {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })
  
  // Initialize SIWE
  siweComposable = useSIWE(yroom)
  
  // Watch for verified users changes
  yroom.doc.getMap('users').observe(() => {
    verifiedUsers.value = new Map(yroom.doc.getMap('users'))
  })
  
  // Watch for peer awareness changes
  yroom.awareness.on('change', () => {
    const states = yroom.awareness.getStates()
    peerStates.value = Array.from(states.values())
  })
  
  console.log('[SIWE Test] Room initialized:', roomId)
})

// Watch wallet connection status
watch([isConnected, address], ([connected, addr], [wasConnected, prevAddr]) => {
  if (!yroom) return
  
  // Update awareness with wallet connection status
  yroom.awareness.setLocalState({
    ...yroom.awareness.getLocalState(),
    address: connected ? addr : null,
    walletConnected: connected
  })
  
  // Clear signature on disconnect
  if (!connected && wasConnected && prevAddr) {
    siweComposable?.clearSignature(prevAddr)
    isSigned.value = false
    console.log('[SIWE Test] Cleared signature on disconnect')
  }
}, { immediate: true })

async function handleSignIn() {
  if (!address.value) {
    error.value = 'Please connect your wallet first'
    return
  }
  
  if (!siweComposable) {
    error.value = 'SIWE not initialized yet'
    return
  }
  
  isSigningIn.value = true
  error.value = null
  
  try {
    const result = await siweComposable.signIn(address.value, async (message: string) => {
      return await signMessageAsync({ message })
    })
    
    console.log('[SIWE Test] Signed in:', result)
    isSigned.value = true
    
    // Update awareness with address and wallet connection
    yroom.awareness.setLocalState({
      ...yroom.awareness.getLocalState(),
      address: address.value,
      signedIn: true,
      walletConnected: true
    })
  } catch (err: any) {
    console.error('[SIWE Test] Sign in error:', err)
    error.value = err.message || 'Failed to sign in'
  } finally {
    isSigningIn.value = false
  }
}

async function handleVerifyPeer(peerAddress: string) {
  if (!siweComposable) return
  
  const userData = verifiedUsers.value.get(peerAddress)
  if (!userData) {
    console.warn('[SIWE Test] No data for peer:', peerAddress)
    return
  }
  
  const isValid = await siweComposable.verifyPeer(userData)
  const isActive = await siweComposable.isUserActive(peerAddress, yroom.awareness.getStates())
  
  console.log('[SIWE Test] Peer verification:', { peerAddress, isValid, isActive })
  
  let status = ''
  if (isValid && isActive) {
    status = 'VERIFIED & ACTIVE ✓✓'
  } else if (isValid && !isActive) {
    status = 'VERIFIED but OFFLINE ✓○'
  } else {
    status = 'INVALID ✗'
  }
  
  alert(`Peer ${peerAddress.slice(0, 6)}...${peerAddress.slice(-4)}\n${status}`)
}

const connectedPeers = computed(() => {
  return peerStates.value.filter(p => p.address)
})

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
        <!-- Header -->
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold mb-2">🔐 SIWE Test Page</h1>
          <p class="text-neutral-600 dark:text-neutral-400">
            Test Sign-In with Ethereum in a P2P environment
          </p>
          <p class="text-sm text-neutral-500 mt-2">
            Room: <code class="bg-neutral-200 dark:bg-neutral-800 px-2 py-1 rounded">{{ roomId }}</code>
          </p>
        </div>

        <!-- Wallet Connection -->
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">1. Connect Wallet</h2>
          </template>

          <div class="space-y-4">
            <div v-if="!isConnected" class="space-y-2">
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Choose a wallet to connect:
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="connector in connectors"
                  :key="connector.uid"
                  @click="() => connect({ connector })"
                  variant="outline"
                >
                  {{ connector.name }}
                </UButton>
              </div>
            </div>

            <div v-else class="flex items-center justify-between">
              <div>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">Connected as:</p>
                <p class="font-mono text-lg">
                  {{ address?.slice(0, 6) }}...{{ address?.slice(-4) }}
                </p>
              </div>
              <UButton @click="() => disconnect()" color="red" variant="soft">
                Disconnect
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- SIWE Sign In -->
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">2. Sign In with Ethereum</h2>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              Sign a message to prove ownership of your address. This uses client-generated nonces and stores the signature in the P2P Yjs document.
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
                {{ isConnected ? 'Sign In with Ethereum' : 'Connect Wallet First' }}
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

        <!-- Verified Users in Room -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">3. Verified Users in Room</h2>
              <UBadge color="blue" variant="subtle">
                {{ verifiedUsers.size }} user{{ verifiedUsers.size !== 1 ? 's' : '' }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              These users have signed in and their signatures are stored in the shared Yjs document. Click "Verify" to check their signature.
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

        <!-- Connected Peers (Awareness) -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">4. Connected Peers (WebRTC)</h2>
              <UBadge color="purple" variant="subtle">
                {{ connectedPeers.length }} peer{{ connectedPeers.length !== 1 ? 's' : '' }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              These peers are connected via WebRTC and have awareness state. Open this page in multiple browsers/tabs to test.
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

        <!-- Debug Info -->
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Debug Info</h2>
          </template>

          <div class="space-y-2 text-xs font-mono">
            <div class="grid grid-cols-2 gap-2">
              <div class="text-neutral-500">Wallet Connected:</div>
              <div>{{ isConnected ? '✓' : '✗' }}</div>
              
              <div class="text-neutral-500">SIWE Signed In:</div>
              <div>{{ isSigned ? '✓' : '✗' }}</div>
              
              <div class="text-neutral-500">Verified Users:</div>
              <div>{{ verifiedUsers.size }}</div>
              
              <div class="text-neutral-500">Connected Peers:</div>
              <div>{{ connectedPeers.length }}</div>
            </div>
          </div>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
