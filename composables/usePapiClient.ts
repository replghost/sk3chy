import { createClient } from 'polkadot-api'
import { getWsProvider } from '@polkadot-api/ws-provider'
import { getHostProvider, isInsideContainer } from '@parity/product-sdk-host'

let client: ReturnType<typeof createClient> | null = null
let clientPromise: Promise<ReturnType<typeof createClient> | null> | null = null

function toWsUrl(url: string) {
  if (url.startsWith('https://')) return url.replace('https://', 'wss://')
  if (url.startsWith('http://')) return url.replace('http://', 'ws://')
  return url
}

function resolveWsUrl() {
  const config = useRuntimeConfig()
  const explicitWs = config.public.substrateRpcWs as string | undefined
  if (explicitWs && explicitWs.length > 0) return explicitWs

  const httpUrl = config.public.substrateRpcHttp as string | undefined
  if (!httpUrl) {
    throw new Error('Substrate RPC not configured. Set NUXT_PUBLIC_SUBSTRATE_RPC_HTTP or NUXT_PUBLIC_SUBSTRATE_RPC_WS.')
  }
  return toWsUrl(httpUrl)
}

export function usePapiClient() {
  if (process.server) return null
  if (!client) {
    const wsUrl = resolveWsUrl()
    client = createClient(getWsProvider(wsUrl))
  }
  return client
}

export async function getPapiClient() {
  if (process.server) return null
  if (client) return client
  if (clientPromise) return clientPromise

  clientPromise = (async () => {
    const config = useRuntimeConfig()
    const genesisHash = config.public.substrateGenesisHash as `0x${string}` | undefined

    if (genesisHash && await isInsideContainer().catch(() => false)) {
      const hostProvider = await getHostProvider(genesisHash).catch(() => null)
      if (hostProvider) {
        client = createClient(hostProvider)
        return client
      }
    }

    const wsUrl = resolveWsUrl()
    client = createClient(getWsProvider(wsUrl))
    return client
  })()

  return clientPromise
}
