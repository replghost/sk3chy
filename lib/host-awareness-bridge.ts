/**
 * HostAwarenessBridge — bridges Yjs Awareness ↔ host CRDT awareness events.
 *
 * Responsibilities:
 * - Sends local awareness state to host via crdt.setAwareness() (throttled)
 * - Receives remote awareness via crdtAwareness events and injects into local Awareness
 * - Tracks remote peers by _yjsClientId for peerClientIdMap
 * - Heartbeat (10s) to keep local awareness fresh
 * - Expiry (30s) to remove silent remote peers
 */

import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'
import type { HostCrdtExtension, CrdtAwarenessPayload } from './host-crdt-types'

const THROTTLE_MS = 50
const HEARTBEAT_MS = 10_000
const EXPIRY_MS = 30_000
const REMOTE_ORIGIN = 'remote'

export class HostAwarenessBridge {
  private localState: Record<string, unknown> = {}
  private remoteStates = new Map<number, Record<string, unknown>>() // keyed by _yjsClientId
  private remotePeerClientMap = new Map<string, number>() // host peerId → _yjsClientId
  private lastSeen = new Map<number, number>() // _yjsClientId → timestamp

  private throttleTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private expiryTimer: ReturnType<typeof setInterval> | null = null
  private awarenessHandler: ((changes: { added: number[]; updated: number[]; removed: number[] }, origin: any) => void) | null = null
  private hostHandler: ((payload: CrdtAwarenessPayload) => void) | null = null
  private destroyed = false

  constructor(
    private readonly awareness: Awareness,
    private readonly doc: Y.Doc,
    private readonly crdt: HostCrdtExtension,
    private readonly host: Window['host'],
    private readonly roomId: string
  ) {
    this.bindLocalAwareness()
    this.bindRemoteAwareness()
    this.startHeartbeat()
    this.startExpiryCheck()
  }

  /** Map of host peerId → Yjs clientId (populated from _yjsClientId in awareness payloads) */
  get peerClientIdMap(): ReadonlyMap<string, number> {
    return this.remotePeerClientMap
  }

  destroy(): void {
    this.destroyed = true

    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
      this.throttleTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer)
      this.expiryTimer = null
    }
    if (this.awarenessHandler) {
      this.awareness.off('update', this.awarenessHandler)
      this.awarenessHandler = null
    }
    if (this.hostHandler && this.host) {
      this.host.off('crdtAwareness', this.hostHandler)
      this.hostHandler = null
    }

    this.remoteStates.clear()
    this.remotePeerClientMap.clear()
    this.lastSeen.clear()
  }

  // ---- Local → Host ----

  private bindLocalAwareness(): void {
    this.awarenessHandler = (_changes, origin) => {
      // Skip remote-applied updates to avoid echo
      if (origin === REMOTE_ORIGIN) return

      // Read the current local state from the awareness instance
      const state = this.awareness.getLocalState()
      if (!state) return

      // Inject _yjsClientId so remote peers can map back to our Yjs clientId
      this.localState = { ...state, _yjsClientId: this.doc.clientID }
      this.scheduleSend()
    }
    this.awareness.on('update', this.awarenessHandler)
  }

  private scheduleSend(): void {
    this.dirty = true
    if (this.throttleTimer) return

    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null
      if (this.dirty && !this.destroyed) {
        this.dirty = false
        this.crdt.setAwareness(this.roomId, this.localState).catch(() => {})
      }
    }, THROTTLE_MS)
  }

  // ---- Host → Local ----

  private bindRemoteAwareness(): void {
    if (!this.host) return

    this.hostHandler = (payload: CrdtAwarenessPayload) => {
      if (payload.roomId !== this.roomId) return
      if (this.destroyed) return

      let state: Record<string, unknown>
      try {
        state = JSON.parse(payload.state)
      } catch {
        return
      }

      const yjsClientId = typeof state._yjsClientId === 'number' ? state._yjsClientId : null
      if (yjsClientId === null || yjsClientId === this.doc.clientID) return // ignore self

      // Track peerId → clientId mapping
      // The host sends clientId in the payload which represents the host's internal peer id
      // We use the _yjsClientId from the state for Yjs-level identity
      const hostClientId = payload.clientId
      this.remotePeerClientMap.set(String(hostClientId), yjsClientId)

      const prevState = this.remoteStates.get(yjsClientId)
      this.remoteStates.set(yjsClientId, state)
      this.lastSeen.set(yjsClientId, Date.now())

      // Compute change type
      const added = prevState === undefined ? [yjsClientId] : []
      const updated = prevState !== undefined ? [yjsClientId] : []

      // Inject into local awareness (use REMOTE_ORIGIN so our handler skips re-sending)
      this.awareness.setLocalStateField  // We can't use setLocalStateField for remote clients
      // Instead, directly manipulate the awareness states map
      const states = this.awareness.getStates()
      states.set(yjsClientId, state)

      // Fire change event so composables react
      this.awareness.emit('change', [{ added, updated, removed: [] }, REMOTE_ORIGIN])
    }

    this.host.on('crdtAwareness', this.hostHandler)
  }

  // ---- Heartbeat ----

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.destroyed) return
      // Re-send current local state to keep presence alive
      const state = this.awareness.getLocalState()
      if (state) {
        this.localState = { ...state, _yjsClientId: this.doc.clientID }
        this.crdt.setAwareness(this.roomId, this.localState).catch(() => {})
      }
    }, HEARTBEAT_MS)
  }

  // ---- Expiry ----

  private startExpiryCheck(): void {
    this.expiryTimer = setInterval(() => {
      if (this.destroyed) return

      const now = Date.now()
      const removed: number[] = []

      for (const [clientId, lastSeen] of this.lastSeen) {
        if (now - lastSeen > EXPIRY_MS) {
          removed.push(clientId)
          this.remoteStates.delete(clientId)
          this.lastSeen.delete(clientId)

          // Remove from awareness states
          const states = this.awareness.getStates()
          states.delete(clientId)

          // Clean up peerId mapping
          for (const [peerId, cid] of this.remotePeerClientMap) {
            if (cid === clientId) {
              this.remotePeerClientMap.delete(peerId)
              break
            }
          }
        }
      }

      if (removed.length > 0) {
        this.awareness.emit('change', [{ added: [], updated: [], removed }, REMOTE_ORIGIN])
      }
    }, 5_000) // Check every 5 seconds
  }
}
