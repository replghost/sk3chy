// composables/useSpektr.ts
import { ref, computed } from 'vue'
import { injectSpektrExtension, SpektrExtensionName } from '@novasamatech/product-sdk'

interface Account {
  address: string
  name?: string
  type?: string
}

interface UseSpektrOptions {
  debug?: boolean
}

export function useSpektr(options: UseSpektrOptions = { debug: false }) {
  const { debug = false } = options
  const log = debug ? console.log : () => {}

  const accounts = ref<Account[]>([])
  const selectedAccount = ref<Account | null>(null)
  const isReady = ref(false)
  const extension = ref<any>(null)

  const isInContainer = computed(() => {
    if (typeof window === 'undefined') return false
    return window.parent !== window
  })

  async function init() {
    if (typeof window === 'undefined') return

    try {
      log('[Spektr] Initializing...')

      if (!isInContainer.value) {
        log('[Spektr] Not in iframe, skipping initialization')
        return
      }

      log('[Spektr] Calling injectSpektrExtension()...')

      // Retry logic for when parent is still loading
      let retries = 0
      const maxRetries = 10
      const retryDelay = 500 // ms

      while (retries < maxRetries) {
        const ready = await injectSpektrExtension()

        if (ready) {
          log('[Spektr] Handshake successful on attempt', retries + 1)
          break
        }

        retries++
        if (retries < maxRetries) {
          log('[Spektr] Handshake failed, retrying...', retries, '/', maxRetries)
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
        } else {
          console.error('[Spektr] Failed to initialize after', maxRetries, 'attempts')
          return
        }
      }

      // Check if injected
      if (!window.injectedWeb3?.[SpektrExtensionName]) {
        console.error('[Spektr] Extension not found after injection')
        return
      }

      log('[Spektr] SDK injected successfully')

      // Enable the extension (returns the actual extension object)
      const ext = await window.injectedWeb3[SpektrExtensionName].enable()
      extension.value = ext

      log('[Spektr] Extension enabled')

      // Subscribe to account changes
      ext.accounts.subscribe((accs: any[]) => {
        log('[Spektr] Accounts updated:', accs)
        accounts.value = accs
        selectedAccount.value = accs[0] || null
      })

      // Get initial accounts
      const accs = await ext.accounts.get()
      accounts.value = accs
      selectedAccount.value = accs[0] || null
      isReady.value = true

      log('[Spektr] Initialized with accounts:', {
        count: accs.length,
        selected: selectedAccount.value?.address
      })
    } catch (error) {
      console.error('[Spektr] Initialization error:', error)
    }
  }

  function cleanup() {
    if (typeof window === 'undefined') return

    accounts.value = []
    selectedAccount.value = null
    isReady.value = false
  }

  async function signRaw(hexMessage: string): Promise<string> {
    if (!extension.value || !selectedAccount.value) {
      throw new Error('Spektr not initialized or no account selected')
    }

    try {
      const result = await extension.value.signer.signRaw({
        address: selectedAccount.value.address,
        data: hexMessage,
        type: 'bytes'
      })

      log('[Spektr] signRaw result:', result)

      // Handle both formats: string or { signature: string }
      const signature = typeof result === 'string' ? result : result.signature
      return signature
    } catch (error) {
      console.error('[Spektr] Sign raw failed:', error)
      throw error
    }
  }

  async function signPayload(payload: any): Promise<any> {
    if (!extension.value || !selectedAccount.value) {
      throw new Error('Spektr not initialized or no account selected')
    }

    try {
      const result = await extension.value.signer.signPayload(payload)

      log('[Spektr] signPayload result:', result)

      return {
        signature: result.signature,
        signedTransaction: result.signedTransaction
      }
    } catch (error) {
      console.error('[Spektr] Sign payload failed:', error)
      throw error
    }
  }

  return {
    accounts,
    selectedAccount,
    isReady,
    isInContainer,
    extension,
    init,
    cleanup,
    signRaw,
    signPayload
  }
}
