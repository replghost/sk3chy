import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { InjectedPolkadotAccount } from 'polkadot-api/pjs-signer'
import { SSYjsProvider } from '~/lib/ss-yjs-provider'
import { generatePeerId, type KeypairType } from '~/lib/ss-webrtc'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  console.log('[yjs] Runtime config:', config.public)
  console.log('[yjs] Signaling server from config:', config.public.signalingServer)
  
  // factory that builds a Yjs room on demand
  function createYRoom(roomId: string, opts?: {
    signaling?: string[]
    iceServers?: RTCIceServer[]
    signalingMode?: 'webrtc' | 'statement-store'
    statementStoreEndpoint?: string
    peerId?: string
    account?: InjectedPolkadotAccount
    username?: string
    pollInterval?: number
    presenceTtl?: number
    keyType?: KeypairType
    signingMode?: 'wallet' | 'ephemeral' | 'mnemonic'
    mnemonic?: string
    turnKeyId?: string
    turnApiToken?: string
  }) {
    const doc = new Y.Doc()

    // offline-first cache
    const idb = new IndexeddbPersistence(`yjs-${roomId}`, doc)

    const mode = opts?.signalingMode || (config.public.signalingMode as string) || 'webrtc'

    let provider: any
    let awareness: any

    if (mode === 'statement-store') {
      const account = opts?.account
      const signingMode: 'wallet' | 'ephemeral' | 'mnemonic' = opts?.signingMode || (opts?.mnemonic ? 'mnemonic' : (config.public.statementStoreSigningMode as 'wallet' | 'ephemeral' | 'mnemonic')) || 'ephemeral'
      if (signingMode === 'wallet' && !account) {
        throw new Error('Statement-store wallet signing requires an injected Substrate account.')
      }

      const endpoint = opts?.statementStoreEndpoint || (config.public.statementStoreWs as string)
      if (!endpoint) {
        throw new Error('Statement-store endpoint not configured. Set NUXT_PUBLIC_STATEMENT_STORE_WS.')
      }

      const peerId = opts?.peerId || generatePeerId()
      const username = opts?.username || (account as any)?.name

      console.log('[yjs] Using statement-store signaling:', endpoint)
      console.log('[yjs] Creating SSYjsProvider for room:', roomId)

      provider = new SSYjsProvider(roomId, doc, {
        substrateEndpoint: endpoint,
        documentId: roomId,
        peerId,
        account,
        username,
        keyType: opts?.keyType,
        signingMode,
        mnemonic: opts?.mnemonic,
        pollInterval: opts?.pollInterval,
        presenceTtl: opts?.presenceTtl,
        turnKeyId: opts?.turnKeyId,
        turnApiToken: opts?.turnApiToken
      })

      awareness = provider.awareness
    } else {
      // P2P transport using y-webrtc compatible signaling servers
      const signalingServers = opts?.signaling ?? [
        config.public.signalingServer, // Your server (localhost or Railway)
        // Fallback disabled for cleaner logs during local testing
        // 'wss://signaling.yjs.dev',
      ]
      
      console.log('[yjs] Using signaling servers:', signalingServers)
      console.log('[yjs] Creating WebrtcProvider for room:', roomId)
      
      provider = new WebrtcProvider(roomId, doc, {
        signaling: signalingServers,
        peerOpts: {
          config: {
            iceServers: opts?.iceServers ?? [
              { urls: 'stun:stun.l.google.com:19302' },
            ],
          },
        },
        // share presence
        awareness: undefined, // provider creates one
      })

      awareness = provider.awareness
    }

    // Shared structures
    const strokes = doc.getArray<any>('strokes')  // append Stroke objects
    const game = doc.getMap<any>('game')          // optional: round, timer, etc.

    return { doc, provider, awareness, idb, strokes, game }
  }

  return { provide: { createYRoom } }
})
