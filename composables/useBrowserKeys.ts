import { computed, ref } from 'vue'
import { sr25519CreateDerive, withNetworkAccount } from '@polkadot-labs/hdkd'
import {
  generateMnemonic,
  mnemonicToMiniSecret,
  validateMnemonic,
} from '@polkadot-labs/hdkd-helpers'
import { u8aToHex } from '@polkadot/util'
import { useProductHost } from '~/composables/useProductHost'

const STORAGE_KEY_MNEMONIC = 'sk3tchy-mnemonic'
const STORAGE_KEY_USERNAME = 'sk3tchy-username'
const DERIVATION_PATH = '//wallet'

export interface BrowserWallet {
  mnemonic: string
  publicKey: Uint8Array
  publicKeyHex: string
  address: string
  sign: (message: Uint8Array | string) => Uint8Array
}

// Module-level cache so derivation happens once (singleton)
let cachedWallet: BrowserWallet | null = null
let memoryMnemonic: string | null = null
let memoryUsername = ''

const wallet = ref<BrowserWallet | null>(null)
const username = ref('')
const shortAddress = ref('')
const initialized = ref(false)

function getStoredValue(key: string): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return key === STORAGE_KEY_USERNAME ? memoryUsername : (memoryMnemonic || '')
  }
}

function setStoredValue(key: string, value: string): void {
  if (key === STORAGE_KEY_USERNAME) memoryUsername = value
  if (key === STORAGE_KEY_MNEMONIC) memoryMnemonic = value

  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Sandboxed products may block localStorage. Keep an in-memory value so the
    // app can still boot and rely on product-host identity where available.
  }
}

function deriveWallet(mnemonic: string): BrowserWallet {
  const miniSecret = mnemonicToMiniSecret(mnemonic)
  const derive = sr25519CreateDerive(miniSecret)
  const keyPair = derive(DERIVATION_PATH)
  const account = withNetworkAccount(keyPair)

  return {
    mnemonic,
    publicKey: account.publicKey,
    publicKeyHex: u8aToHex(account.publicKey),
    address: account.ss58Address,
    sign: keyPair.sign,
  }
}

function init() {
  if (cachedWallet) {
    wallet.value = cachedWallet
    username.value = getStoredValue(STORAGE_KEY_USERNAME)
    shortAddress.value = cachedWallet.address.slice(0, 6) + '...' + cachedWallet.address.slice(-4)
    initialized.value = true
    return
  }

  let mnemonic = getStoredValue(STORAGE_KEY_MNEMONIC)

  if (!mnemonic || !validateMnemonic(mnemonic)) {
    mnemonic = generateMnemonic(128) // 12 words
    setStoredValue(STORAGE_KEY_MNEMONIC, mnemonic)
  }

  const stored = getStoredValue(STORAGE_KEY_USERNAME)
  if (stored) username.value = stored

  cachedWallet = deriveWallet(mnemonic)
  wallet.value = cachedWallet
  shortAddress.value = cachedWallet.address.slice(0, 6) + '...' + cachedWallet.address.slice(-4)
  initialized.value = true
}

function setUsername(name: string) {
  username.value = name
  setStoredValue(STORAGE_KEY_USERNAME, name)
}

export function useBrowserKeys() {
  const productHost = useProductHost()
  function initProductAware() {
    init()
    void productHost.detect().then((inside) => {
      if (inside) {
        void productHost.connect().catch(() => undefined)
      }
    })
  }

  return {
    init: initProductAware,
    wallet,
    username,
    shortAddress,
    initialized,
    setUsername,
    isInHost: productHost.isInsideHost,
    productHostReady: computed(() => productHost.status.value === 'connected'),
    productHostInitFailed: computed(() => productHost.status.value === 'error'),
    productHostAccount: productHost.activeAccount,
    productHostSignRaw: async (hexMessage: string) => {
      const account = productHost.activeAccount.value ?? await productHost.connect()
      if (!account) throw new Error('Product host account not available')
      const hex = hexMessage.startsWith('0x') ? hexMessage.slice(2) : hexMessage
      const payload = Uint8Array.from(hex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [])
      const signature = await account.polkadotSigner.signBytes(payload)
      return u8aToHex(signature)
    },
  }
}
