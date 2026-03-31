import { defineNuxtPlugin } from '#app'
import * as Y from 'yjs'
import { HostCrdtProvider } from '~/lib/host-crdt-provider'

export default defineNuxtPlugin(() => {
  function createYRoom(roomId: string, opts?: { transport?: string }) {
    const doc = new Y.Doc()
    const provider = new HostCrdtProvider(doc, roomId, opts)
    const awareness = provider.awareness

    // Shared structures
    const strokes = doc.getArray<any>('strokes')
    const game = doc.getMap<any>('game')

    return { doc, provider, awareness, strokes, game }
  }

  return { provide: { createYRoom } }
})
