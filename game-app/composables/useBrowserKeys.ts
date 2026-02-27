import { ref } from 'vue'
import { sr25519CreateDerive, withNetworkAccount } from '@polkadot-labs/hdkd'
import {
  generateMnemonic,
  mnemonicToMiniSecret,
  validateMnemonic,
} from '@polkadot-labs/hdkd-helpers'
import { u8aToHex } from '@polkadot/util'
import { useSpektr } from './useSpektr'

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

// Module-level cache so derivation happens once
let cachedWallet: BrowserWallet | null = null

const wallet = ref<BrowserWallet | null>(null)
const username = ref('')
const shortAddress = ref('')
const initialized = ref(false)

const spektr = useSpektr()

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
    username.value = localStorage.getItem(STORAGE_KEY_USERNAME) || ''
    shortAddress.value = cachedWallet.address.slice(0, 6) + '...' + cachedWallet.address.slice(-4)
    initialized.value = true
    return
  }

  let mnemonic = localStorage.getItem(STORAGE_KEY_MNEMONIC)

  if (!mnemonic || !validateMnemonic(mnemonic)) {
    mnemonic = generateMnemonic(128) // 12 words
    localStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic)
  }

  const stored = localStorage.getItem(STORAGE_KEY_USERNAME)
  if (stored) username.value = stored

  cachedWallet = deriveWallet(mnemonic)
  wallet.value = cachedWallet
  shortAddress.value = cachedWallet.address.slice(0, 6) + '...' + cachedWallet.address.slice(-4)
  initialized.value = true

  // Also init Spektr (no-ops if not in iframe)
  spektr.init()
}

function setUsername(name: string) {
  username.value = name
  localStorage.setItem(STORAGE_KEY_USERNAME, name)
}

export function useBrowserKeys() {
  return {
    init,
    wallet,
    username,
    shortAddress,
    initialized,
    setUsername,
    isInHost: spektr.isInContainer,
    spektrReady: spektr.isReady,
    spektrAccount: spektr.selectedAccount,
    spektrExtension: spektr.extension,
    spektrSignRaw: spektr.signRaw,
  }
}
