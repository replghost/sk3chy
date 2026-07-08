// composables/useHostAccount.ts
//
// Singleton composable for the host-supplied product account
// (Parity Polkadot Host via @parity/product-sdk-signer).
//
// The account is requested via the explicit productAccount path with the
// URL-derived dotNS identifier (see utils/dotns.ts) — the host scopes the
// derivation to the binding identifier, and the SDK resolves the account
// name from the host identity (getUserId().primaryUsername), so no local
// wallet or username prompt is needed.
import { ref } from 'vue'
import {
  SignerManager,
  HostProvider,
  DevProvider,
  type SignerAccount,
} from '@parity/product-sdk-signer'
import { getSelfDotNs } from '~/utils/dotns'

let manager: SignerManager | null = null
let initPromise: Promise<void> | null = null

const account = ref<SignerAccount | null>(null)
const isReady = ref(false)
const initFailed = ref(false)

export function useHostAccount() {
  function init(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if (initPromise) return initPromise

    const dotNsIdentifier = getSelfDotNs()

    initPromise = (async () => {
      try {
        manager = new SignerManager({
          dappName: dotNsIdentifier,
          createProvider: (type) =>
            type === 'host'
              ? new HostProvider({ productAccount: { dotNsIdentifier } })
              : new DevProvider(),
        })
        manager.subscribe((state) => {
          account.value = state.selectedAccount
          isReady.value = state.status === 'connected' && !!state.selectedAccount
        })

        const result = await manager.connect()
        if (!result.ok) {
          console.warn('[HostAccount] connect failed:', result.error.message)
          initFailed.value = true
          return
        }

        const state = manager.getState()
        account.value = state.selectedAccount
        isReady.value = !!state.selectedAccount
        if (!state.selectedAccount) {
          console.warn('[HostAccount] connected but no account supplied by host')
          initFailed.value = true
        }
      } catch (error) {
        console.error('[HostAccount] initialization error:', error)
        initFailed.value = true
      }
    })()

    return initPromise
  }

  /**
   * Fetch the user's main identity (RFC-0014 primaryUsername) from the host.
   * Triggers a host identity-permission prompt; returns null if the user is
   * not logged in or denies. Use when account.name stayed null at connect.
   */
  async function getUserId(): Promise<string | null> {
    if (!manager) return null
    const result = await manager.getUserId()
    if (!result.ok) {
      console.warn('[HostAccount] getUserId failed:', result.error.message)
      return null
    }
    return result.value.primaryUsername
  }

  async function signRaw(data: Uint8Array): Promise<Uint8Array> {
    if (!manager) {
      throw new Error('[HostAccount] not initialized')
    }
    const result = await manager.signRaw(data)
    if (!result.ok) {
      throw result.error
    }
    return result.value
  }

  return { init, account, isReady, initFailed, signRaw, getUserId }
}
