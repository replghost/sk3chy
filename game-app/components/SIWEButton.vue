<script setup lang="ts">
import { ref } from 'vue'
import { useAccount, useSignMessage } from '@wagmi/vue'
import { useSIWE } from '~/composables/useSIWE'

const props = defineProps<{
  yroom: any
}>()

const { address, isConnected } = useAccount()
const { signMessageAsync } = useSignMessage()
const { signIn } = useSIWE(props.yroom)

const isSigningIn = ref(false)
const isSigned = ref(false)
const error = ref<string | null>(null)

async function handleSignIn() {
  if (!address.value) {
    error.value = 'Please connect your wallet first'
    return
  }
  
  isSigningIn.value = true
  error.value = null
  
  try {
    await signIn(address.value, async (message: string) => {
      return await signMessageAsync({ message })
    })
    
    isSigned.value = true
  } catch (err: any) {
    console.error('Sign in error:', err)
    error.value = err.message || 'Failed to sign in'
  } finally {
    isSigningIn.value = false
  }
}
</script>

<template>
  <div>
    <UButton
      v-if="!isSigned"
      @click="handleSignIn"
      :loading="isSigningIn"
      :disabled="!isConnected"
      color="primary"
    >
      {{ isConnected ? 'Sign In with Ethereum' : 'Connect Wallet First' }}
    </UButton>
    
    <div v-else class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
      <span>✓</span>
      <span>Signed in as {{ address?.slice(0, 6) }}...{{ address?.slice(-4) }}</span>
    </div>
    
    <p v-if="error" class="text-sm text-red-600 dark:text-red-400 mt-2">
      {{ error }}
    </p>
  </div>
</template>
