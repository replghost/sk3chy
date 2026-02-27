import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import type { InjectedPolkadotAccount } from 'polkadot-api/pjs-signer'
import { SSYjsProvider } from '~/lib/ss-yjs-provider'
import { generatePeerId, type KeypairType, type ExternalSigner } from '~/lib/ss-webrtc'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // factory that builds a Yjs room on demand
  function createYRoom(roomId: string, opts?: {
    signalingMode?: 'statement-store' | 'webrtc'
    signaling?: string[]
    iceServers?: RTCIceServer[]
    statementStoreEndpoint?: string
    peerId?: string
    account?: InjectedPolkadotAccount
    username?: string
    pollInterval?: number
    presenceTtl?: number
    keyType?: KeypairType
    signingMode?: 'wallet' | 'ephemeral' | 'mnemonic' | 'external'
    mnemonic?: string
    externalSigner?: ExternalSigner
    turnKeyId?: string
    turnApiToken?: string
    onLog?: (message: string, type: string) => void
  }) {
    const doc = new Y.Doc()

    // offline-first cache
    const idb = new IndexeddbPersistence(`yjs-${roomId}`, doc)

    const mode = opts?.signalingMode || (config.public.signalingMode as 'statement-store' | 'webrtc') || 'webrtc'

    let provider: any
    if (mode === 'webrtc') {
      const signaling = opts?.signaling?.length
        ? opts.signaling
        : ((config.public.signalingServer as string) ? [config.public.signalingServer as string] : undefined)
      const iceServers = opts?.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]

      provider = new WebrtcProvider(roomId, doc, {
        signaling,
        peerOpts: {
          config: { iceServers }
        }
      })

      opts?.onLog?.(`[yjs] Using y-webrtc signaling${signaling?.[0] ? `: ${signaling[0]}` : ''}`, 'info')
    } else {
      const account = opts?.account
      const signingMode = opts?.signingMode || (opts?.mnemonic ? 'mnemonic' : (config.public.statementStoreSigningMode as 'wallet' | 'ephemeral' | 'mnemonic')) || 'ephemeral'
      if (signingMode === 'wallet' && !account) {
        throw new Error('Statement-store wallet signing requires an injected Substrate account.')
      }
      if (signingMode === 'external' && !opts?.externalSigner) {
        throw new Error('External signing mode requires an externalSigner with address and sign function.')
      }

      const endpoint = opts?.statementStoreEndpoint || (config.public.statementStoreWs as string)
      if (!endpoint) {
        throw new Error('Statement-store endpoint not configured. Set NUXT_PUBLIC_STATEMENT_STORE_WS.')
      }

      const peerId = opts?.peerId || generatePeerId()
      const username = opts?.username || (account as any)?.name

      console.log('[yjs] Using statement-store signaling:', endpoint)

      provider = new SSYjsProvider(roomId, doc, {
        substrateEndpoint: endpoint,
        documentId: roomId,
        peerId,
        account,
        username,
        keyType: opts?.keyType,
        signingMode,
        mnemonic: opts?.mnemonic,
        externalSigner: opts?.externalSigner,
        pollInterval: opts?.pollInterval,
        presenceTtl: opts?.presenceTtl,
        turnKeyId: opts?.turnKeyId,
        turnApiToken: opts?.turnApiToken,
        onLog: opts?.onLog as any,
      })
    }

    const awareness = provider.awareness

    // Shared structures
    const strokes = doc.getArray<any>('strokes')  // append Stroke objects
    const game = doc.getMap<any>('game')          // optional: round, timer, etc.

    return { doc, provider, awareness, idb, strokes, game }
  }

  return { provide: { createYRoom } }
})
