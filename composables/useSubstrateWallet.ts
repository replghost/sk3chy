import { connectInjectedExtension, getInjectedExtensions, type InjectedExtension, type InjectedPolkadotAccount } from 'polkadot-api/pjs-signer'
import { useProductHost, type ProductHostAccount } from '~/composables/useProductHost'

type WalletStatus = 'idle' | 'connecting' | 'connected' | 'error'
type Sk3chySubstrateAccount = InjectedPolkadotAccount | ProductHostAccount

let activeExtension: InjectedExtension | null = null
let unsubscribeAccounts: (() => void) | null = null

function isEvmAddress(address: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

export function useSubstrateWallet() {
  const extensions = useState<string[]>('substrate-wallet-extensions', () => [])
  const accounts = useState<Sk3chySubstrateAccount[]>('substrate-wallet-accounts', () => [])
  const activeAccount = useState<Sk3chySubstrateAccount | null>('substrate-wallet-active', () => null)
  const status = useState<WalletStatus>('substrate-wallet-status', () => 'idle')
  const error = useState<string | null>('substrate-wallet-error', () => null)
  const connectedExtension = useState<string | null>('substrate-wallet-extension', () => null)
  const config = useRuntimeConfig()
  const productHost = useProductHost()

  async function refreshExtensions() {
    if (process.server) return []
    if (await productHost.detect()) {
      extensions.value = ['Polkadot Host']
      return extensions.value
    }
    const list = getInjectedExtensions()
    extensions.value = list
    return list
  }

  async function connect(extensionName?: string) {
    if (process.server) return
    status.value = 'connecting'
    error.value = null

    try {
      const available = await refreshExtensions()
      const target = extensionName ?? available[0]
      if (!target) throw new Error('No Substrate wallets detected')

      if (target === 'Polkadot Host') {
        connectedExtension.value = target
        const account = await productHost.connect()
        accounts.value = account ? [account] : []
        activeAccount.value = account
        status.value = 'connected'
        return null
      }

      connectedExtension.value = target
      const dappName = (config.public.substrateDappName as string) || 'sk3chy'
      activeExtension = await connectInjectedExtension(target, dappName)

      const nextAccounts = activeExtension.getAccounts()
      accounts.value = nextAccounts
      if (!activeAccount.value && nextAccounts.length > 0) {
        activeAccount.value = nextAccounts.find((acct) => !isEvmAddress(acct.address)) ?? nextAccounts[0]
      }

      if (unsubscribeAccounts) unsubscribeAccounts()
      unsubscribeAccounts = activeExtension.subscribe((updatedAccounts) => {
        accounts.value = updatedAccounts
        if (!activeAccount.value) {
          activeAccount.value = updatedAccounts.find((acct) => !isEvmAddress(acct.address)) ?? updatedAccounts[0] ?? null
          return
        }
        const stillExists = updatedAccounts.some((acct) => acct.address === activeAccount.value?.address)
        if (!stillExists) {
          activeAccount.value = updatedAccounts.find((acct) => !isEvmAddress(acct.address)) ?? updatedAccounts[0] ?? null
        }
      })

      status.value = 'connected'
      return activeExtension
    } catch (err: any) {
      status.value = 'error'
      error.value = err?.message ?? 'Failed to connect wallet'
      throw err
    }
  }

  function disconnect() {
    if (unsubscribeAccounts) {
      unsubscribeAccounts()
      unsubscribeAccounts = null
    }
    if (activeExtension) {
      activeExtension.disconnect()
      activeExtension = null
    }
    productHost.disconnect()
    accounts.value = []
    activeAccount.value = null
    connectedExtension.value = null
    status.value = 'idle'
  }

  function setActiveAccount(address: string) {
    const next = accounts.value.find((acct) => acct.address === address) ?? null
    activeAccount.value = next
  }

  return {
    extensions,
    accounts,
    activeAccount,
    status,
    error,
    connectedExtension,
    refreshExtensions,
    connect,
    disconnect,
    setActiveAccount
  }
}
