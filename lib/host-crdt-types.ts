/**
 * Type definitions for the host-sdk CRDT extension bridge.
 *
 * The CRDT extension is injected at `window.host.ext.crdt` by the host runtime
 * and provides document sync, awareness, and peer tracking backed by
 * Statement Store relay with y-crdt (Rust Yjs port).
 */

// ============================================================================
// Host CRDT Extension API (injected on window.host.ext.crdt)
// ============================================================================

export interface HostCrdtExtension {
  join(roomId: string, opts?: { transport?: string }): Promise<CrdtJoinResult>
  applyUpdate(roomId: string, dataBase64: string): Promise<boolean>
  getStateVector(roomId: string): Promise<string>
  getFullState(roomId: string): Promise<string>
  setAwareness(roomId: string, state: Record<string, unknown>): Promise<boolean>
  destroy(roomId: string): Promise<boolean>
}

export interface CrdtJoinResult {
  roomId: string
  transport: string
}

// ============================================================================
// Host Event Payloads
// ============================================================================

export interface CrdtRemoteUpdatePayload {
  roomId: string
  updateBase64: string
}

export interface CrdtAwarenessPayload {
  roomId: string
  clientId: number
  state: string
}

export interface CrdtPeerChangePayload {
  roomId: string
  peers: string[]
}

// ============================================================================
// Shared Types (migrated from ss-webrtc/types.ts)
// ============================================================================

export type LogType = 'info' | 'success' | 'error' | 'warning' | 'blockchain'

export interface LogEntry {
  timestamp: Date
  message: string
  type: LogType
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

// ============================================================================
// Global Augmentation
// ============================================================================

interface HostRuntime {
  ext: {
    crdt: HostCrdtExtension
  }
  on(event: string, handler: (...args: any[]) => void): void
  off(event: string, handler: (...args: any[]) => void): void
}

declare global {
  interface Window {
    host?: HostRuntime
  }
}
