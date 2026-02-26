/**
 * ss-webrtc: WebRTC Signaling via Statement Store
 *
 * A WebRTC signaling system using single-writer last-write-wins channels.
 * Each channel stores exactly one value, and each channel has exactly one writer.
 */

import type { InjectedPolkadotAccount } from 'polkadot-api/pjs-signer'

// ============================================================================
// Core Types
// ============================================================================

export type LogType = 'info' | 'success' | 'error' | 'warning' | 'blockchain'

export interface LogEntry {
  timestamp: Date
  message: string
  type: LogType
}

export type KeypairType = 'sr25519' | 'ed25519' | 'ecdsa'
export type StatementStoreSigningMode = 'wallet' | 'ephemeral' | 'mnemonic'

/**
 * Provider configuration
 */
export interface SSWebRTCConfig {
  /** WebSocket endpoint to Substrate node */
  substrateEndpoint: string
  /** Unique peer identifier (generated once per session) */
  peerId: string
  /** Document/room name for channel namespace */
  documentId: string
  /** Substrate account from injected wallet (required for wallet signing) */
  account?: InjectedPolkadotAccount
  /** Signing mode for statement-store writes */
  signingMode?: StatementStoreSigningMode
  /** BIP39 mnemonic for mnemonic signing mode */
  mnemonic?: string
  /** Optional display username */
  username?: string
  /** Override crypto type if the account is not sr25519 */
  keyType?: KeypairType
  /** Poll interval in ms (default: 500ms) */
  pollInterval?: number
  /** Presence TTL in ms (default: 20000ms) */
  presenceTtl?: number
  /** Cloudflare TURN key ID */
  turnKeyId?: string
  /** Cloudflare TURN API token */
  turnApiToken?: string
  /** Force TURN relay mode from first attempt (useful behind restrictive firewalls) */
  forceRelay?: boolean
  /** Callbacks */
  onStatus?: (status: ConnectionStatus, message: string) => void
  onPeerConnect?: (peerId: string) => void
  onPeerDisconnect?: (peerId: string) => void
  onPeerExpired?: (peerId: string) => void
  onLog?: (message: string, type: LogType) => void
  onData?: (peerId: string, data: Uint8Array) => void
  /** Called when a remote media stream is received */
  onStream?: (peerId: string, stream: MediaStream) => void
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Channel namespace structure:
 * {documentId}/
 * ├── presence/peer-{peerId}
 * ├── epochs/peer-{peerId}
 * ├── offers/from-{A}-to-{B}
 * └── answers/from-{B}-to-{A}
 */

export type ChannelType = 'presence' | 'epoch' | 'offer' | 'answer'

/**
 * Presence channel value - written periodically by owner for peer discovery
 */
export interface PresenceValue {
  type: 'presence'
  peerId: string
  epoch: number
  timestamp: number
  ttl: number
  username?: string
}

/**
 * Epoch channel value - written by owner to invalidate stale signaling
 */
export interface EpochValue {
  type: 'epoch'
  peerId: string
  epoch: number
  timestamp: number
}

/**
 * Offer channel value - written by offerer (lower peerId)
 */
export interface OfferValue {
  type: 'offer'
  from: string
  to: string
  epoch: number
  sdp: string
  timestamp: number
}

/**
 * Answer channel value - written by answerer (higher peerId)
 */
export interface AnswerValue {
  type: 'answer'
  from: string
  to: string
  epoch: number
  sdp: string
  timestamp: number
}

export type ChannelValue = PresenceValue | EpochValue | OfferValue | AnswerValue

// ============================================================================
// Channel Naming Functions
// ============================================================================

/**
 * Generate presence channel name for a peer
 */
export function getPresenceChannel(documentId: string, peerId: string): string {
  return `${documentId}/presence/peer-${peerId}`
}

/**
 * Generate epoch channel name for a peer
 */
export function getEpochChannel(documentId: string, peerId: string): string {
  return `${documentId}/epochs/peer-${peerId}`
}

/**
 * Generate offer channel name (from offerer to answerer)
 * Offerer is always the peer with lower peerId
 */
export function getOfferChannel(documentId: string, from: string, to: string): string {
  return `${documentId}/offers/from-${from}-to-${to}`
}

/**
 * Generate answer channel name (from answerer to offerer)
 * Answerer is always the peer with higher peerId
 */
export function getAnswerChannel(documentId: string, from: string, to: string): string {
  return `${documentId}/answers/from-${from}-to-${to}`
}

// ============================================================================
// Deterministic Offerer Selection
// ============================================================================

/**
 * Determine if this peer should be the offerer for a connection.
 * The peer with the lexicographically smaller peerId is always the offerer.
 *
 * This rule is:
 * - Deterministic
 * - Symmetric
 * - Independent of join order
 * - Collision-free
 */
export function isOfferer(myPeerId: string, otherPeerId: string): boolean {
  return myPeerId < otherPeerId
}

/**
 * Get the offerer and answerer for a peer pair
 */
export function getPeerRoles(
  peerA: string,
  peerB: string
): { offerer: string; answerer: string } {
  if (peerA < peerB) {
    return { offerer: peerA, answerer: peerB }
  }
  return { offerer: peerB, answerer: peerA }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a presence value has expired
 */
export function isPresenceExpired(presence: PresenceValue, now: number = Date.now()): boolean {
  return now - presence.timestamp > presence.ttl
}

/**
 * Generate a random peer ID
 */
export function generatePeerId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate initial epoch (timestamp-based for ordering)
 */
export function generateEpoch(): number {
  return Date.now()
}
