// composables/useSpektr.ts
//
// Singleton composable — all callers share the same reactive state.
// Must be called inside a Vue component context (or effectScope) on first use.
import { ref, computed } from 'vue'
import { injectSpektrExtension, SpektrExtensionName } from '@novasamatech/product-sdk'

export interface SpektrAccount {
  address: string
  name?: string
  type?: string
}

export function useSpektr() {
  const accounts = ref<SpektrAccount[]>([])
  const selectedAccount = ref<SpektrAccount | null>(null)
  const isReady = ref(false)
  const initFailed = ref(false)
  const extension = ref<any>(null)

  let unsubscribeAccounts: (() => void) | null = null

  const isInContainer = computed(() => {
    if (typeof window === 'undefined') return false
    return window.parent !== window
  })

  async function init() {
    if (typeof window === 'undefined') return

    try {
      if (!isInContainer.value) {
        return
      }

      // Retry logic for when parent is still loading
      let retries = 0
      const maxRetries = 10
      const retryDelay = 500 // ms

      while (retries < maxRetries) {
        const ready = await injectSpektrExtension()

        if (ready) {
          break
        }

        retries++
        if (retries < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
        } else {
          console.warn('[Spektr] Failed to initialize after', maxRetries, 'attempts')
          initFailed.value = true
          return
        }
      }

      // Check if injected
      if (!window.injectedWeb3?.[SpektrExtensionName]) {
        console.warn('[Spektr] Extension not found after injection')
        initFailed.value = true
        return
      }

      // Enable the extension
      const ext = await window.injectedWeb3[SpektrExtensionName].enable()
      extension.value = ext

      // Get initial accounts first, then subscribe for updates
      const accs = await ext.accounts.get()
      accounts.value = accs
      selectedAccount.value = accs[0] || null

      // Only mark ready if we actually have accounts
      if (accs.length > 0) {
        isReady.value = true
      }

      // Subscribe to future account changes
      unsubscribeAccounts = ext.accounts.subscribe((accs: any[]) => {
        accounts.value = accs
        selectedAccount.value = accs[0] || null
        // Update readiness based on account availability
        isReady.value = accs.length > 0
      })
    } catch (error) {
      console.error('[Spektr] Initialization error:', error)
      initFailed.value = true
    }
  }

  function cleanup() {
    if (typeof window === 'undefined') return

    unsubscribeAccounts?.()
    unsubscribeAccounts = null
    accounts.value = []
    selectedAccount.value = null
    isReady.value = false
    initFailed.value = false
    extension.value = null
  }

  async function signRaw(hexMessage: string): Promise<string> {
    if (!extension.value || !selectedAccount.value) {
      throw new Error('Spektr not initialized or no account selected')
    }

    const result = await extension.value.signer.signRaw({
      address: selectedAccount.value.address,
      data: hexMessage,
      type: 'bytes'
    })

    // Handle both formats: string or { signature: string }
    const signature = typeof result === 'string' ? result : result?.signature
    if (!signature || typeof signature !== 'string') {
      throw new Error(`[Spektr] signRaw returned unexpected result: ${JSON.stringify(result)}`)
    }
    return signature
  }

  async function signPayload(payload: any): Promise<any> {
    if (!extension.value || !selectedAccount.value) {
      throw new Error('Spektr not initialized or no account selected')
    }

    const result = await extension.value.signer.signPayload(payload)
    return {
      signature: result.signature,
      signedTransaction: result.signedTransaction
    }
  }

  return {
    accounts,
    selectedAccount,
    isReady,
    initFailed,
    isInContainer,
    extension,
    init,
    cleanup,
    signRaw,
    signPayload
  }
}
