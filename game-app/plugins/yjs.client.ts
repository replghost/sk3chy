import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  // factory that builds a Yjs room on demand
  function createYRoom(roomId: string, opts?: {
    signaling?: string[]
    iceServers?: RTCIceServer[]
  }) {
    const doc = new Y.Doc()

    // offline-first cache
    const idb = new IndexeddbPersistence(`yjs-${roomId}`, doc)

    // P2P transport using y-webrtc compatible signaling servers
    const signalingServers = opts?.signaling ?? [
      config.public.signalingServer, // Your Railway server
      'wss://signaling.yjs.dev', // Fallback
    ]
    
    console.log('[yjs] Using signaling servers:', signalingServers)
    
    const provider = new WebrtcProvider(roomId, doc, {
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

    const awareness = provider.awareness

    // Shared structures
    const strokes = doc.getArray<any>('strokes')  // append Stroke objects
    const game = doc.getMap<any>('game')          // optional: round, timer, etc.

    return { doc, provider, awareness, idb, strokes, game }
  }

  return { provide: { createYRoom } }
})
