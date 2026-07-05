import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import * as Y from 'yjs'
import { HostCrdtProvider } from '~/lib/host-crdt-provider'
import { StatementStoreCrdtProvider } from '~/lib/statement-store-crdt-provider'
import { useBrowserKeys } from '~/composables/useBrowserKeys'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const browserKeys = useBrowserKeys()
  browserKeys.init()

  function createYRoom(roomId: string, opts?: {
    transport?: string
    statementStoreEndpoint?: string
    pollInterval?: number
    presenceTtl?: number
    onLog?: (message: string, type: string) => void
  }) {
    const doc = new Y.Doc()
    const provider = window.host?.ext?.crdt
      ? new HostCrdtProvider(doc, roomId, opts)
      : new StatementStoreCrdtProvider(doc, roomId, {
          statementStoreEndpoint: opts?.statementStoreEndpoint || (config.public.statementStoreWs as string),
          pollInterval: opts?.pollInterval,
          presenceTtl: opts?.presenceTtl,
          localSigner: browserKeys.wallet.value,
          onLog: opts?.onLog,
        })
    const awareness = provider.awareness

    // Shared structures
    const strokes = doc.getArray<any>('strokes')
    const game = doc.getMap<any>('game')

    return { doc, provider, awareness, strokes, game }
  }

  return { provide: { createYRoom } }
})
