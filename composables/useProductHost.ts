import { encodeAddress } from '@polkadot/util-crypto'
import {
  getAccountsProvider,
  getHostLocalStorage,
  getHostProvider,
  isInsideContainer,
  requestPermission,
  type AccountsProvider,
  type HostLocalStorage,
  type ProductAccount
} from '@parity/product-sdk-host'

type HostStatus = 'idle' | 'connecting' | 'connected' | 'unavailable' | 'error'

export interface ProductHostAccount {
  address: string
  name: string
  type: 'sr25519'
  publicKey: Uint8Array
  dotNsIdentifier: string
  derivationIndex: number
  polkadotSigner: {
    publicKey: Uint8Array
    signBytes(data: Uint8Array): Promise<Uint8Array>
    signTx(...args: any[]): Promise<Uint8Array>
  }
  source: 'product-host'
}

let accountsProvider: AccountsProvider | null = null
let hostStorage: HostLocalStorage | null = null

function normalizeDotNs(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.endsWith('.dot') || trimmed.includes(':') ? trimmed : `${trimmed}.dot`
}

export function deriveProductDotNs() {
  if (typeof window === 'undefined') return ''

  const hostname = window.location.hostname.toLowerCase()
  const host = window.location.host.toLowerCase()

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost')
  ) {
    return host
  }

  if (hostname.endsWith('.dot')) {
    const segments = hostname.split('.')
    return segments.length > 2 ? segments.slice(-2).join('.') : hostname
  }

  const segments = hostname.split('.')
  if (segments.length >= 3) {
    let label = segments.slice(0, -2)
    if (label[label.length - 1] === 'app') label = label.slice(0, -1)
    if (label.length > 0) return `${label.join('.')}.dot`
  }

  return hostname
}

function productAccountToActiveAccount(
  provider: AccountsProvider,
  account: ProductAccount,
  ss58Prefix: number
): ProductHostAccount {
  return {
    address: encodeAddress(account.publicKey, ss58Prefix),
    name: `Product account · ${account.dotNsIdentifier}`,
    type: 'sr25519',
    publicKey: account.publicKey,
    dotNsIdentifier: account.dotNsIdentifier,
    derivationIndex: account.derivationIndex,
    polkadotSigner: provider.getProductAccountSigner(account),
    source: 'product-host'
  }
}

export function useProductHost() {
  const status = useState<HostStatus>('product-host-status', () => 'idle')
  const error = useState<string | null>('product-host-error', () => null)
  const productDotNs = useState<string>('product-host-dotns', () => '')
  const activeAccount = useState<ProductHostAccount | null>('product-host-account', () => null)
  const isInsideHost = useState<boolean>('product-host-inside', () => false)
  const config = useRuntimeConfig()

  const ss58Prefix = computed(() => Number(config.public.substrateSs58Prefix ?? 42))

  async function detect() {
    if (process.server) return false

    const inside = await isInsideContainer().catch(() => false)
    isInsideHost.value = inside

    const configuredDotNs = normalizeDotNs(config.public.productDotNs as string)
    productDotNs.value = configuredDotNs || deriveProductDotNs()

    if (!inside) {
      status.value = 'unavailable'
    }

    return inside
  }

  async function connect() {
    if (process.server) return null

    status.value = 'connecting'
    error.value = null

    try {
      const inside = isInsideHost.value || await detect()
      if (!inside) {
        throw new Error('Polkadot Host is not available. Open this product inside dothost.org / Polkadot Host.')
      }

      accountsProvider = await getAccountsProvider()
      if (!accountsProvider) {
        throw new Error('Product accounts are not available from the host.')
      }

      const dotNs = productDotNs.value || deriveProductDotNs()
      if (!dotNs) {
        throw new Error('Unable to derive the product .dot identifier.')
      }

      // Establish the host signing session before asking for the app-scoped account.
      await accountsProvider.getLegacyAccounts().match(
        () => undefined,
        () => undefined
      )

      const submitPermission = await requestPermission({ tag: 'ChainSubmit', value: undefined })
      if (!submitPermission.ok || !submitPermission.value) {
        throw new Error('Polkadot Host did not grant chain transaction signing permission.')
      }

      const account = await accountsProvider.getProductAccount(dotNs, 0).match(
        (value) => value,
        (err) => {
          const name = typeof err === 'object' && err && 'name' in err ? String((err as any).name) : 'HostError'
          throw new Error(`Unable to get product account for ${dotNs}: ${name}`)
        }
      )

      activeAccount.value = productAccountToActiveAccount(accountsProvider, account, ss58Prefix.value)
      status.value = 'connected'
      return activeAccount.value
    } catch (err: any) {
      status.value = 'error'
      error.value = err?.message ?? String(err)
      activeAccount.value = null
      throw err
    }
  }

  function disconnect() {
    activeAccount.value = null
    if (isInsideHost.value) {
      status.value = 'unavailable'
      return
    }
    status.value = 'idle'
  }

  async function storage() {
    if (hostStorage) return hostStorage
    hostStorage = await getHostLocalStorage()
    return hostStorage
  }

  async function providerForGenesis(genesisHash: `0x${string}`) {
    return await getHostProvider(genesisHash)
  }

  return {
    status,
    error,
    productDotNs,
    activeAccount,
    isInsideHost,
    detect,
    connect,
    disconnect,
    storage,
    providerForGenesis
  }
}
