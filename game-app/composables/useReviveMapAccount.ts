import { usePapiClient } from '~/composables/usePapiClient'
import { useSubstrateWallet } from '~/composables/useSubstrateWallet'
import { decodeAddress, keccakAsU8a } from '@polkadot/util-crypto'
import { u8aToHex, hexToU8a } from '@polkadot/util'
import { FixedSizeBinary, Binary } from 'polkadot-api'

type MapStatus = 'idle' | 'mapping' | 'mapped' | 'error'
type UnmapStatus = 'idle' | 'unmapping' | 'unmapped' | 'error'

export function useReviveMapAccount() {
  const { activeAccount } = useSubstrateWallet()
  const status = useState<MapStatus>('revive-map-status', () => 'idle')
  const error = useState<string | null>('revive-map-error', () => null)
  const lastTxHash = useState<string | null>('revive-map-txhash', () => null)
  const mapNote = useState<string | null>('revive-map-note', () => null)
  const lastCheckedAddress = useState<string | null>('revive-map-last-checked', () => null)

  const unmapStatus = useState<UnmapStatus>('revive-unmap-status', () => 'idle')
  const unmapError = useState<string | null>('revive-unmap-error', () => null)
  const lastUnmapTxHash = useState<string | null>('revive-unmap-txhash', () => null)

  function isAlreadyMappedError(err: unknown) {
    const raw = (() => {
      if (!err) return ''
      if (typeof err === 'string') return err
      const anyErr = err as any
      return [
        anyErr?.message,
        anyErr?.name,
        anyErr?.data,
        anyErr?.dispatchError?.name,
        anyErr?.dispatchError?.type,
        JSON.stringify(anyErr)
      ]
        .filter(Boolean)
        .join(' ')
    })()
    const text = raw.toLowerCase()
    return text.includes('accountalreadymapped') || (text.includes('already') && text.includes('mapped'))
  }

  function isNotMappedError(err: unknown) {
    const raw = (() => {
      if (!err) return ''
      if (typeof err === 'string') return err
      const anyErr = err as any
      return [
        anyErr?.message,
        anyErr?.name,
        anyErr?.data,
        anyErr?.dispatchError?.name,
        anyErr?.dispatchError?.type,
        JSON.stringify(anyErr)
      ]
        .filter(Boolean)
        .join(' ')
    })()
    const text = raw.toLowerCase()
    return text.includes('not mapped') || text.includes('nomapping') || text.includes('accountnotmapped')
  }

  function resolveMapAccountCandidates(api: any) {
    return [
      { label: 'revive.map_account', build: () => api.tx?.revive?.map_account?.() },
      { label: 'revive.mapAccount', build: () => api.tx?.revive?.mapAccount?.() },
      { label: 'revive.mapAddress', build: () => api.tx?.revive?.mapAddress?.() },
      { label: 'Revive.map_account', build: () => api.tx?.Revive?.map_account?.() },
      { label: 'Revive.mapAccount', build: () => api.tx?.Revive?.mapAccount?.() },
      { label: 'Revive.mapAddress', build: () => api.tx?.Revive?.mapAddress?.() },
      { label: 'palletRevive.map_account', build: () => api.tx?.palletRevive?.map_account?.() },
      { label: 'palletRevive.mapAccount', build: () => api.tx?.palletRevive?.mapAccount?.() },
      { label: 'revive.map_address', build: () => api.tx?.revive?.map_address?.() }
    ]
  }

  function resolveOriginalAccountQuery(api: any) {
    const candidates: Array<{ label: string; getValue: () => any }> = [
      { label: 'Revive.OriginalAccount', getValue: () => api.query?.Revive?.OriginalAccount?.getValue },
      { label: 'revive.OriginalAccount', getValue: () => api.query?.revive?.OriginalAccount?.getValue },
      { label: 'revive.originalAccount', getValue: () => api.query?.revive?.originalAccount?.getValue },
      { label: 'palletRevive.OriginalAccount', getValue: () => api.query?.palletRevive?.OriginalAccount?.getValue },
      { label: 'palletRevive.originalAccount', getValue: () => api.query?.palletRevive?.originalAccount?.getValue }
    ]
    for (const candidate of candidates) {
      const getter = candidate.getValue()
      if (getter) return getter
    }
    return null
  }

  function deriveH160Hex(ss58: string) {
    const accountId = decodeAddress(ss58)
    const hash = keccakAsU8a(accountId)
    return `0x${u8aToHex(hash.slice(-20)).slice(2)}`
  }

  function buildH160KeyCandidates(h160Hex: string) {
    const candidates: unknown[] = []
    try {
      candidates.push(FixedSizeBinary.fromHex(h160Hex))
    } catch {}
    try {
      candidates.push(Binary.fromHex(h160Hex))
    } catch {}
    try {
      candidates.push(hexToU8a(h160Hex))
    } catch {}
    candidates.push(h160Hex)
    return candidates
  }

  function resolveUnmapAccountCandidates(api: any) {
    return [
      { label: 'revive.unmap_account', build: () => api.tx?.revive?.unmap_account?.() },
      { label: 'revive.unmapAccount', build: () => api.tx?.revive?.unmapAccount?.() },
      { label: 'Revive.unmap_account', build: () => api.tx?.Revive?.unmap_account?.() },
      { label: 'Revive.unmapAccount', build: () => api.tx?.Revive?.unmapAccount?.() },
      { label: 'palletRevive.unmap_account', build: () => api.tx?.palletRevive?.unmap_account?.() },
      { label: 'palletRevive.unmapAccount', build: () => api.tx?.palletRevive?.unmapAccount?.() }
    ]
  }

  async function mapAccount() {
    if (!activeAccount.value) throw new Error('No active account selected')
    if (/^0x[0-9a-fA-F]{40}$/.test(activeAccount.value.address)) {
      throw new Error('Selected account is an EVM address. Please choose a Substrate (SS58) account.')
    }
    const client = usePapiClient()
    if (!client) throw new Error('PAPI client not available')

    status.value = 'mapping'
    error.value = null
    mapNote.value = null

    try {
      const api: any = client.getUnsafeApi()
      const candidates = resolveMapAccountCandidates(api)
      let lastRuntimeError: string | null = null

      for (const candidate of candidates) {
        try {
          const tx = candidate.build()
          if (!tx) continue
          const result = await tx.signAndSubmit(activeAccount.value.polkadotSigner)
          lastTxHash.value = result?.txHash ?? result?.hash ?? null
          await checkMapped(true)
          return result
        } catch (err: any) {
          const message = String(err?.message ?? err)
          if (isAlreadyMappedError(err)) {
            await checkMapped(true)
            return null
          }
          if (message.includes('Runtime entry') || message.includes('not found')) {
            lastRuntimeError = message
            continue
          }
          throw err
        }
      }

      const pallets = Object.keys(api.tx ?? {})
      throw new Error(`pallet-revive map_account not found. Available pallets: ${pallets.join(', ')}. Last error: ${lastRuntimeError ?? 'n/a'}. Check that you are on Paseo Asset Hub with pallet-revive enabled.`)

    } catch (err: any) {
      const message = String(err?.message ?? err)
      // map_account throws if already mapped; treat as success
      if (isAlreadyMappedError(err)) {
        await checkMapped(true)
        return null
      }
      status.value = 'error'
      error.value = message
      throw err
    }
  }

  async function unmapAccount() {
    if (!activeAccount.value) throw new Error('No active account selected')
    if (/^0x[0-9a-fA-F]{40}$/.test(activeAccount.value.address)) {
      throw new Error('Selected account is an EVM address. Please choose a Substrate (SS58) account.')
    }
    const client = usePapiClient()
    if (!client) throw new Error('PAPI client not available')

    unmapStatus.value = 'unmapping'
    unmapError.value = null

    try {
      const api: any = client.getUnsafeApi()
      const candidates = resolveUnmapAccountCandidates(api)
      let lastRuntimeError: string | null = null

      for (const candidate of candidates) {
        try {
          const tx = candidate.build()
          if (!tx) continue
          const result = await tx.signAndSubmit(activeAccount.value.polkadotSigner)
          lastUnmapTxHash.value = result?.txHash ?? result?.hash ?? null
          unmapStatus.value = 'unmapped'
          status.value = 'idle'
          mapNote.value = null
          return result
        } catch (err: any) {
          const message = String(err?.message ?? err)
          if (isNotMappedError(err)) {
            unmapStatus.value = 'unmapped'
            status.value = 'idle'
            mapNote.value = null
            return null
          }
          if (message.includes('Runtime entry') || message.includes('not found')) {
            lastRuntimeError = message
            continue
          }
          throw err
        }
      }

      const pallets = Object.keys(api.tx ?? {})
      throw new Error(`pallet-revive unmap_account not found. Available pallets: ${pallets.join(', ')}. Last error: ${lastRuntimeError ?? 'n/a'}. Check that you are on Paseo Asset Hub with pallet-revive enabled.`)
    } catch (err: any) {
      const message = String(err?.message ?? err)
      if (isNotMappedError(err)) {
        unmapStatus.value = 'unmapped'
        status.value = 'idle'
        mapNote.value = null
        return null
      }
      unmapStatus.value = 'error'
      unmapError.value = message
      throw err
    }
  }

  async function checkMapped(force = false) {
    if (!activeAccount.value) return
    const address = activeAccount.value.address
    if (!force && lastCheckedAddress.value === address && status.value === 'mapped') {
      return
    }
    lastCheckedAddress.value = address
    status.value = 'mapping'
    error.value = null
    mapNote.value = null

    try {
      const client = usePapiClient()
      if (!client) throw new Error('PAPI client not available')
      const api: any = client.getUnsafeApi()
      const getter = resolveOriginalAccountQuery(api)
      if (!getter) {
        const pallets = Object.keys(api.query ?? {})
        throw new Error(`Revive.OriginalAccount not found. Available pallets: ${pallets.join(', ')}`)
      }
      const h160Hex = deriveH160Hex(address)
      const keyCandidates = buildH160KeyCandidates(h160Hex)
      let result: unknown = undefined
      let lastRuntimeError: string | null = null
      for (const candidate of keyCandidates) {
        try {
          result = await getter(candidate)
          lastRuntimeError = null
          break
        } catch (err: any) {
          const message = String(err?.message ?? err)
          if (message.includes('Incompatible runtime entry')) {
            lastRuntimeError = message
            continue
          }
          throw err
        }
      }
      if (lastRuntimeError) {
        throw new Error(lastRuntimeError)
      }
      const isMapped = result !== undefined && result !== null
      if (isMapped) {
        status.value = 'mapped'
        mapNote.value = 'Mapped (verified)'
      } else {
        status.value = 'idle'
        mapNote.value = null
      }
    } catch (err: any) {
      status.value = 'error'
      error.value = err?.message ?? String(err)
      throw err
    }
  }

  return {
    status,
    error,
    lastTxHash,
    mapNote,
    unmapStatus,
    unmapError,
    lastUnmapTxHash,
    mapAccount,
    unmapAccount,
    checkMapped,
  }
}
