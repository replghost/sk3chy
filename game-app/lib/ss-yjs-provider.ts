import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

import { SSWebRTCProvider } from './ss-webrtc'
import type { SSWebRTCConfig } from './ss-webrtc'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
const MESSAGE_QUERY_AWARENESS = 2
const MESSAGE_PEER_ID = 3

type ProviderEvent = 'status' | 'peers'
type EventHandler = (event: any) => void

export interface SSYjsProviderConfig extends SSWebRTCConfig {}

export class SSYjsProvider {
  readonly doc: Y.Doc
  readonly awareness: awarenessProtocol.Awareness
  readonly webrtc: SSWebRTCProvider

  private listeners: Map<ProviderEvent, Set<EventHandler>> = new Map()
  private peers: Set<string> = new Set()
  private peerClientIds: Map<string, number> = new Map()

  private updateHandler: ((update: Uint8Array, origin: any) => void) | null = null
  private awarenessHandler:
    | ((changes: { added: number[]; updated: number[]; removed: number[] }, origin: any) => void)
    | null = null

  constructor(roomId: string, doc: Y.Doc, config: SSYjsProviderConfig) {
    this.doc = doc
    this.awareness = new awarenessProtocol.Awareness(doc)

    this.webrtc = new SSWebRTCProvider(roomId, {
      ...config,
      onStatus: (status, message) => {
        config.onStatus?.(status, message)
        this.emit('status', { status, message })
      },
      onPeerConnect: (peerId) => {
        config.onPeerConnect?.(peerId)
        this.handlePeerConnect(peerId)
      },
      onPeerDisconnect: (peerId) => {
        config.onPeerDisconnect?.(peerId)
        this.handlePeerDisconnect(peerId)
      },
      onPeerExpired: (peerId) => {
        config.onPeerExpired?.(peerId)
        this.handlePeerDisconnect(peerId)
      },
      onData: (peerId, data) => this.handleMessage(peerId, data)
    })

    this.bindDocUpdates()
    this.bindAwarenessUpdates()

    void this.webrtc.connect().catch((error) => {
      const msg = error instanceof Error ? error.message : String(error)
      config.onLog?.(`SSWebRTC connect failed: ${msg}`, 'error')
      this.emit('status', { status: 'disconnected', message: msg })
    })
  }

  on(event: ProviderEvent, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: ProviderEvent, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler)
  }

  async destroy(): Promise<void> {
    if (this.updateHandler) {
      this.doc.off('update', this.updateHandler)
      this.updateHandler = null
    }
    if (this.awarenessHandler) {
      this.awareness.off('update', this.awarenessHandler)
      this.awarenessHandler = null
    }

    this.peers.clear()
    this.peerClientIds.clear()

    await this.webrtc.disconnect()
  }

  private emit(event: ProviderEvent, payload: any): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach((handler) => handler(payload))
  }

  private bindDocUpdates(): void {
    this.updateHandler = (update: Uint8Array, origin: any) => {
      if (origin === this) return

      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      this.broadcast(encoding.toUint8Array(encoder))
    }

    this.doc.on('update', this.updateHandler)
  }

  private bindAwarenessUpdates(): void {
    this.awarenessHandler = (changes, origin) => {
      if (origin !== this) return

      const changedClients = changes.added.concat(changes.updated, changes.removed)
      if (changedClients.length === 0) return

      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(encoder, update)
      this.broadcast(encoding.toUint8Array(encoder))
    }

    this.awareness.on('update', this.awarenessHandler)
  }

  private handlePeerConnect(peerId: string): void {
    this.peers.add(peerId)
    this.emit('peers', { webrtcPeers: Array.from(this.peers) })

    this.sendPeerId(peerId)
    this.sendSyncStep1(peerId)
    this.sendAwarenessUpdate(peerId)
    this.sendQueryAwareness(peerId)
  }

  private handlePeerDisconnect(peerId: string): void {
    this.peers.delete(peerId)
    const clientId = this.peerClientIds.get(peerId)
    if (typeof clientId === 'number') {
      awarenessProtocol.removeAwarenessStates(this.awareness, [clientId], this)
      this.peerClientIds.delete(peerId)
    }
    this.emit('peers', { webrtcPeers: Array.from(this.peers) })
  }

  private handleMessage(peerId: string, data: Uint8Array): void {
    try {
      const decoder = decoding.createDecoder(data)
      const messageType = decoding.readVarUint(decoder)

      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder()
          encoding.writeVarUint(encoder, MESSAGE_SYNC)
          syncProtocol.readSyncMessage(decoder, encoder, this.doc, this)
          if (encoding.length(encoder) > 1) {
            this.send(peerId, encoding.toUint8Array(encoder))
          }
          break
        }
        case MESSAGE_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder)
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, peerId)
          break
        }
        case MESSAGE_QUERY_AWARENESS: {
          this.sendAwarenessUpdate(peerId)
          break
        }
        case MESSAGE_PEER_ID: {
          const clientId = decoding.readVarUint(decoder)
          this.peerClientIds.set(peerId, clientId)
          break
        }
        default:
          break
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private send(peerId: string, data: Uint8Array): void {
    this.webrtc.send(peerId, data)
  }

  private broadcast(data: Uint8Array): void {
    this.webrtc.broadcast(data)
  }

  private sendSyncStep1(peerId: string): void {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(encoder, this.doc)
    this.send(peerId, encoding.toUint8Array(encoder))
  }

  private sendAwarenessUpdate(peerId: string): void {
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(encoder, update)
    this.send(peerId, encoding.toUint8Array(encoder))
  }

  private sendQueryAwareness(peerId: string): void {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_QUERY_AWARENESS)
    this.send(peerId, encoding.toUint8Array(encoder))
  }

  private sendPeerId(peerId: string): void {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_PEER_ID)
    encoding.writeVarUint(encoder, this.doc.clientID)
    this.send(peerId, encoding.toUint8Array(encoder))
  }
}
