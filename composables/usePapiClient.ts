import { createClient } from 'polkadot-api'
import { getWsProvider } from '@polkadot-api/ws-provider'

let client: ReturnType<typeof createClient> | null = null

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
