/**
 * HostCrdtProvider — replaces SSYjsProvider with the same consumer interface.
 *
 * Uses window.host.ext.crdt for document sync, awareness, and peer tracking
 * instead of WebRTC + Statement Store signaling.
 */

import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { HostAwarenessBridge } from './host-awareness-bridge'
import type {
  HostCrdtExtension,
  CrdtRemoteUpdatePayload,
  CrdtPeerChangePayload,
} from './host-crdt-types'

// ---- Base64 ↔ Uint8Array ----

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ---- Types ----

type ProviderEvent = 'status' | 'peers'
type EventHandler = (event: any) => void

const PROVIDER_ORIGIN = Symbol('host-crdt-provider')

// ---- Provider ----

export class HostCrdtProvider {
  readonly doc: Y.Doc
  readonly awareness: Awareness

  private listeners = new Map<ProviderEvent, Set<EventHandler>>()
  private _connectedPeers = new Set<string>()
  private awarenessBridge: HostAwarenessBridge | null = null
  private updateHandler: ((update: Uint8Array, origin: any) => void) | null = null
  private remoteUpdateHandler: ((payload: CrdtRemoteUpdatePayload) => void) | null = null
  private peerChangeHandler: ((payload: CrdtPeerChangePayload) => void) | null = null
  private buffering = false
  private buffer: string[] = []
  private destroyed = false
  private roomId = ''
  private connectPromise: Promise<void>

  /** Set of currently connected peer IDs (from crdtPeerChange events) */
  get connectedPeers(): ReadonlySet<string> {
    return this._connectedPeers
  }

  /** Map of peerId → Yjs clientId (populated from awareness _yjsClientId) */
  get peerClientIdMap(): ReadonlyMap<string, number> {
    return this.awarenessBridge?.peerClientIdMap ?? new Map()
  }

  constructor(doc: Y.Doc, roomId: string, opts?: { transport?: string }) {
    // Runtime check
    if (!window.host?.ext?.crdt) {
      throw new Error('sk3chy requires a host-sdk runtime. window.host.ext.crdt is not available.')
    }

    this.doc = doc
    this.awareness = new Awareness(doc)

    const crdt = window.host.ext.crdt
    const host = window.host!
    const transport = opts?.transport

    // Set up awareness bridge
    this.awarenessBridge = new HostAwarenessBridge(this.awareness, doc, crdt, host, roomId)

    // Local → host (skip remote-applied updates)
    this.updateHandler = (update: Uint8Array, origin: any) => {
      if (origin === PROVIDER_ORIGIN) return
      crdt.applyUpdate(roomId, uint8ArrayToBase64(update)).catch(() => {})
    }
    doc.on('update', this.updateHandler)

    // Host → local
    this.remoteUpdateHandler = ({ roomId: rid, updateBase64 }) => {
      if (rid !== roomId) return
      if (this.buffering) {
        this.buffer.push(updateBase64)
        return
      }
      Y.applyUpdate(doc, base64ToUint8Array(updateBase64), PROVIDER_ORIGIN)
    }
    host.on('crdtRemoteUpdate', this.remoteUpdateHandler)

    // Peer tracking
    this.peerChangeHandler = ({ roomId: rid, peers }) => {
      if (rid !== roomId) return
      this._connectedPeers = new Set(peers)
      this.emit('peers', { webrtcPeers: peers })
    }
    host.on('crdtPeerChange', this.peerChangeHandler)

    // Connect (auto-start, matching SSYjsProvider behavior)
    this.connectPromise = this.connect(roomId, crdt, transport)
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
    this.destroyed = true

    if (this.updateHandler) {
      this.doc.off('update', this.updateHandler)
      this.updateHandler = null
    }

    const host = window.host
    if (host) {
      if (this.remoteUpdateHandler) {
        host.off('crdtRemoteUpdate', this.remoteUpdateHandler)
        this.remoteUpdateHandler = null
      }
      if (this.peerChangeHandler) {
        host.off('crdtPeerChange', this.peerChangeHandler)
        this.peerChangeHandler = null
      }
    }

    this.awarenessBridge?.destroy()
    this.awarenessBridge = null

    this._connectedPeers.clear()
    this.listeners.clear()

    // Tell host to clean up room state
    try {
      await window.host?.ext?.crdt?.destroy(this.roomId)
    } catch {}
  }

  private emit(event: ProviderEvent, payload: any): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach((handler) => handler(payload))
  }

  private async connect(
    roomId: string,
    crdt: HostCrdtExtension,
    transport?: string
  ): Promise<void> {
    this.roomId = roomId
    this.emit('status', { status: 'connecting', message: 'Joining room...' })

    try {
      // 1. Join room
      await crdt.join(roomId, transport ? { transport } : undefined)

      // 2. Buffer remote updates during initial sync
      this.buffering = true
      this.buffer = []

      // 3. Get full state snapshot
      const fullStateBase64 = await crdt.getFullState(roomId)
      if (fullStateBase64) {
        Y.applyUpdate(this.doc, base64ToUint8Array(fullStateBase64), PROVIDER_ORIGIN)
      }

      // 4. Apply buffered updates in order
      for (const updateBase64 of this.buffer) {
        Y.applyUpdate(this.doc, base64ToUint8Array(updateBase64), PROVIDER_ORIGIN)
      }
      this.buffer = []
      this.buffering = false

      // 5. Connected
      this.emit('status', { status: 'connected', message: 'Connected' })
    } catch (error) {
      this.buffering = false
      this.buffer = []
      const msg = error instanceof Error ? error.message : String(error)
      this.emit('status', { status: 'disconnected', message: msg })
      throw error
    }
  }
}
