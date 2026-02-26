/**
 * ss-webrtc: WebRTC Signaling via Statement Store
 *
 * A WebRTC signaling system using single-writer last-write-wins channels
 * for realtime applications.
 */

// Main provider
export { SSWebRTCProvider } from './SSWebRTCProvider'

// Core components (for advanced usage)
export { StatementStore } from './StatementStore'
export { SignalingManager } from './SignalingManager'
export { PeerManager } from './PeerManager'
export { TurnCredentials } from './TurnCredentials'

// Types
export type {
  SSWebRTCConfig,
  ConnectionStatus,
  LogType,
  LogEntry,
  ChannelType,
  ChannelValue,
  PresenceValue,
  EpochValue,
  OfferValue,
  AnswerValue,
  KeypairType,
  StatementStoreSigningMode
} from './types'

// Utility functions
export {
  generatePeerId,
  generateEpoch,
  isOfferer,
  getPeerRoles,
  isPresenceExpired,
  getPresenceChannel,
  getEpochChannel,
  getOfferChannel,
  getAnswerChannel
} from './types'
