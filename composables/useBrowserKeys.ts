import { computed, ref } from 'vue'
import { isInsideContainerSync } from '@parity/product-sdk-host'
import { useHostAccount } from './useHostAccount'
import { safeStorage } from '~/utils/safeStorage'

const STORAGE_KEY_USERNAME = 'sk3tchy-username'

export interface BrowserWallet {
  mnemonic: string
  publicKey: Uint8Array
  publicKeyHex: string
  address: string
  sign: (message: Uint8Array | string) => Uint8Array
}

// Host detection via the product SDK: iframe parent, __HOST_WEBVIEW_MARK__,
// or an injected __HOST_API_PORT__ (covers epoca/Gecko hosts and Polkadot
// Desktop/Mobile WebViews). window.host covers host-sdk runtimes that only
// inject the bridge global.
const isInHost = computed(() => {
  if (typeof window === 'undefined') return false
  return isInsideContainerSync() || !!window.host
})

const wallet = ref<BrowserWallet | null>(null)
const username = ref('')
const shortAddress = ref('')
const initialized = ref(false)

function init() {
  // Host-only app: outside a host container there is no identity to set up
  // (app.vue renders the host-required screen instead of the game).
  if (!isInHost.value) {
    initialized.value = true
    return
  }

  const stored = safeStorage.getItem(STORAGE_KEY_USERNAME)
  if (stored) username.value = stored
  initialized.value = true

  const hostAccount = useHostAccount()
  hostAccount.init().then(() => {
    const acc = hostAccount.account.value
    if (!acc) return
    shortAddress.value = acc.address.slice(0, 6) + '...' + acc.address.slice(-4)
    if (!username.value && acc.name) {
      username.value = acc.name
    }
  })
}

function setUsername(name: string) {
  username.value = name
  safeStorage.setItem(STORAGE_KEY_USERNAME, name)
}

export function useBrowserKeys() {
  const h = useHostAccount()
  return {
    init,
    wallet,
    username,
    shortAddress,
    initialized,
    setUsername,
    isInHost,
    hostAccount: h.account,
    hostReady: h.isReady,
    hostInitFailed: h.initFailed,
    hostSignRaw: h.signRaw,
  }
}
